'use strict';

/**
 * transaction.service.js
 * Phase 4 — Blocks B, C, D
 *
 * Shared Razorpay mock store + tracking validation + commission crediting
 */

const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');

// ── In-memory mock order store ─────────────────────────────────────────────────
// Maps razorpay_order_id → { amount, meta }
const pendingOrders = new Map();

/**
 * Create a mock Razorpay order.
 * Returns { order_id }
 */
function createMockOrder(amountPaise, meta = {}) {
  const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
  pendingOrders.set(orderId, { amount: amountPaise, meta });
  console.log(`[RAZORPAY MOCK] Follower order created: ${orderId} ₹${(amountPaise / 100).toFixed(2)}`);
  return orderId;
}

/**
 * Consume a mock Razorpay order — throws if not found.
 * Returns stored { amount, meta }.
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
 * Validate all four tracking IDs for a follower transaction.
 * Throws OFFER_UNAVAILABLE (409) if any validation fails.
 *
 * @param {string} campaignId
 * @param {string} setId
 * @param {string} campaignInfluencerId
 * @param {string} offerId
 */
async function validateTracking(campaignId, setId, campaignInfluencerId, offerId) {
  const { rows } = await db.query(
    `SELECT
       ci.id, ci.status AS ci_status, ci.commission_pct, ci.coupon_code,
       cs.id AS set_id, cs.campaign_id,
       c.brand_id, c.status AS campaign_status, c.end_date,
       co.id AS offer_id
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c      ON c.id  = cs.campaign_id
     JOIN campaign_offers co ON co.set_id = cs.id
     WHERE ci.id = $1
       AND cs.id = $2
       AND c.id  = $3
       AND co.id = $4`,
    [campaignInfluencerId, setId, campaignId, offerId]
  );

  const record = rows[0];
  const UNAVAILABLE = new AppError('OFFER_UNAVAILABLE', 'This offer is no longer active.', 409);

  if (!record) throw UNAVAILABLE;
  if (!['contracted', 'active', 'completed'].includes(record.ci_status)) throw UNAVAILABLE;
  if (!['published', 'active', 'live'].includes(record.campaign_status)) throw UNAVAILABLE;
  if (record.end_date && new Date(record.end_date) < new Date()) throw UNAVAILABLE;

  return record; // { ci_status, commission_pct, coupon_code, brand_id, campaign_id, set_id, offer_id }
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
  createMockOrder,
  consumeMockOrder,
  validateTracking,
  calcPayAtStore,
  calcOnlineOrder,
  creditInfluencerCommission,
};
