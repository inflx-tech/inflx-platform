'use strict';

/**
 * transaction.service.js
 * Phase 4 — Blocks B, C, D
 *
 * Shared Razorpay mock store + tracking validation + commission crediting
 */

const crypto = require('crypto');
const Razorpay = require('razorpay');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { toPaise } = require('../utils/money');

// ── Razorpay client ──────────────────────────────────────────────────────────
let _rzp = null;
function getRzp() {
  if (!_rzp && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    _rzp = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return _rzp;
}

// ── Durable pending-order store (payment_pending_orders, migration 098) ─────
// Was an in-memory Map: every backend restart/deploy wiped in-flight
// checkouts, and a failed verify transaction consumed the order
// irrecoverably (contract: features/backend-defect-pending-order-volatile-store).
async function storePendingOrder(orderId, amountRupees, meta) {
  await db.query(
    `INSERT INTO payment_pending_orders (order_id, amount_rupees, meta)
     VALUES ($1, $2, $3)`,
    [orderId, amountRupees, JSON.stringify(meta || {})]
  );
}

/**
 * Create a Razorpay order — real or mock depending on RAZORPAY_MOCK.
 * `amountRupees` is in RUPEES; we convert to paise only at the Razorpay
 * API boundary. Returns the order_id string.
 */
async function createOrder(amountRupees, meta = {}) {
  const amountPaise = toPaise(amountRupees);

  if (env.RAZORPAY_MOCK) {
    return createMockOrder(amountRupees, meta);
  }

  // Real Razorpay order
  const rzp = getRzp();
  if (!rzp) throw new AppError('INTERNAL_ERROR', 'Razorpay not configured', 500);

  const order = await rzp.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: `inflx_${crypto.randomBytes(6).toString('hex')}`,
    notes: {
      type: meta.type || 'follower_transaction',
      campaign_id: meta.campaign_id || '',
      influencer_id: meta.campaign_influencer_id || '',
      brand_id: meta.brand_id || '',
    },
  });

  // Store rupees internally (paise only existed on the Razorpay request)
  await storePendingOrder(order.id, amountRupees, meta);
  console.log(`[RAZORPAY] Order created: ${order.id} \u20B9${amountRupees.toFixed(2)}`);
  return order.id;
}

/**
 * Create a mock Razorpay order (dev mode). Amount is in RUPEES.
 */
async function createMockOrder(amountRupees, meta = {}) {
  const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
  await storePendingOrder(orderId, amountRupees, meta);
  console.log(`[RAZORPAY MOCK] Order created: ${orderId} \u20B9${amountRupees.toFixed(2)}`);
  return orderId;
}

/**
 * Peek a pending order WITHOUT claiming it. Verify handlers read the amount/
 * meta here, do their work inside a db.withTransaction, and claim the order
 * as part of that transaction via consumePendingOrder — so a failed verify
 * rolls the claim back and the order stays retryable.
 */
