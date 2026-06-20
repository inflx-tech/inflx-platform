'use strict';

/**
 * commerce-settlement.job — Money G-3 (defer brand commerce payout).
 *
 * Brands are NO LONGER paid their commerce net at sale time. This job pays them
 * only AFTER the order's return window has closed, on the NET-of-returns amount.
 *
 * Eligible transaction:
 *   - status = 'completed'                       (not refunded/cancelled)
 *   - brand_settlement_status = 'pending'        (not already settled/reversed —
 *                                                 this is the no-double-pay guard
 *                                                 alongside settleCommerceTransaction's
 *                                                 own tcs_amount IS NULL guard, and
 *                                                 it skips legacy rows backfilled
 *                                                 to 'settled' in migration 112)
 *   - return_window_ends_at <= NOW()             (window closed)
 *   - NO OPEN return (requested/approved/received) for the txn — a refunded
 *     return has already reduced brand_net_reversed, so it does NOT block.
 *
 * For each eligible txn: settleCommerceTransaction transfers (brand_net −
 * brand_net_reversed − TCS) and records tcs_amount; on success we flip the row
 * to 'settled'. Per-transaction failures are logged + counted; they never stop
 * the batch and never break a purchase the customer already paid for.
 *
 * Mirrors settlement-retry.job + commission-confirm.job.
 */

const db = require('../config/db');
const settlementService = require('../services/settlement.service');

async function run() {
  console.log('[CRON commerce-settlement] Running...');

  const { rows } = await db.query(
    `SELECT ft.id
       FROM follower_transactions ft
      WHERE ft.status = 'completed'
        AND ft.brand_settlement_status = 'pending'
        AND ft.return_window_ends_at IS NOT NULL
        AND ft.return_window_ends_at <= NOW()
        AND NOT EXISTS (
          SELECT 1 FROM follower_returns fr
           WHERE fr.transaction_id = ft.id
             AND fr.return_status IN ('requested', 'approved', 'received'))
      ORDER BY ft.return_window_ends_at ASC
      LIMIT 500`
  );

  let settled = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      const res = await settlementService.settleCommerceTransaction(db, r.id);
      // settleCommerceTransaction is idempotent (tcs_amount guard). Whether it
      // performed the settle or skipped an already-settled row, flip the status
      // marker so this row leaves the 'pending' pool exactly once.
      await db.query(
        `UPDATE follower_transactions
            SET brand_settlement_status = 'settled', brand_settled_at = NOW()
          WHERE id = $1 AND brand_settlement_status = 'pending'`,
        [r.id]
      );
      if (res && !res.skipped) settled += 1;
    } catch (err) {
      failed += 1;
      console.error(`[CRON commerce-settlement] txn ${r.id} failed: ${err.message}`);
    }
  }

  console.log(`[CRON commerce-settlement] eligible ${rows.length} — ${settled} settled, ${failed} failed`);
  return { eligible: rows.length, settled, failed };
}

module.exports = { run };
