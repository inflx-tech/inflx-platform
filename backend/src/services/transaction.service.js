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

// ── Razorpay client ──────────────────────────────────────────────────────────
let _rzp = null;
function getRzp() {
  if (!_rzp && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    _rzp = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return _rzp;
}

// ── In-memory mock order store ─────────────────────────────────────────────────
const pendingOrders = new Map();

/**
 * Create a Razorpay order — real or mock depending on RAZORPAY_MOCK.
 * Returns order_id string.
 */
async function createOrder(amountPaise, meta = {}) {
  if (env.RAZORPAY_MOCK) {
    return createMockOrder(amountPaise, meta);
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

  // Store meta for verification
  pendingOrders.set(order.id, { amount: amountPaise, meta });
  console.log(`[RAZORPAY] Order created: ${order.id} ₹${(amountPaise / 100).toFixed(2)}`);
  return order.id;
}

/**
 * Create a mock Razorpay order (dev mode).
 */
function createMockOrder(amountPaise, meta = {}) {
  const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
  pendingOrders.set(orderId, { amount: amountPaise, meta });
  console.log(`[RAZORPAY MOCK] Order created: ${orderId} ₹${(amountPaise / 100).toFixed(2)}`);
  return orderId;
}

/**
 * Consume an order — works for both mock and real.
 */
function consumeMockOrder(orderId) {
  const entry = pendingOrders.get(orderId);
  if (!entry) {
    throw new AppError('NOT_FOUND', 'Order not found or already processed', 404);
  }
  pendingOrders.delete(orderId);
  return entry;
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
  // Support both campaign_offers-based and campaign_influencers-based offers
  const { rows } = await db.query(
    `SELECT
       ci.id, ci.status AS ci_status, ci.commission_pct, ci.coupon_code,
       ci.influencer_id, ci.offer_type AS ci_offer_type, ci.offer_config_json,
       cs.id AS set_id, cs.campaign_id,
       c.brand_id, c.status AS campaign_status, c.end_date,
       co.id AS offer_id,
       COALESCE(co.discount_value, NULLIF(ci.offer_config_json->>'value','')::numeric, ci.commission_pct) AS discount_value,
       b.platform_fee_pct
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

/**
 * Calculate pay-at-store amounts. All values in paise.
 */
function calcPayAtStore(billAmount, discountPct, commissionPct, platformFeePct) {
  const discountAmount = Math.floor(billAmount * discountPct / 100);
  const netAmount = billAmount - discountAmount;
  const influencerCommission = Math.floor(netAmount * commissionPct / 100);
  const platformFee = Math.floor(netAmount * platformFeePct / 100);
  const brandNet = netAmount - influencerCommission - platformFee;
  return { discountAmount, netAmount, influencerCommission, platformFee, brandNet };
}

/**
 * Calculate online order amounts. All values in paise.
 * productsPaise: array of { price_paise, quantity }
 */
function calcOnlineOrder(productsPaise, discountPct, commissionPct, platformFeePct, deliveryFee) {
  const itemsTotal = productsPaise.reduce((sum, p) => sum + p.price_paise * p.quantity, 0);
  const discountAmount = Math.floor(itemsTotal * discountPct / 100);
  const discountedItems = itemsTotal - discountAmount;
  const netAmount = discountedItems + deliveryFee;
  const influencerCommission = Math.floor(discountedItems * commissionPct / 100);
  const platformFee = Math.floor(discountedItems * platformFeePct / 100);
  const brandNet = discountedItems - influencerCommission - platformFee;
  return { itemsTotal, discountAmount, netAmount, influencerCommission, platformFee, brandNet };
}

/**
 * Credit influencer commission to pending_balance and total_earned.
 * commissionPaise is stored as-is in the numeric column (treated as paise integer).
 */
async function creditInfluencerCommission(client, influencerId, commissionPaise) {
  await client.query(
    `UPDATE influencers
     SET pending_balance = pending_balance + $1,
         total_earned    = total_earned    + $1
     WHERE id = $2`,
    [commissionPaise, influencerId]
  );
}

module.exports = {
  createOrder,
  createMockOrder,
  consumeMockOrder,
  verifyPaymentSignature,
  validateTracking,
  calcPayAtStore,
  calcOnlineOrder,
  creditInfluencerCommission,
  getRazorpayKeyId: () => env.RAZORPAY_KEY_ID,
};