async function getPendingOrder(orderId) {
  const { rows } = await db.query(
    `SELECT amount_rupees, meta, consumed_at FROM payment_pending_orders WHERE order_id = $1`,
    [orderId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Order not found', 404);
  if (rows[0].consumed_at) {
    throw new AppError('CONFLICT', 'Order already processed', 409);
  }
  const meta = typeof rows[0].meta === 'string' ? JSON.parse(rows[0].meta) : (rows[0].meta || {});
  return { amountRupees: parseFloat(rows[0].amount_rupees), meta };
}

/**
 * Atomically claim a pending order inside the caller's transaction.
 * 0 rows updated = a concurrent verify already claimed it → throw, which
 * rolls back the caller's transaction (double-spend guard).
 */
async function consumePendingOrder(client, orderId) {
  const { rowCount } = await client.query(
    `UPDATE payment_pending_orders SET consumed_at = now()
     WHERE order_id = $1 AND consumed_at IS NULL`,
    [orderId]
  );
  if (rowCount !== 1) {
    throw new AppError('CONFLICT', 'Order already processed', 409);
  }
}

/**
 * Verify Razorpay payment signature (production only).
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  if (env.RAZORPAY_MOCK) return true; // skip in mock mode

  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expectedSignature === signature;
}

/**
 * Validate all four tracking IDs for a follower transaction.
 * Throws OFFER_UNAVAILABLE (409) if any validation fails.
 *
 * @param {string} campaignId
 * @param {string} setId
 * @param {string} campaignInfluencerId
 * @param {string} offerId
 */
async function validateTracking(campaignId, setId, campaignInfluencerId, offerId) {
  // Tier-1 conversion fix: stop using commission_pct as a customer-facing
  // discount fallback. Discount is now resolved exclusively from
  // ci.offer_type + ci.offer_config_json via offer.service.js's parser.
  // The legacy co.discount_value is exposed for back-compat but treated
  // as a typed offer (controllers can opt-in via legacy_offer_*).
  const { rows } = await db.query(
    `SELECT
       ci.id, ci.status AS ci_status, ci.commission_pct, ci.coupon_code,
       ci.influencer_id, ci.offer_type AS ci_offer_type, ci.offer_config_json,
       cs.id AS set_id, cs.campaign_id,
       c.brand_id, c.status AS campaign_status, c.end_date,
       co.id AS offer_id,
       co.discount_value AS legacy_offer_discount_value,
       co.products_json  AS legacy_offer_products_json,
       b.platform_fee_pct,
       b.category        AS brand_category
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c      ON c.id  = cs.campaign_id
     JOIN brands b         ON b.id  = c.brand_id
     LEFT JOIN campaign_offers co ON co.set_id = cs.id AND ($4::uuid IS NULL OR co.id = $4)
     WHERE ci.id = $1
       AND cs.id = $2
       AND c.id  = $3
       AND (co.id IS NOT NULL OR ci.offer_type IS NOT NULL)`,
    [campaignInfluencerId, setId, campaignId, offerId || null]
  );

  const record = rows[0];
  const UNAVAILABLE = new AppError('OFFER_UNAVAILABLE', 'This offer is no longer active.', 409);

  if (!record) throw UNAVAILABLE;
  if (!['contracted', 'active', 'completed'].includes(record.ci_status)) throw UNAVAILABLE;
  if (!['published', 'active', 'live'].includes(record.campaign_status)) throw UNAVAILABLE;
  if (record.end_date && new Date(record.end_date) < new Date()) throw UNAVAILABLE;

  return record;
}

// Helper: round to 2-decimal rupees (matches numeric(x,2) DB column precision).
const r2 = (n) => parseFloat((n || 0).toFixed(2));

/**
 * Calculate pay-at-store amounts. All values in RUPEES.
 */
function calcPayAtStore(billAmount, discountPct, commissionPct, platformFeePct) {
  const discountAmount       = r2(billAmount * discountPct / 100);
  const netAmount            = r2(billAmount - discountAmount);
  const influencerCommission = r2(netAmount * commissionPct / 100);
  const platformFee          = r2(netAmount * platformFeePct / 100);
  const brandNet             = r2(netAmount - influencerCommission - platformFee);
  return { discountAmount, netAmount, influencerCommission, platformFee, brandNet };
}

/**
 * Calculate online order amounts. All values in RUPEES.
 * products: array of { price, quantity } (price in rupees)
 */
function calcOnlineOrder(products, discountPct, commissionPct, platformFeePct, deliveryFee = 0) {
  const itemsTotal           = r2(products.reduce((sum, p) => sum + parseFloat(p.price) * p.quantity, 0));
  const discountAmount       = r2(itemsTotal * discountPct / 100);
  const discountedItems      = r2(itemsTotal - discountAmount);
  const netAmount            = r2(discountedItems + parseFloat(deliveryFee || 0));
  const influencerCommission = r2(discountedItems * commissionPct / 100);
  const platformFee          = r2(discountedItems * platformFeePct / 100);
  const brandNet             = r2(discountedItems - influencerCommission - platformFee);
  return { itemsTotal, discountAmount, netAmount, influencerCommission, platformFee, brandNet };
}

/**
 * Credit influencer commission to pending_balance and total_earned.
 * commissionRupees is rupees (matches the new DB convention).
 */
async function creditInfluencerCommission(client, influencerId, commissionRupees) {
  await client.query(
    `UPDATE influencers
     SET pending_balance = pending_balance + $1,
         total_earned    = total_earned    + $1
     WHERE id = $2`,
    [commissionRupees, influencerId]
  );
}

module.exports = {
  createOrder,
  createMockOrder,
  getPendingOrder,
  consumePendingOrder,
  verifyPaymentSignature,
  validateTracking,
  calcPayAtStore,
  calcOnlineOrder,
  creditInfluencerCommission,
  getRazorpayKeyId: () => env.RAZORPAY_KEY_ID,
};
