'use strict';

/**
 * settlement-retry.job — Wave 3 commit 3.
 *
 * Retries commerce settlement transfers that were recorded but never completed:
 *   - the brand onboarded a Route payout account AFTER the sale, or
 *   - a transient Razorpay Route failure left razorpay_transfer_id null.
 *
 * Eligible: completed commerce transactions that were already settled
 * (tcs_amount recorded) but have no transfer id yet, whose brand now HAS a
 * linked account and a positive brand_net. Per-transaction failures are logged
 * and counted; they don't stop the batch.
 */

const db = require('../config/db');
const settlementService = require('../services/settlement.service');

async function run() {
  console.log('[CRON settlement-retry] Running...');

  const { rows } = await db.query(
    `SELECT ft.id
       FROM follower_transactions ft
       JOIN brands b ON b.id = ft.brand_id
      WHERE ft.status = 'completed'
        AND ft.razorpay_transfer_id IS NULL
        AND ft.tcs_amount IS NOT NULL
        AND ft.brand_net > 0
        AND b.razorpay_linked_account_id IS NOT NULL
      ORDER BY ft.created_at ASC
      LIMIT 200`
  );

  let succeeded = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      const res = await settlementService.retryTransfer(db, r.id);
      if (res.transfer_id) succeeded += 1;
    } catch (err) {
      failed += 1;
      console.error(`[CRON settlement-retry] txn ${r.id} failed: ${err.message}`);
    }
  }

  console.log(`[CRON settlement-retry] eligible ${rows.length} — ${succeeded} transferred, ${failed} failed`);
  return { retried: rows.length, succeeded, failed };
}

module.exports = { run };
