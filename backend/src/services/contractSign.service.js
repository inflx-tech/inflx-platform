'use strict';

/**
 * Item 7 — the brand's countersignature, and the only place money locks.
 * Rules v1.20 §9 and §10. Contract: features/item7-agreement
 *
 * ONE SERVICE, TWO DOORS (approval Q9). The phone's new agreement endpoint and
 * brand-web's existing `POST /contracts/:id/brand-sign` both call this. If a
 * rule can be enforced in one place it must be, or the two doors drift and a
 * deal gets a bonus nobody agreed to.
 *
 * Everything here runs inside ONE transaction supplied by the caller, so the
 * signature, the lock and the first release either all happen or none do.
 *
 * The money, by Aim (rules §3, §10):
 *   Pay for Content — the fee PLUS the INFLX campaign fee.
 *   Hybrid          — the fixed fee alone; no campaign fee on a Hybrid amount.
 *   Pay for Sale    — nothing at all; there is no fixed money and no gate.
 *
 * And the creator receives the agreed amount IN FULL. No platform charge of
 * any kind comes out of a tranche.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const events = require('./collabEvents.service');
const escrowService = require('./escrow.service');
const productionService = require('./production.service');
const agreementTerms = require('./agreementTerms.service');
const platformSettings = require('./platformSettings.service');
const paymentConfigSvc = require('./paymentConfig.service');
const { plannedDeliverables } = require('./deliverables.model');

const FORMAT_ALIAS = {
  'instagram reel': 'reel', 'reels': 'reel', 'instagram post': 'post',
  'instagram story': 'story', 'instagram stories': 'story',
  'youtube short': 'youtube_short', 'youtube video': 'youtube_video',
};
function toCanonicalFormatType(raw) {
  if (!raw) return 'reel';
  const key = String(raw).toLowerCase().trim();
  return FORMAT_ALIAS[key] || key.replace(/\s+/g, '_');
}

const jsonObj = (v) => (v && typeof v === 'object' ? v : (() => { try { return JSON.parse(v); } catch { return null; } })());

/**
 * What the brand's signature will cost. Reads the SNAPSHOT when the agreement
 * has one, so a later change to the admin percentage cannot alter a deal that
 * has already been sent (approval 4.2). Legacy contracts with no snapshot fall
 * back to the live settings.
 */
async function costOf(contract) {
  const snap = jsonObj(contract.terms_json);
  if (snap && snap.money) {
    return {
      gate: Number(snap.money.fee || 0) > 0,
      fee: Number(snap.money.fee || 0),
      campaignFeePct: Number(snap.money.campaignFeePct || 0),
      campaignFee: Number(snap.money.campaignFee || 0),
      totalToLock: Number(snap.money.totalToLock || 0),
      split: snap.money.split || null,
      splitPct: snap.money.splitPct || null,
    };
  }
  const baseFee = parseFloat(contract.influencer_fee || contract.agreed_fee || contract.influencer_budget || contract.per_influencer_budget || 0);
  const bonus = parseFloat(contract.bonus_amount || 0);
  const settings = await platformSettings.getAll();
  const cfg = await paymentConfigSvc.getConfig();
  return agreementTerms.moneyFor(
    contract.goal, baseFee + bonus,
    settings.campaign_fee_pct.value,
    [cfg.tranche1Pct, cfg.tranche2Pct, cfg.tranche3Pct]
  );
}

/**
 * Countersign, inside the caller's transaction.
 *
 * @param client              the transaction client
 * @param contract            the joined contract row (see contract.controller's SELECT)
 * @param signedByUserId      the user signing for the brand
 * @param opts.typedName      the person's name, printed on the document
 * @param opts.ip / opts.device  how the signature was made
 */
