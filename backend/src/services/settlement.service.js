'use strict';

/**
 * settlement.service.js — Wave 3 commit 2 (commerce settlement engine).
 *
 * Settles a completed commerce follower_transaction:
 *   - per-brand TCS (only when brands.tcs_applicable AND the global
 *     payment_config.tcs_active gate is on — via tax.service.tcsOn),
 *   - commission GST (GST on the platform's marketplace commission, recorded),
 *   - a Razorpay Route transfer of the brand's net (brand_net − TCS) to the
 *     brand's linked account, and records tcs_amount / commission_gst_amount /
 *     razorpay_transfer_id on the row.
 *
 * BEST-EFFORT + IDEMPOTENT: a failed transfer NEVER affects the purchase (the
 * customer already paid). The transfer only fires if the brand has a linked
 * account; otherwise the tax figures are still recorded and razorpay_transfer_id
 * stays null for a later retry. In RAZORPAY_MOCK mode the transfer is synthetic.
 *
 * Also stamps a sale's return window (return_window_ends_at). Since shopper-walk-fixes (W11, W13;
 * founder, 4 Oct 2026) that is ONE platform number, in hours, set by INFLX's admin — no category,
 * brand or product has one of its own — and a delivered order's window runs from its delivery.
 *
 * Contract: features/wave3-commerce-settlement-engine/ · features/shopper-walk-fixes.
 */

const taxService     = require('./tax.service');

function _round2(n) { return parseFloat((parseFloat(n) || 0).toFixed(2)); }

/**
 * The stamp for a sale made now (the old name is kept for its many callers).
 * @param {object} runner   kept for the old signature; not used
 * @param {string} brandId  kept for the old signature; not used
 * @returns {Promise<Date>}
 */
async function resolveReturnWindowEndsAt(runner, brandId) { // eslint-disable-line no-unused-vars
  // shopper-walk-fixes (W11, W13): one platform number, in hours — no brand or category has its
  // own. This is the STAMP (made now + the window in force); for a delivered order the window is
  // counted from the delivery with this same length (returnWindow.service · closesAt).
  return require('./returnWindow.service').stampFor(new Date());
}

/**
 * Item 17 (rules v1.31 §17A, W2–W4) — a sale's return window has closed: the Brand's share is
 * ADDED TO THE BRAND'S WALLET. Nothing is transferred to a bank (Razorpay Route is retired from
 * this path); the Brand withdraws by request, or funds its next collaboration with it.
 *
 * One transaction per sale: the row is taken FOR UPDATE, its settlement status is the
 * compare-and-swap, and the wallet credit and its ledger row commit with it — so a crash can
 * never credit twice or mark a sale settled without the money (the old path fired a transfer
 * and wrote its marker in a separate statement).
 *
 * Cash on delivery (W4): INFLX collects the cash through the delivery partner, so a delivered
 * cash order settles exactly as an online one. The Brand owes INFLX nothing for it — no
 * brand_dues row is created any more.
 *
 * TCS and the GST on INFLX's fee are still RECORDED on the row when their switches are on (tax is
 * a later round, W8); with the switches off both are 0 and the whole kept share is credited.
 *
 * `runner` is kept for the old signature; the work always runs in its own transaction.
 * @returns {Promise<object|null>}
 */
async function settleCommerceTransaction(runner, transactionId) {
  if (!transactionId) return null;
  const db = require('../config/db');
  return db.withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT ft.id, ft.brand_id, ft.brand_net, ft.brand_net_reversed, ft.marketplace_fee_amount,
              ft.tcs_amount, ft.brand_settlement_status, ft.status, ft.checkout_id,
              COALESCE(ft.platform_fee_reversed, 0) AS platform_fee_reversed,
              b.tcs_applicable, fo.order_status, fo.delivered_at,
              (fo.delivered_at + (ft.return_window_ends_at - ft.created_at) <= now()) AS window_closed
         FROM follower_transactions ft
         JOIN brands b ON b.id = ft.brand_id
         LEFT JOIN follower_orders fo ON fo.id = ft.order_id
        WHERE ft.id = $1
        FOR UPDATE OF ft`,
      [transactionId]
    );
    const t = rows[0];
    if (!t) return null;
    // Idempotent: settled once, by its status (and the legacy tcs_amount marker).
    if (t.brand_settlement_status !== 'pending' || t.tcs_amount != null) return { skipped: true };
    // Wallet money is real money (it can be withdrawn), so only a sale that came through the
    // shopper checkout — the one path that verifies its payment — is ever credited. The older
    // pay-at-store / prebook rows have no checkout and were never paid out; they stay as they are.
    if (!t.checkout_id) return { skipped: 'not_a_checkout_sale' };
    // A parcel that is still Confirmed or Packed can still be cancelled and refunded in full, so its
    // share is not added yet. (cancel() takes this same row FOR UPDATE, so the two cannot interleave.)
    if (['confirmed', 'packed'].includes(t.order_status)) return { skipped: 'not_shipped' };
    // shopper-walk-fixes (W13): the share is added only after DELIVERY, when the return window —
    // counted from the delivery, with the length stamped on the sale — has closed. The job asks the
    // same thing in SQL; it is asked again here because wallet money can be withdrawn.
    if (t.order_status !== 'delivered' || !t.delivered_at) return { skipped: 'not_delivered' };
    if (t.window_closed !== true) return { skipped: 'window_open' };

    // The Brand's NET-OF-CANCELS-AND-RETURNS share (a reversed item is never credited).
    const brandNet      = _round2(Math.max(0, _round2(t.brand_net) - _round2(t.brand_net_reversed)));
    const fee           = _round2(Math.max(0, _round2(t.marketplace_fee_amount) - _round2(t.platform_fee_reversed)));
    const tcs           = t.tcs_applicable ? await taxService.tcsOn(brandNet) : 0;
    const commissionGst = await taxService.gstOn(fee);
    const credit        = _round2(Math.max(0, brandNet - tcs));

    const { rowCount } = await client.query(
      `UPDATE follower_transactions
          SET tcs_amount = $1, commission_gst_amount = $2, brand_settlement_status = 'settled', brand_settled_at = now()
        WHERE id = $3 AND brand_settlement_status = 'pending'`,
      [tcs, commissionGst, transactionId]);
    if (rowCount !== 1) return { skipped: true };

    let balanceAfter = null;
    if (credit > 0) {
      const { rows: [br] } = await client.query(
        `UPDATE brands SET wallet_balance = wallet_balance + $2 WHERE id = $1 RETURNING wallet_balance`, [t.brand_id, credit]);
      balanceAfter = _round2(br.wallet_balance);
      await client.query(
        `INSERT INTO wallet_transactions (brand_id, type, amount, direction, balance_after, notes, source_ref_id)
         VALUES ($1, 'sale_settlement', $2, 'credit', $3, 'Sales money added', $4)`,
        [t.brand_id, credit, balanceAfter, transactionId]);
      // Item 11: money in settles a courier charge still owed, oldest first, in this transaction.
      await require('./remoteMoney.service').settleDuesFromCredit(client, t.brand_id, credit);
    }
    return { tcs, commission_gst: commissionGst, credited: credit, balance_after: balanceAfter, transfer_id: null };
  });
}

/** Item 17 — retired: nothing is transferred to a bank any more, so there is nothing to retry. */
async function retryTransfer() {
  return { skipped: 'retired' };
}

module.exports = { resolveReturnWindowEndsAt, settleCommerceTransaction, retryTransfer };
