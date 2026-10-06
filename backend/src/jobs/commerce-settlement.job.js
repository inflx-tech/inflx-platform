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
       LEFT JOIN follower_orders fo ON fo.id = ft.order_id
      WHERE ft.status = 'completed'
        AND ft.brand_settlement_status = 'pending'
        -- Item 17 (review): only sales that came through the shopper checkout become wallet money,
        -- and never while the parcel is still Confirmed/Packed — it can still be cancelled and
        -- refunded in full, and a share already in a wallet could not be taken back.
        AND ft.checkout_id IS NOT NULL
        AND fo.order_status IS DISTINCT FROM 'confirmed'
        AND fo.order_status IS DISTINCT FROM 'packed'
        AND ft.return_window_ends_at IS NOT NULL
        AND ft.return_window_ends_at <= NOW()
        -- shopper-walk-fixes (W13, founder 4 Oct 2026): the brand's share — and with it INFLX's own,
        -- which counts as earned at this settlement — is added only AFTER DELIVERY: the return window
        -- runs from the delivery, with the length stamped on the sale, for an online payment exactly
        -- as for cash. (Item 17 had this for cash only.)
        AND fo.order_status = 'delivered' AND fo.delivered_at IS NOT NULL
        -- shopper-deal-orders (E10): after a replacement is delivered the window runs again from then.
        AND GREATEST(fo.delivered_at, COALESCE(ft.return_window_restart_at, fo.delivered_at)) + (ft.return_window_ends_at - ft.created_at) <= NOW()
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
      // Item 17: the service credits the brand's WALLET and flips the status in one transaction.
      const res = await settlementService.settleCommerceTransaction(db, r.id);
      // A legacy row the old path had already marked (tcs_amount set) is skipped by the service;
      // flip its status here so it leaves the 'pending' pool exactly once. No money moves here.
      // ONLY that case: a row the service refused for another reason stays pending.
      if (res && res.skipped === true) {
        await db.query(
          `UPDATE follower_transactions
              SET brand_settlement_status = 'settled', brand_settled_at = NOW()
            WHERE id = $1 AND brand_settlement_status = 'pending' AND tcs_amount IS NOT NULL`,
          [r.id]
        );
      }
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
