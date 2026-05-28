'use strict';

/**
 * escrow.service.js
 * Phase 3 — Block B  •  L2 tiered (Phase B1, M037)
 *
 * createEscrowEntries  — creates 3 tranche rows (25/25/50) when contract activates
 * processTrancheRelease — releases a tranche: credits influencer wallet + audit tx
 */

const env               = require('../config/env');
const paymentConfigSvc  = require('./paymentConfig.service');
const pricingService    = require('./pricing.service');
const taxService        = require('./tax.service');

// Tranche schedule — percents loaded from payment_config table at runtime
function buildTranches(cfg) {
  return [
    { tranche_number: 1, pct: cfg.tranche1Pct / 100, trigger_event: 'contract_signed'  },
    { tranche_number: 2, pct: cfg.tranche2Pct / 100, trigger_event: 'content_live'     },
    { tranche_number: 3, pct: cfg.tranche3Pct / 100, trigger_event: 'day_30_post_live' },
  ];
}

/**
 * Resolve the escrow fee % to apply to a given campaign_influencer.
 *
 * Precedence (highest first):
 *   1. campaigns.escrow_fee_pct_locked (M037+) — set at publish via pricing.service
 *   2. caller-supplied platformFeePct (legacy contract.platform_fee_pct path)
 *   3. payment_config.platform_fee_pct (final fallback)
 *
 * Returns rate as a decimal (0.03 = 3%).
 */
async function _resolveFeeRate(client, campaignInfluencerId, callerPct, cfg) {
  const locked = await client.query(
    `SELECT c.escrow_fee_pct_locked
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c     ON c.id = cs.campaign_id
       WHERE ci.id = $1`,
    [campaignInfluencerId]
  );
  const lockedPct = locked.rows[0]?.escrow_fee_pct_locked;
  if (lockedPct != null) return parseFloat(lockedPct) / 100;
  if (callerPct != null) return parseFloat(callerPct) / 100;
  return cfg.platformFeePct / 100;
}

/**
 * Create 3 escrow_entries for a campaign_influencer inside an open transaction.
 *
 * @param {object} client              — transaction client { query }
 * @param {string} campaignInfluencerId
 * @param {number} influencerFee       — agreed_fee (full amount)
 * @param {number} platformFeePct      — legacy per-contract pct (used if campaign has no locked rate)
 * @returns {object[]} — 3 escrow_entry rows
 */
async function createEscrowEntries(client, campaignInfluencerId, influencerFee, platformFeePct) {
  const fee    = parseFloat(influencerFee) || 0;
  const cfg    = await paymentConfigSvc.getConfig();
  const feePct = await _resolveFeeRate(client, campaignInfluencerId, platformFeePct, cfg);
  const TRANCHES = buildTranches(cfg);

  const entries = [];
  for (const t of TRANCHES) {
    const amount            = fee * t.pct;
    const escrowFeeAmount   = parseFloat((amount * feePct).toFixed(2));
    const netToInfluencer   = parseFloat((amount - escrowFeeAmount).toFixed(2));
    // Wave 2 commit 3 — GST on the Protection Fee, EXCLUSIVE (recorded +
    // surfaced to the brand; does not alter net_to_influencer or the brand
    // charge). Reuses the centralized tax helper (payment_config.gst_pct).
    const feeGstAmount      = await taxService.gstOn(escrowFeeAmount);

    const { rows } = await client.query(
      `INSERT INTO escrow_entries
         (campaign_influencer_id, tranche_number, amount, escrow_fee_amount,
          fee_gst_amount, net_to_influencer, status, trigger_event)
       VALUES ($1, $2, $3, $4, $5, $6, 'locked', $7)
       RETURNING *`,
      [campaignInfluencerId, t.tranche_number, amount, escrowFeeAmount, feeGstAmount, netToInfluencer, t.trigger_event]
    );
    entries.push(rows[0]);
  }
  return entries;
}

/**
 * Release a single tranche inside an open transaction.
 * - Marks escrow_entry as released + sets razorpay_payout_id (mock)
 * - Credits influencer wallet_balance and total_earned
 * - Creates an audit wallet_transactions row (type=payout, direction=debit)
 *   Note: brand.wallet_balance is NOT changed (funds already locked at publish)
 *
 * @param {object} client   — transaction client { query }
 * @param {string} escrowEntryId
 * @param {string} influencerId
 * @param {string} brandId
 * @param {string} campaignId
 * @returns {{ payoutId: string, netAmount: number }}
 */
