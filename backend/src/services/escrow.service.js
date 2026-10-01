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
// Contract: features/referral-engine — accrue referral commission to the
// brand's active referrer on a released escrow tranche's protection fee.
const referralService   = require('./referral.service');
const ledgerService     = require('./ledger.service');
const { splitAmount }   = require('../utils/money');

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
  const TRANCHES = buildTranches(cfg);

  // Item 7, §9 of rules v1.20 and approval Q2: the creator receives the agreed
  // amount IN FULL. No platform charge of any kind is deducted from a fee
  // tranche on Pay for Content or Hybrid — INFLX's take on that money is the
  // campaign fee, charged once to the brand when the funds lock. These three
  // rows are only ever fee tranches, so the tier fee is zero on all of them.
  //
  // `escrow_fee_tiers` and `_resolveFeeRate` are deliberately left in place:
  // they still price the commerce protection fee elsewhere (pricing.service).
  //
  // The split comes from the ONE shared helper so the escrow rows and every
  // screen agree to the paise (approval 4.4).
  const parts = splitAmount(fee, TRANCHES.map((t) => t.pct * 100));

  const entries = [];
  for (let i = 0; i < TRANCHES.length; i++) {
    const t = TRANCHES[i];
    const amount = parts[i];

    const { rows } = await client.query(
      `INSERT INTO escrow_entries
         (campaign_influencer_id, tranche_number, amount, escrow_fee_amount,
          fee_gst_amount, net_to_influencer, status, trigger_event)
       VALUES ($1, $2, $3, 0, 0, $4, 'locked', $5)
       RETURNING *`,
      [campaignInfluencerId, t.tranche_number, amount, amount, t.trigger_event]
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

  // Item 7, Phase 2a — the release is idempotent in ITSELF, not only in its
  // callers. The row is already locked FOR UPDATE above, so a second caller
  // that got this far sees 'released' and leaves without paying twice.
  if (entry.status === 'released') {
    return { payoutId: entry.razorpay_payout_id, netAmount: parseFloat(entry.net_to_influencer), alreadyReleased: true };
  }

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
  const marked = await client.query(
    `UPDATE escrow_entries
     SET status = 'released', released_at = now(), triggered_at = now(), razorpay_payout_id = $2
     WHERE id = $1 AND status <> 'released'`,
    [escrowEntryId, payoutId]
  );
  // Belt and braces: the guard above should have caught this, but a compare-
  // and-swap that changed nothing must never fall through to a wallet credit.
  if (marked.rowCount === 0) {
    return { payoutId: entry.razorpay_payout_id, netAmount: parseFloat(entry.net_to_influencer), alreadyReleased: true };
  }

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

  // G-5 ledger: tranche net credited to wallet_balance (campaign escrow release).
  await ledgerService.appendInfluencerLedger({
    client,
    influencerId,
    type: 'tranche_release',
    amount: netAmount,
    direction: 'credit',
    balanceField: 'wallet_balance',
    balanceAfter: newBalance,
    source: 'escrow',
    sourceRefId: escrowEntryId,
    note: `Tranche ${entry.tranche_number} released`,
  });

  // Audit: wallet_transactions for brand (type=payout, direction=debit)
  // balance_after = current brand balance (unchanged — escrow_lock already deducted it at publish)
  const { rows: brandRows } = await client.query(
    `SELECT wallet_balance FROM brands WHERE id = $1`,
    [brandId]
  );
  const brandBalance = parseFloat(brandRows[0].wallet_balance);

  // Item 7, Phase 2a — TWO audit rows, because they answer two questions and
  // only one of them was ever written.
  //
  //   escrow_release (credit) un-reserves the tranche. wallet.controller reads
  //     reserved = escrow_lock debits − escrow_release credits, and nothing in
  //     the codebase had ever written the credit side, so a brand's "reserved"
  //     figure only ever grew, for the life of the account.
  //   payout (debit) is the settled figure, as before.
  //
  // Neither moves money: `balance_after` is the brand's unchanged balance,
  // because escrow_lock already took it at signing.
  await client.query(
    `INSERT INTO wallet_transactions
       (brand_id, type, amount, direction, balance_after, campaign_id, notes)
     VALUES ($1, 'escrow_release', $2, 'credit', $3, $4, $5)`,
    [
      brandId,
      parseFloat(entry.amount),
      brandBalance,
      campaignId,
      `Tranche ${entry.tranche_number} un-reserved — ref ${payoutId}`,
    ]
  );

  await client.query(
    // Item 17: source_ref_id names the escrow row this payment IS, so the wallet's History can say
    // "Paid to Meera Rao · Second 25%" instead of a ledger note.
    `INSERT INTO wallet_transactions
       (brand_id, type, amount, direction, balance_after, campaign_id, notes, source_ref_id)
     VALUES ($1, 'payout', $2, 'debit', $3, $4, $5, $6)`,
    [
      brandId,
      parseFloat(entry.amount),
      brandBalance,
      campaignId,
      `Tranche ${entry.tranche_number} released — payout ${payoutId}`,
      escrowEntryId,
    ]
  );

  // Referral accrual (contract: features/referral-engine). The platform's
  // protection-fee slice on this tranche is escrow_fee_amount. If the campaign's
  // BRAND has an active in-window referrer, accrue their %. SAVEPOINT-isolated
  // inside this host transaction + idempotent on (source, source_ref_id), so an
  // accrual failure rolls back ONLY the referral work — this tranche release
  // (wallet credit + audit row above) still commits, and the influencer's
  // net_to_influencer is untouched. One ledger row per escrow_entries.id, so
  // T1/T2/T3 each accrue separately.
  await referralService.accrueWithClient(client, {
    source:       'protection_fee',
    sourceRefId:  escrowEntryId,
    referredType: 'brand',
    referredId:   brandId,
    baseAmount:   parseFloat(entry.escrow_fee_amount) || 0,
  });

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
