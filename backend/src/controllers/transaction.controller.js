'use strict';

/**
 * transaction.controller.js
 * Phase 4 — Blocks B, C, D
 *
 * POST /follower/pay-at-store
 * POST /follower/pay-at-store/verify
 * GET  /follower/slots
 * POST /follower/prebook
 * POST /follower/prebook/verify
 * POST /follower/orders
 * POST /follower/orders/verify
 * GET  /follower/orders
 * GET  /follower/orders/:id
 * PATCH /follower/orders/:id/status   (brand only)
 */

const db = require('../config/db');
const env = require('../config/env');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const txService = require('../services/transaction.service');
const bookingService = require('../services/booking.service');
const notificationService = require('../services/notification.service');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getFollowerByUserId(userId) {
  const { rows } = await db.query(
    `SELECT f.*, u.name, u.phone, u.fcm_token
     FROM followers f JOIN users u ON u.id = f.user_id
     WHERE f.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getInfluencerByCiId(ciId) {
  const { rows } = await db.query(
    `SELECT i.*, u.name, u.phone, u.fcm_token
     FROM campaign_influencers ci
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE ci.id = $1`,
    [ciId]
  );
  return rows[0] || null;
}

async function getBrandByUserId(userId) {
  const { rows } = await db.query(
    `SELECT b.*, u.name, u.phone FROM brands b JOIN users u ON u.id = b.user_id WHERE b.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

function requireFollowerProfile(follower) {
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found. Please register first.', 404);
}

// Return window in ms
const RETURN_WINDOW_MS = (env.RETURN_WINDOW_DAYS || 30) * 24 * 60 * 60 * 1000;

// ── POST /follower/pay-at-store ───────────────────────────────────────────────

const initiatePayAtStore = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { offer_id, campaign_id, set_id, campaign_influencer_id, bill_amount } = req.body;

  if (!bill_amount || parseFloat(bill_amount) <= 0) {
    throw new AppError('VALIDATION_ERROR', 'bill_amount must be a positive number (rupees)', 422, 'bill_amount');
  }
  if (!campaign_id || !set_id || !campaign_influencer_id) {
    throw new AppError('VALIDATION_ERROR', 'campaign_id, set_id, campaign_influencer_id are required', 422);
  }

  // Validate tracking IDs (offer_id is optional — may not exist for CI-based offers)
  const record = await txService.validateTracking(campaign_id, set_id, campaign_influencer_id, offer_id || null);

  // Get discount — from campaign_offers if exists, otherwise from campaign_influencers
  let discountPct = 0;
  let platformFeePct = parseFloat(env.PLATFORM_FEE_PCT);

  if (offer_id) {
    const { rows: offerRows } = await db.query(
      `SELECT co.*, b.platform_fee_pct FROM campaign_offers co
       JOIN campaigns c ON c.id = co.campaign_id
       JOIN brands b ON b.id = c.brand_id
       WHERE co.id = $1`,
      [offer_id]
    );
    if (offerRows[0]) {
      discountPct = parseFloat(offerRows[0].discount_value || 0);
      platformFeePct = parseFloat(offerRows[0].platform_fee_pct || env.PLATFORM_FEE_PCT);
    }
  }

  // Fallback: use campaign_influencer discount
  if (discountPct === 0 && record.discount_value) {
    discountPct = parseFloat(record.discount_value);
  }
  if (record.platform_fee_pct) {
    platformFeePct = parseFloat(record.platform_fee_pct);
  }
  const commissionPct = parseFloat(record.commission_pct || 0);

  // bill_amount is in RUPEES (migration 021). calcPayAtStore now returns
  // rupees too; paise only exists at the Razorpay createOrder boundary.
  const billAmount = parseFloat(bill_amount);
  const { discountAmount, netAmount, influencerCommission, platformFee, brandNet } =
    txService.calcPayAtStore(billAmount, discountPct, commissionPct, platformFeePct);

  // Create Razorpay order
  const orderId = await txService.createOrder(netAmount, {
    type: 'pay_at_store',
    offer_id, campaign_id, set_id, campaign_influencer_id,
    bill_amount: billAmount, discount_amount: discountAmount,
    influencer_commission: influencerCommission, platform_fee: platformFee, brand_net: brandNet,
    follower_id: follower.id, brand_id: record.brand_id,
  });

  return success(res, {
    razorpay_order_id: orderId,
    razorpay_key_id: txService.getRazorpayKeyId(),
    net_amount: netAmount,
    discount_amount: discountAmount,
    original_amount: billAmount,
    discount_pct: discountPct,
    breakdown: { influencer_commission: influencerCommission, platform_fee: platformFee, brand_net: brandNet },
  }, 201);
});