async function brandSignInTx(client, contract, signedByUserId, opts = {}) {
  // Take the contract row itself FOR UPDATE, first, before any money moves.
  //
  // The caller's status check ran on an unlocked read outside this
  // transaction, so two simultaneous countersignatures could both pass it.
  // The brand row used to be locked further down — but only when there was a
  // fee to lock, so a Pay for Sale contract locked NOTHING anywhere and a
  // double tap flipped it twice, wrote two sets of escrow entries and two sets
  // of deliverables. This lock covers every Aim.
  const { rows: guardRows } = await client.query(
    `SELECT status FROM contracts WHERE id = $1 FOR UPDATE`, [contract.id]
  );
  if (!guardRows[0]) throw new AppError('NOT_FOUND', 'Contract not found', 404);
  if (guardRows[0].status !== 'pending_brand') {
    throw new AppError('VALIDATION_ERROR', 'This is already signed.', 422, 'status');
  }

  const cost = await costOf(contract);
  const effectiveFee = cost.fee;
  const lockAmount = cost.totalToLock;
  const needsWalletLock = lockAmount > 0;

  // 0. Backfill the base fee if it was never written.
  const baseFee = parseFloat(contract.influencer_fee || contract.agreed_fee || contract.influencer_budget || contract.per_influencer_budget || 0);
  if (!contract.influencer_fee && baseFee > 0) {
    await client.query(`UPDATE contracts SET influencer_fee = $1 WHERE id = $2`, [baseFee, contract.id]);
    await client.query(`UPDATE campaign_influencers SET agreed_fee = COALESCE(agreed_fee, $1) WHERE id = $2`, [baseFee, contract.campaign_influencer_id]);
  }

  // 0.5 Lock the funds. One balance decrement, two audit rows:
  //     escrow_lock  — the fee, held for the creator and released tranche by
  //                    tranche. This is what "reserved" means.
  //     platform_fee — the campaign fee, INFLX's, taken once and never
  //                    released, so it must not sit in "reserved" for ever.
  if (needsWalletLock) {
    const { rows: walletRows } = await client.query(
      `SELECT wallet_balance FROM brands WHERE id = $1 FOR UPDATE`, [contract.brand_id]
    );
    const currentBalance = parseFloat(walletRows[0].wallet_balance);
    const newBalance = parseFloat((currentBalance - lockAmount).toFixed(2));
    if (newBalance < 0) {
      const shortfall = parseFloat((lockAmount - currentBalance).toFixed(2));
      const err = new AppError('WALLET_INSUFFICIENT',
        `Add ${fmtRupees(shortfall)} to your wallet to sign this agreement.`, 422);
      err.details = { required: lockAmount, available: currentBalance, shortfall };
      throw err;
    }
    await client.query(`UPDATE brands SET wallet_balance = $1 WHERE id = $2`, [newBalance, contract.brand_id]);

    const who = contract.influencer_name || contract.influencer_id;
    await client.query(
      `INSERT INTO wallet_transactions (brand_id, type, amount, direction, balance_after, campaign_id, notes)
       VALUES ($1, 'escrow_lock', $2, 'debit', $3, $4, $5)`,
      [contract.brand_id, effectiveFee, newBalance, contract.campaign_id,
       `Locked for ${who} (${contract.campaign_name})`]
    );
    if (cost.campaignFee > 0) {
      await client.query(
        `INSERT INTO wallet_transactions (brand_id, type, amount, direction, balance_after, campaign_id, notes)
         VALUES ($1, 'platform_fee', $2, 'debit', $3, $4, $5)`,
        [contract.brand_id, cost.campaignFee, newBalance, contract.campaign_id,
         `INFLX campaign fee (${cost.campaignFeePct}%) for ${who}`]
      );
    }
  }

  // 1. The signature itself — a compare-and-swap, never a blind write.
  const { rows: contractRows } = await client.query(
    `UPDATE contracts
        SET status = 'active', brand_signed_at = now(), brand_signed_by = $2,
            brand_signed_name = COALESCE($3, brand_signed_name),
            brand_signed_ip = $4, brand_signed_device = $5,
            locked_amount = $6::numeric, campaign_fee_amount = $7::numeric,
            money_at = CASE WHEN $8::numeric > 0 THEN now() ELSE money_at END
      WHERE id = $1 AND status = 'pending_brand'
      RETURNING *`,
    [contract.id, signedByUserId, opts.typedName || null, opts.ip || null, opts.device || null,
     lockAmount, cost.campaignFee, lockAmount]
  );
  if (contractRows.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'This is already signed.', 422, 'status');
  }
  const updatedContract = contractRows[0];

  // 2. The collaboration becomes active for both sides.
  await client.query(`UPDATE campaign_influencers SET status = 'contracted' WHERE id = $1`, [contract.campaign_influencer_id]);

  await events.record({
    campaignInfluencerId: contract.campaign_influencer_id,
    step: events.STEP.SIGN, actorRole: 'brand', actorUserId: signedByUserId, action: 'countersigned',
  }, client);

  // 2b. The next step opens: the shoot plan for Store Visit, the shipment for Remote.
  try {
    await productionService.autoCreateForContract(client, updatedContract);
  } catch (peErr) {
    console.error('[CONTRACT] production_event auto-create failed:', peErr.message);
  }

  // 3 and 4. Three escrow entries, and the first released to her, now.
  let t1EntryId = null;
  let t1Result = null;
  if (effectiveFee > 0) {
    const entries = await escrowService.createEscrowEntries(
      client, contract.campaign_influencer_id, effectiveFee, contract.platform_fee_pct
    );
    t1EntryId = entries[0].id;
    t1Result = await escrowService.processTrancheRelease(
      client, t1EntryId, contract.influencer_id, contract.brand_id, contract.campaign_id
    );
    await client.query(`UPDATE contracts SET released_amount = $2 WHERE id = $1`,
      [contract.id, t1Result ? t1Result.netAmount : 0]);
  }

  // 5. Deliverables, but only where the brand is buying content.
  const planned = plannedDeliverables(contract.goal, contract.formats_json, toCanonicalFormatType);
  if (planned.error) throw new AppError('VALIDATION_ERROR', planned.error, 422);
  for (const fmt of planned.formats) {
    for (let i = 0; i < fmt.count; i++) {
      await client.query(
        `INSERT INTO deliverables (campaign_influencer_id, type, quantity, status, submission_deadline, revision_limit)
         VALUES ($1, $2, 1, 'pending', $3, $4)`,
        [contract.campaign_influencer_id, fmt.type, updatedContract.posting_date || null, updatedContract.revision_limit]
      );
    }
  }

  return { updatedContract, t1Result, t1EntryId, lockAmount, effectiveFee, cost };
}

function fmtRupees(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * The joined contract row `brandSignInTx` expects. The same shape
 * contract.controller builds for brand-web, so both doors hand the signing
 * service identical input.
 */
async function loadJoined(contractId, client = db) {
  const { rows } = await client.query(
    `SELECT con.*, ci.influencer_id, ci.agreed_fee, ci.influencer_budget, ci.commission_pct,
            cs.campaign_id, cs.per_influencer_budget, cs.goal,
            COALESCE(ci.formats_json, cs.formats_json) AS formats_json,
            c.brand_id, c.name AS campaign_name,
            b.platform_fee_pct, b.wallet_balance AS brand_wallet_balance,
            COALESCE(i.full_name, u_inf.name) AS influencer_name,
            u_inf.id AS influencer_user_id, u_br.id AS brand_user_id
       FROM contracts con
       JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       JOIN brands b ON b.id = c.brand_id
       JOIN influencers i ON i.id = ci.influencer_id
       JOIN users u_inf ON u_inf.id = i.user_id
       JOIN users u_br ON u_br.id = b.user_id
      WHERE con.id = $1`,
    [contractId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Contract not found', 404);
  return rows[0];
}

module.exports = { brandSignInTx, costOf, loadJoined, toCanonicalFormatType, fmtRupees };
