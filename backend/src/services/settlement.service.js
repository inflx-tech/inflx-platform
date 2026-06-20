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
 * Also resolves the per-category commission-release window
 * (return_window_ends_at) so commission release honours the admin-set
 * per-category window instead of a flat 30 days.
 *
 * Contract: features/wave3-commerce-settlement-engine/.
 */

const taxService     = require('./tax.service');
const pricingService = require('./pricing.service');
const routeService   = require('./razorpayRoute.service');
const { toPaise }    = require('../utils/money');

const DAY_MS = 24 * 60 * 60 * 1000;
function _round2(n) { return parseFloat((parseFloat(n) || 0).toFixed(2)); }

/**
 * Per-category commission-release window end (replaces the flat 30-day timer).
 * @param {object} runner   pg pool/client
 * @param {string} brandId
 * @returns {Promise<Date>}
 */
async function resolveReturnWindowEndsAt(runner, brandId) {
  let category = null;
  try {
    const { rows } = await runner.query(`SELECT category FROM brands WHERE id = $1`, [brandId]);
    category = rows[0]?.category || null;
  } catch (_) { /* fall back to global window */ }
  const days = await pricingService.getReturnWindowForCategory(category, runner);
  return new Date(Date.now() + days * DAY_MS);
}

/**
 * Settle one completed commerce transaction. Reads everything it needs from the
 * row + brand, so it's uniform across all purchase paths. Best-effort.
 * @returns {Promise<object|null>}
 */
async function settleCommerceTransaction(runner, transactionId) {
  if (!transactionId) return null;

  const { rows } = await runner.query(
    `SELECT ft.id, ft.brand_id, ft.brand_net, ft.brand_net_reversed, ft.marketplace_fee_amount,
            ft.razorpay_payment_id, ft.tcs_amount,
            b.tcs_applicable, b.razorpay_linked_account_id
       FROM follower_transactions ft
       JOIN brands b ON b.id = ft.brand_id
      WHERE ft.id = $1`,
    [transactionId]
  );
  const t = rows[0];
  if (!t) return null;
  // Idempotent: tcs_amount populated (0 or positive) means already settled.
  if (t.tcs_amount != null) return { skipped: true };

  // Money G-3: settle the brand's NET-OF-RETURNS share. Partial returns have
  // already accumulated brand_net_reversed via the claw-back; the brand is paid
  // only on the kept portion. (Whole-order returns are excluded upstream by the
  // job's brand_settlement_status filter, so brandNet here is always >= 0.)
  const grossBrandNet  = _round2(t.brand_net);
  const reversed       = _round2(t.brand_net_reversed);
  const brandNet       = _round2(Math.max(0, grossBrandNet - reversed));
  const fee            = _round2(t.marketplace_fee_amount);
  const tcs            = t.tcs_applicable ? await taxService.tcsOn(brandNet) : 0;
  const commissionGst  = await taxService.gstOn(fee);
  const transferAmount = _round2(brandNet - tcs);

  let transferId = null;
  if (t.razorpay_linked_account_id && transferAmount > 0) {
    try {
      const tr = await routeService.createTransfer({
        paymentId:   t.razorpay_payment_id,
        accountId:   t.razorpay_linked_account_id,
        amountPaise: toPaise(transferAmount),
        notes:       { transaction_id: transactionId, type: 'commerce_settlement' },
      });
      transferId = tr.id || null;
    } catch (err) {
      // Best-effort: leave transfer_id null for a retry; never break the purchase.
      console.error(`[settlement] transfer failed for txn ${transactionId}: ${err.message}`);
    }
  }

  await runner.query(
    `UPDATE follower_transactions
        SET tcs_amount = $1, commission_gst_amount = $2, razorpay_transfer_id = $3
      WHERE id = $4`,
    [tcs, commissionGst, transferId, transactionId]
  );

  return { tcs, commission_gst: commissionGst, transfer_id: transferId, transfer_amount: transferAmount };
}

/**
 * Retry the Route transfer for an already-settled transaction whose transfer is
 * still null — e.g. the brand onboarded a payout account AFTER the sale, or a
 * transient Route failure. Uses the already-recorded tcs_amount. Throws on a
 * Route failure so the caller (cron) can count + log it.
 * @returns {Promise<object>}
 */
async function retryTransfer(runner, transactionId) {
  const { rows } = await runner.query(
    `SELECT ft.id, ft.brand_net, ft.brand_net_reversed, ft.tcs_amount,
            ft.razorpay_payment_id, ft.razorpay_transfer_id,
            b.razorpay_linked_account_id
       FROM follower_transactions ft
       JOIN brands b ON b.id = ft.brand_id
      WHERE ft.id = $1`,
    [transactionId]
  );
  const t = rows[0];
  if (!t) return { skipped: 'not_found' };
  if (t.razorpay_transfer_id) return { skipped: 'already_transferred' };
  if (!t.razorpay_linked_account_id) return { skipped: 'no_linked_account' };

  const tcs            = parseFloat(t.tcs_amount) || 0;
  // Net-of-returns, matching settleCommerceTransaction.
  const netBrand       = Math.max(0, (parseFloat(t.brand_net) || 0) - (parseFloat(t.brand_net_reversed) || 0));
  const transferAmount = _round2(netBrand - tcs);
  if (transferAmount <= 0) return { skipped: 'zero_amount' };

  const tr = await routeService.createTransfer({
    paymentId:   t.razorpay_payment_id,
    accountId:   t.razorpay_linked_account_id,
    amountPaise: toPaise(transferAmount),
    notes:       { transaction_id: transactionId, type: 'commerce_settlement_retry' },
  });
  await runner.query(
    `UPDATE follower_transactions SET razorpay_transfer_id = $1 WHERE id = $2`,
    [tr.id || null, transactionId]
  );
  return { transfer_id: tr.id || null, transfer_amount: transferAmount };
}

module.exports = { resolveReturnWindowEndsAt, settleCommerceTransaction, retryTransfer };