// ── POST /follower/pay-at-store/verify ────────────────────────────────────────

const verifyPayAtStore = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { razorpay_order_id, razorpay_payment_id } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    throw new AppError('VALIDATION_ERROR', 'razorpay_order_id and razorpay_payment_id are required', 422);
  }

  // Consume mock order — returns the rupees amount plus meta we stashed.
  const { amountRupees: netAmount, meta } = txService.consumeMockOrder(razorpay_order_id);

  const returnWindowEndsAt = new Date(Date.now() + RETURN_WINDOW_MS);

  // Get coupon code
  const { rows: ciRows } = await db.query(
    `SELECT coupon_code FROM campaign_influencers WHERE id = $1`,
    [meta.campaign_influencer_id]
  );
  const couponCode = ciRows[0]?.coupon_code || null;

  let transactionId;
  const influencer = await getInfluencerByCiId(meta.campaign_influencer_id);

  await db.withTransaction(async (client) => {
    // Create follower_transaction — all money columns in rupees
    const { rows: txRows } = await client.query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, platform_fee, brand_net,
          status, coupon_code_used, return_window_ends_at, razorpay_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,'pay_at_store',$7,$8,$9,$10,$11,$12,'completed',$13,$14,$15)
       RETURNING id`,
      [
        meta.follower_id, meta.brand_id, meta.campaign_id, meta.set_id,
        meta.campaign_influencer_id, meta.offer_id,
        meta.bill_amount, meta.discount_amount, netAmount,
        meta.influencer_commission, meta.platform_fee, meta.brand_net,
        couponCode, returnWindowEndsAt, razorpay_payment_id,
      ]
    );
    transactionId = txRows[0].id;

    // Credit influencer pending_balance in rupees
    await txService.creditInfluencerCommission(client, influencer.id, meta.influencer_commission);
  });

  // Fire notification to influencer
  if (influencer) {
    const commissionRupees = parseFloat(meta.influencer_commission).toFixed(2);
    notificationService.send({
      userId: influencer.user_id,
      type: 'commission.sale',
      title: '\u20B9' + commissionRupees + ' earned!',
      body: `\u20B9${commissionRupees} earned \u2014 sale via ${couponCode || 'your coupon'}`,
      fcmToken: influencer.fcm_token,
      sendSms: false,
    }).catch(e => console.error('[NOTIFY] commission.sale failed:', e.message));
  }

  const txIdShort = transactionId.replace(/-/g, '').slice(-4).toUpperCase();
  const { rows: brandRows } = await db.query(`SELECT business_name FROM brands WHERE id = $1`, [meta.brand_id]);

  return success(res, {
    transaction_id: transactionId,
    reference_code: `INFLX-${txIdShort}`,
    net_amount: netAmount,
    brand_name: brandRows[0]?.business_name,
  });
});

// ── GET /follower/slots ───────────────────────────────────────────────────────

const getSlots = asyncHandler(async (req, res) => {
  const { offer_id, date } = req.query;
  if (!offer_id || !date) {
    throw new AppError('VALIDATION_ERROR', 'offer_id and date are required', 422);
  }
  const slots = await bookingService.getSlots(offer_id, date);
  return success(res, { slots });
});

// ── POST /follower/prebook ────────────────────────────────────────────────────

const initiatePrebook = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { offer_id, campaign_id, set_id, campaign_influencer_id, booking_date, booking_time, guest_count } = req.body;
  if (!campaign_id || !set_id || !campaign_influencer_id || !booking_date || !booking_time) {
    throw new AppError('VALIDATION_ERROR', 'campaign_id, set_id, campaign_influencer_id, booking_date, booking_time are required', 422);
  }

  const record = await txService.validateTracking(campaign_id, set_id, campaign_influencer_id, offer_id || null);

  // Get advance amount — from campaign_offers if exists, otherwise default.
  // Everything is RUPEES post-migration-021.
  let advanceAmount = 200; // default ₹200
  if (offer_id) {
    const { rows: offerRows } = await db.query(
      `SELECT prebook_advance, discount_value FROM campaign_offers WHERE id = $1`,
      [offer_id]
    );
    if (offerRows[0]?.prebook_advance) {
      advanceAmount = parseFloat(offerRows[0].prebook_advance);
    }
  }

  // For car rentals, use token_amount from schema (₹300)
  if (advanceAmount === 200) {
    const tokenAmount = record.offer_config_json?.token_amount;
    if (tokenAmount) advanceAmount = parseFloat(tokenAmount);
  }

  // Check slot availability (skip if no offer_id — car rental doesn't use slots)
  if (offer_id) {
    const slots = await bookingService.getSlots(offer_id, booking_date);
    const slot = slots.find(s => s.time === booking_time);
    if (!slot?.available) {
      throw new AppError('SLOT_FULL', 'This time slot is fully booked', 409);
    }
  }

  const discountPct = parseFloat(record.discount_value || 0);

  const orderId = await txService.createOrder(advanceAmount, {
    type: 'prebook',
    offer_id: offer_id || null, campaign_id, set_id, campaign_influencer_id,
    booking_date, booking_time, guest_count: guest_count || 1,
    advance_amount: advanceAmount, discount_pct: discountPct,
    follower_id: follower.id, brand_id: record.brand_id,
    commission_pct: parseFloat(record.commission_pct || 0),
  });

  return success(res, { razorpay_order_id: orderId, razorpay_key_id: txService.getRazorpayKeyId(), advance_amount: advanceAmount }, 201);
});

// ── POST /follower/prebook/verify ─────────────────────────────────────────────

const verifyPrebook = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { razorpay_order_id, razorpay_payment_id } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id) {
    throw new AppError('VALIDATION_ERROR', 'razorpay_order_id and razorpay_payment_id are required', 422);
  }

  const { amountRupees: advanceAmount, meta } = txService.consumeMockOrder(razorpay_order_id);

  const returnWindowEndsAt = new Date(Date.now() + RETURN_WINDOW_MS);
  const commissionAmount = parseFloat((advanceAmount * meta.commission_pct / 100).toFixed(2));

  const { rows: ciRows } = await db.query(
    `SELECT coupon_code FROM campaign_influencers WHERE id = $1`,
    [meta.campaign_influencer_id]
  );
  const couponCode = ciRows[0]?.coupon_code || null;

  const influencer = await getInfluencerByCiId(meta.campaign_influencer_id);

  let transactionId, bookingId, referenceCode;

  await db.withTransaction(async (client) => {
    const { rows: txRows } = await client.query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, platform_fee, brand_net,
          status, coupon_code_used, return_window_ends_at, razorpay_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,'prebook',$7,0,$7,$8,0,$7,'completed',$9,$10,$11)
       RETURNING id`,
      [
        meta.follower_id, meta.brand_id, meta.campaign_id, meta.set_id,
        meta.campaign_influencer_id, meta.offer_id,
        advanceAmount, commissionAmount, couponCode, returnWindowEndsAt, razorpay_payment_id,
      ]
    );
    transactionId = txRows[0].id;

    referenceCode = bookingService.generateReferenceCode();

    const { rows: bookRows } = await client.query(
      `INSERT INTO follower_bookings
         (transaction_id, booking_date, booking_time, guest_count, reference_code,
          status, advance_paid, balance_due_at_venue)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, 0)
       RETURNING id`,
      [transactionId, meta.booking_date, meta.booking_time, meta.guest_count, referenceCode, advanceAmount]
    );
    bookingId = bookRows[0].id;

    await txService.creditInfluencerCommission(client, influencer.id, commissionAmount);
  });

  const { rows: brandRows } = await db.query(
    `SELECT b.business_name, u.phone AS brand_phone
     FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [meta.brand_id]
  );

  // Notification to follower
  notificationService.send({
    userId: req.user.sub,
    type: 'booking.confirmed',
    title: 'Table booked!',
    body: `Table booked! ${meta.booking_date} ${meta.booking_time} at ${brandRows[0]?.business_name}. Ref: ${referenceCode}`,
    sendSms: true,
    phone: follower.phone,
  }).catch(e => console.error('[NOTIFY] booking.confirmed failed:', e.message));

  return success(res, {
    booking_id: bookingId,
    reference_code: referenceCode,
    booking_date: meta.booking_date,
    booking_time: meta.booking_time,
    advance_paid: advanceAmount,
    balance_due_at_venue: 0,
    brand_name: brandRows[0]?.business_name,
    brand_whatsapp: brandRows[0]?.brand_phone,
  });
});

// ── POST /follower/orders ─────────────────────────────────────────────────────

const placeOrder = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { offer_id, campaign_id, set_id, campaign_influencer_id, items, address_id, delivery_fee } = req.body;
  if (!campaign_id || !set_id || !campaign_influencer_id || !items?.length) {
    throw new AppError('VALIDATION_ERROR', 'campaign_id, set_id, campaign_influencer_id, items are required', 422);
  }

  const record = await txService.validateTracking(campaign_id, set_id, campaign_influencer_id, offer_id || null);

  // Get offer + brand fee
  const { rows: offerRows } = await db.query(
    `SELECT co.*, b.platform_fee_pct FROM campaign_offers co
     JOIN campaigns c ON c.id = co.campaign_id
     JOIN brands b ON b.id = c.brand_id
     WHERE co.id = $1`,
    [offer_id]
  );
  const offer = offerRows[0];
  const discountPct = parseFloat(offer.discount_value || 0);
  const platformFeePct = parseFloat(offer.platform_fee_pct || env.PLATFORM_FEE_PCT);
  const commissionPct = parseFloat(record.commission_pct || 0);
  const deliveryFee   = parseFloat(delivery_fee || 0);   // rupees from client

  // Fetch product prices (brand_products.price is already rupees)
  const productIds = items.map(i => i.product_id);
  const { rows: products } = await db.query(
    `SELECT id, price FROM brand_products WHERE id = ANY($1::uuid[])`,
    [productIds]
  );
  const priceMap = {};
  for (const p of products) {
    priceMap[p.id] = parseFloat(p.price || 0);
  }

  const orderItems = items.map(i => ({
    price: priceMap[i.product_id] || 0,
    quantity: parseInt(i.quantity, 10),
    product_id: i.product_id,
  }));

  const { itemsTotal, discountAmount, netAmount, influencerCommission, platformFee, brandNet } =
    txService.calcOnlineOrder(orderItems, discountPct, commissionPct, platformFeePct, deliveryFee);

  const itemsJson = items.map(i => ({
    product_id: i.product_id,
    quantity: i.quantity,
    price: priceMap[i.product_id] || 0,
  }));

  const orderId = await txService.createOrder(netAmount, {
    type: 'online_order',
    offer_id, campaign_id, set_id, campaign_influencer_id,
    items_total: itemsTotal, discount_amount: discountAmount, net_amount: netAmount,
    influencer_commission: influencerCommission, platform_fee: platformFee, brand_net: brandNet,
    delivery_fee: deliveryFee, address_id, items_json: itemsJson,
    follower_id: follower.id, brand_id: record.brand_id,
    commission_pct: commissionPct,
  });

  return success(res, {
    razorpay_order_id: orderId,
    net_amount: netAmount,
    breakdown: {
      items_total: itemsTotal,
      discount_amount: discountAmount,
      delivery_fee: deliveryFee,
      influencer_commission: influencerCommission,
      platform_fee: platformFee,
      brand_net: brandNet,
    },
  }, 201);
});

// ── POST /follower/orders/verify ──────────────────────────────────────────────

const verifyOrder = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { razorpay_order_id, razorpay_payment_id } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id) {
    throw new AppError('VALIDATION_ERROR', 'razorpay_order_id and razorpay_payment_id are required', 422);
  }

  const { amountRupees: netAmount, meta } = txService.consumeMockOrder(razorpay_order_id);

  const returnWindowEndsAt = new Date(Date.now() + RETURN_WINDOW_MS);
  const commissionAmount = parseFloat(meta.influencer_commission);

  const { rows: ciRows } = await db.query(
    `SELECT coupon_code FROM campaign_influencers WHERE id = $1`,
    [meta.campaign_influencer_id]
  );
  const couponCode = ciRows[0]?.coupon_code || null;

  const influencer = await getInfluencerByCiId(meta.campaign_influencer_id);
  const { rows: brandRows } = await db.query(
    `SELECT b.business_name, u.phone AS brand_phone FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [meta.brand_id]
  );

  const estimatedDelivery = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let transactionId, orderRowId;

  await db.withTransaction(async (client) => {
    const { rows: txRows } = await client.query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, platform_fee, brand_net,
          status, coupon_code_used, return_window_ends_at, razorpay_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,'online_order',$7,$8,$9,$10,$11,$12,'completed',$13,$14,$15)
       RETURNING id`,
      [
        meta.follower_id, meta.brand_id, meta.campaign_id, meta.set_id,
        meta.campaign_influencer_id, meta.offer_id,
        meta.items_total, meta.discount_amount, netAmount,
        commissionAmount, meta.platform_fee, meta.brand_net,
        couponCode, returnWindowEndsAt, razorpay_payment_id,
      ]
    );
    transactionId = txRows[0].id;

    const { rows: orderRows } = await client.query(
      `INSERT INTO follower_orders
         (transaction_id, address_id, order_status, estimated_delivery_date, whatsapp_number, items_json)
       VALUES ($1, $2, 'confirmed', $3, $4, $5)
       RETURNING id`,
      [transactionId, meta.address_id || null, estimatedDelivery, brandRows[0]?.brand_phone, JSON.stringify(meta.items_json)]
    );
    orderRowId = orderRows[0].id;

    await txService.creditInfluencerCommission(client, influencer.id, commissionAmount);
  });

  // Notifications
  notificationService.send({
    userId: req.user.sub,
    type: 'order.confirmed',
    title: 'Order confirmed!',
    body: `Order confirmed! Expected delivery: ${estimatedDelivery}`,
    sendSms: true,
    phone: follower.phone,
  }).catch(e => console.error('[NOTIFY] order.confirmed failed:', e.message));

  return success(res, {
    order_id: orderRowId,
    transaction_id: transactionId,
    estimated_delivery_date: estimatedDelivery,
    brand_contact_whatsapp: brandRows[0]?.brand_phone,
  });
});

// ── GET /follower/orders ──────────────────────────────────────────────────────

const listOrders = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { rows } = await db.query(
    `SELECT fo.*, ft.net_amount, ft.created_at AS purchased_at, b.business_name AS brand_name
     FROM follower_orders fo
     JOIN follower_transactions ft ON ft.id = fo.transaction_id
     JOIN brands b ON b.id = ft.brand_id
     WHERE ft.follower_id = $1
     ORDER BY fo.created_at DESC`,
    [follower.id]
  );

  return success(res, { orders: rows });
});

// ── GET /follower/orders/:id ──────────────────────────────────────────────────

const getOrder = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { rows } = await db.query(
    `SELECT fo.*, ft.net_amount, ft.gross_amount, ft.discount_amount,
            ft.created_at AS purchased_at, b.business_name AS brand_name,
            u_b.phone AS brand_contact
     FROM follower_orders fo
     JOIN follower_transactions ft ON ft.id = fo.transaction_id
     JOIN brands b ON b.id = ft.brand_id
     JOIN users u_b ON u_b.id = b.user_id
     WHERE fo.id = $1 AND ft.follower_id = $2`,
    [req.params.id, follower.id]
  );

  if (!rows[0]) throw new AppError('NOT_FOUND', 'Order not found', 404);
  return success(res, { order: rows[0] });
});

// ── PATCH /follower/orders/:id/status ────────────────────────────────────────

const updateOrderStatus = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { id } = req.params;
  const { order_status } = req.body;

  const VALID_STATUSES = ['confirmed', 'dispatched', 'delivered'];
  if (!VALID_STATUSES.includes(order_status)) {
    throw new AppError('VALIDATION_ERROR', `order_status must be one of: ${VALID_STATUSES.join(', ')}`, 422);
  }

  // Verify order belongs to this brand
  const { rows: existing } = await db.query(
    `SELECT fo.*, ft.follower_id, u_f.id AS follower_user_id, u_f.fcm_token
     FROM follower_orders fo
     JOIN follower_transactions ft ON ft.id = fo.transaction_id
     JOIN brands b ON b.id = ft.brand_id
     JOIN followers f ON f.id = ft.follower_id
     JOIN users u_f ON u_f.id = f.user_id
     WHERE fo.id = $1 AND b.user_id = $2`,
    [id, req.user.sub]
  );

  if (!existing[0]) throw new AppError('NOT_FOUND', 'Order not found or access denied', 404);

  const updates = { order_status };
  if (order_status === 'dispatched') updates.dispatched_at = new Date();
  if (order_status === 'delivered') updates.delivered_at = new Date();

  const { rows } = await db.query(
    `UPDATE follower_orders SET
       order_status  = $1,
       dispatched_at = COALESCE($2, dispatched_at),
       delivered_at  = COALESCE($3, delivered_at)
     WHERE id = $4
     RETURNING *`,
    [order_status, updates.dispatched_at || null, updates.delivered_at || null, id]
  );

  // Notify follower
  const followerUserId = existing[0].follower_user_id;
  const msgMap = {
    dispatched: 'Your order has been dispatched!',
    delivered: 'Your order has been delivered!',
  };
  if (msgMap[order_status]) {
    notificationService.send({
      userId: followerUserId,
      type: `order.${order_status}`,
      title: msgMap[order_status],
      body: msgMap[order_status],
      fcmToken: existing[0].fcm_token,
    }).catch(e => console.error('[NOTIFY] order status failed:', e.message));
  }

  return success(res, { order: rows[0] });
});

module.exports = {
  initiatePayAtStore,
  verifyPayAtStore,
  getSlots,
  initiatePrebook,
  verifyPrebook,
  placeOrder,
  verifyOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
};
