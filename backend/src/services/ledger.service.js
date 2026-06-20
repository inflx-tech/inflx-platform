'use strict';

/**
 * ledger.service.js — Money G-5: forward-only influencer earnings ledger.
 *
 * Single append-only write point for the `influencer_ledger` table (migration
 * 112). Every influencer balance mutation (pending credit at sale, confirm
 * pending→wallet, tranche wallet credit, withdrawal debit + its reversals,
 * enquiry commission, referral accrual, return claw-back) appends one row here
 * so the influencer has a true running statement.
 *
 * House style mirrors brand wallet_transactions: type / amount / direction /
 * balance_after, plus balance_field so a reader knows WHICH bucket moved.
 *
 * BEST-EFFORT + ATOMIC: pass the SAME db client/transaction that performed the
 * balance mutation so the ledger row commits/rolls back with it. The append
 * MUST NEVER block the money operation — callers wrap it so a ledger failure is
 * logged, not thrown. If a site can't cheaply read balance_after, pass null.
 */

/**
 * @param {object}  args
 * @param {object}  args.client        pg client/pool with .query (defaults to the shared pool)
 * @param {string}  args.influencerId
 * @param {string}  args.type          ledger event type (see migration 112 comment)
 * @param {number}  args.amount        rupees, always positive
 * @param {string}  args.direction     'credit' | 'debit'
 * @param {string}  args.balanceField  'pending_balance' | 'wallet_balance'
 * @param {number} [args.balanceAfter] snapshot of the moved bucket, or null
 * @param {string} [args.source]
 * @param {string} [args.sourceRefId]
 * @param {string} [args.note]
 * @returns {Promise<object|null>} inserted row, or null on (logged) failure
 */
async function appendInfluencerLedger({
  client,
  influencerId,
  type,
  amount,
  direction,
  balanceField,
  balanceAfter = null,
  source = null,
  sourceRefId = null,
  note = null,
}) {
  const runner = client || require('../config/db');
  if (!influencerId || !type || !direction || !balanceField) {
    console.error('[ledger] skipped append — missing required field', { influencerId, type, direction, balanceField });
    return null;
  }
  const amt = parseFloat((parseFloat(amount) || 0).toFixed(2));
  const bal = balanceAfter == null ? null : parseFloat((parseFloat(balanceAfter) || 0).toFixed(2));
  try {
    const { rows } = await runner.query(
      `INSERT INTO influencer_ledger
         (influencer_id, type, amount, direction, balance_field, balance_after,
          source, source_ref_id, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [influencerId, type, amt, direction, balanceField, bal, source, sourceRefId || null, note]
    );
    return rows[0] || null;
  } catch (err) {
    // Never block the money op on an audit-row failure.
    console.error(`[ledger] append failed (type=${type}, inf=${influencerId}): ${err.message}`);
    return null;
  }
}

module.exports = { appendInfluencerLedger };