async function processTrancheRelease(client, escrowEntryId, influencerId, brandId, campaignId) {
  // Lock and fetch the escrow entry
  const { rows: entryRows } = await client.query(
    `SELECT * FROM escrow_entries WHERE id = $1 FOR UPDATE`,
    [escrowEntryId]
  );
  if (!entryRows[0]) throw new Error(`Escrow entry not found: ${escrowEntryId}`);
  const entry = entryRows[0];

  // NOTE: Tranche release is a WALLET CREDIT, not a Razorpay payout. The
  // actual money movement to the influencer's bank/UPI happens later, when
  // they request a withdrawal — see withdrawal.service.js, which uses the
  // RazorpayX Payouts API. Lumping every tranche into its own bank transfer
  // (e.g. ₹250 for T1 of a ₹1000 fee) would burn fees and clutter the bank
  // statement; spec Section 4 batches them at withdrawal time instead.
  //
  // The reference ID below is just an audit handle for this internal credit,
  // not a Razorpay payout_id.
  const payoutId = `tranche_${entry.tranche_number}_${Date.now()}`;
  const liveKeysReady =
    !env.RAZORPAY_MOCK
    && env.RAZORPAY_KEY_ID
    && env.RAZORPAY_KEY_SECRET
    && env.RAZORPAY_KEY_ID !== 'rzp_test_mock';
  if (liveKeysReady) {
    console.log(`[ESCROW] Tranche ${entry.tranche_number} credited to influencer wallet — ref ${payoutId} ₹${entry.net_to_influencer} (real payout at withdrawal)`);
  } else {
    console.log(`[ESCROW MOCK] Tranche ${entry.tranche_number} credited — ref ${payoutId} ₹${entry.net_to_influencer}`);
  }

  // Mark escrow entry as released
  await client.query(
    `UPDATE escrow_entries
     SET status = 'released', released_at = now(), triggered_at = now(), razorpay_payout_id = $2
     WHERE id = $1`,
    [escrowEntryId, payoutId]
  );

  // Credit influencer wallet
  const { rows: infRows } = await client.query(
    `SELECT wallet_balance, total_earned FROM influencers WHERE id = $1 FOR UPDATE`,
    [influencerId]
  );
  const currentBalance = parseFloat(infRows[0].wallet_balance);
  const currentEarned  = parseFloat(infRows[0].total_earned);
  const netAmount      = parseFloat(entry.net_to_influencer);
  const newBalance     = parseFloat((currentBalance + netAmount).toFixed(2));
  const newEarned      = parseFloat((currentEarned  + netAmount).toFixed(2));

  await client.query(
    `UPDATE influencers SET wallet_balance = $1, total_earned = $2 WHERE id = $3`,
    [newBalance, newEarned, influencerId]
  );

  // Audit: wallet_transactions for brand (type=payout, direction=debit)
  // balance_after = current brand balance (unchanged — escrow_lock already deducted it at publish)
  const { rows: brandRows } = await client.query(
    `SELECT wallet_balance FROM brands WHERE id = $1`,
    [brandId]
  );
  const brandBalance = parseFloat(brandRows[0].wallet_balance);

  await client.query(
    `INSERT INTO wallet_transactions
       (brand_id, type, amount, direction, balance_after, campaign_id, notes)
     VALUES ($1, 'payout', $2, 'debit', $3, $4, $5)`,
    [
      brandId,
      parseFloat(entry.amount),
      brandBalance,
      campaignId,
      `Tranche ${entry.tranche_number} released — payout ${payoutId}`,
    ]
  );

  return { payoutId, netAmount };
}

/**
 * Standalone wrapper for T3 cron — opens its own transaction.
 * Fetches influencer_id, brand_id, campaign_id from DB then calls processTrancheRelease.
 */
async function processTrancheReleaseStandalone(escrowEntryId) {
  const db = require('../config/db');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch IDs needed by processTrancheRelease
    const { rows } = await client.query(
      `SELECT
         ee.id,
         ci.influencer_id,
         cs.campaign_id,
         c.brand_id
       FROM escrow_entries ee
       JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       WHERE ee.id = $1`,
      [escrowEntryId]
    );
    if (!rows[0]) throw new Error(`Escrow entry not found: ${escrowEntryId}`);
    const { influencer_id, campaign_id, brand_id } = rows[0];

    const result = await processTrancheRelease(client, escrowEntryId, influencer_id, brand_id, campaign_id);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createEscrowEntries, processTrancheRelease, processTrancheReleaseStandalone };
