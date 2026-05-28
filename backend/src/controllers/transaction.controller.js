'use strict';

/**
 * transaction.controller.js
 * Phase 4 — Blocks B, C, D
 *
 * POST /follower/pay-at-store
 * POST /follower/pay-at-store/verify
 * GET  /follower/slots
 * POST /follower/prebook                       (table / slot — booking_type optional, defaults 'table')
 * POST /follower/prebook/verify
 * POST /follower/prebook-daterange             (date_range — car_rental, hotels)
 * POST /follower/prebook-daterange/verify
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
const offerService = require('../services/offer.service');
const pricingService = require('../services/pricing.service');
const settlementService = require('../services/settlement.service');

// ── Conversion-flow helpers (Tier-1) ─────────────────────────────────────────

/**
 * Fetch base prices for a list of product IDs and return a Map<id, rupees>.
 * Used by the offer parser. Skips inactive products.
 */
async function fetchPriceMap(productIds) {
  const map = new Map();
  if (!productIds || productIds.length === 0) return map;
  const { rows } = await db.query(
    `SELECT id, price FROM brand_products WHERE id = ANY($1::uuid[]) AND is_active = true`,
    [productIds]
  );
  for (const r of rows) map.set(r.id, parseFloat(r.price || 0));
  return map;
}

/**
 * Fetch product metadata (section/category) for category-scoped offers.
 * Returns Map<product_id, { section }>. Used by offer.service.js scope
 * filtering when an offer is scoped to a specific category like
 * "Main Course" or "Hair Women".
 */
async function fetchProductMetaMap(productIds) {
  const map = new Map();
  if (!productIds || productIds.length === 0) return map;
  const { rows } = await db.query(
    `SELECT id, section FROM brand_products WHERE id = ANY($1::uuid[]) AND is_active = true`,
    [productIds]
  );
  for (const r of rows) map.set(r.id, { section: r.section });
  return map;
}

/**
 * Fetch variant override prices for items that include variant_id.
 * Returns Map<variant_id, override_price_rupees | base_resolved>.
 * Used by the offer parser via lineItemPrice() so variant-level pricing
 * (fashion's size×color matrix) is honored at checkout — not just the base
 * brand_products.price.
 */
async function fetchVariantPriceMap(variantIds) {
  const map = new Map();
  if (!variantIds || variantIds.length === 0) return map;
  const { rows } = await db.query(
    `SELECT pv.id, pv.price_override, bp.price AS product_price
       FROM product_variants pv
       JOIN brand_products bp ON bp.id = pv.product_id
      WHERE pv.id = ANY($1::uuid[]) AND pv.is_active = true`,
    [variantIds]
  );
  for (const r of rows) {
    map.set(r.id, r.price_override != null ? parseFloat(r.price_override) : parseFloat(r.product_price || 0));
  }
  return map;
}

/**
 * Build the resolveOfferDiscount() input from a validateTracking record + items.
 * Centralizes the "validateTracking returns rich record → offer parser input"
 * translation so all 4 transaction sites use the same shape.
 */
async function computeOfferDiscount({ trackingRecord, items, billAmount }) {
  // Item set: validate, gather variant_ids
  const safeItems = (items || []).map(i => ({
    product_id: i.product_id,
    variant_id: i.variant_id || null,
    quantity: Number(i.quantity || 1),
  }));

  // Build price maps if items are present
  let priceMap = new Map();
  let variantPriceMap = new Map();
  if (safeItems.length > 0) {
    const productIds = [...new Set(safeItems.map(i => i.product_id).filter(Boolean))];
    const variantIds = [...new Set(safeItems.map(i => i.variant_id).filter(Boolean))];
    [priceMap, variantPriceMap] = await Promise.all([
      fetchPriceMap(productIds),
      fetchVariantPriceMap(variantIds),
    ]);
  }

  return offerService.resolveOfferDiscount({
    offerType: trackingRecord.ci_offer_type,
    offerConfig: trackingRecord.offer_config_json,
    items: safeItems,
    priceMap,
    variantPriceMap,
    billAmount,
  });
}

/**
 * Resolve the at-venue discount % when a prebook is created against a
 * percentage-style offer. This is what the customer "earns" at the venue;
 * the new "Pay Balance via INFLX" flow re-applies it.
 *
 * Returns 0 when offer isn't a simple percentage (Volume/BOGO/Bundle/Free
 * gift get applied at checkout instead, not at the venue).
 */
function resolveAtVenueDiscountPct(trackingRecord) {
  const t = offerService.normalizeOfferType(trackingRecord.ci_offer_type);
  if (t !== 'discount') return 0;
  const cfg = trackingRecord.offer_config_json || {};
  if ((cfg.sub_type || 'pct') !== 'pct') return 0;
  const v = Number(cfg.value || 0);
  return v > 0 ? v : 0;
}

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

/**
 * Phase Salon-3 Q3 — resolve product_id for a follower_transactions row.
 *
 * Priority order:
 *   1. Mobile-provided product_id (user/screen-level intent — SlotPickerScreen
 *      passes service.id, CarBookingScreen passes vehicle.id).
 *   2. Single-product offer (campaign_offers.products_json has exactly 1 ID).
 *   3. null — brand-level offer, multi-product offer, restaurant table prebook,
 *      or pay-at-store without a product picked. Null is honest, not a failure.
 *
 * Handles two products_json shapes defensively: array of UUID strings, OR
 * array of objects with .product_id / .id keys.
 *
 * Caller passes either the global `db` module or a withTransaction client —
 * both expose .query() so the helper is agnostic.
 */
async function resolveProductId(queryRunner, offerId, providedProductId) {
  if (providedProductId) return providedProductId;
  if (!offerId) return null;
  const { rows } = await queryRunner.query(
    `SELECT products_json FROM campaign_offers WHERE id = $1`,
    [offerId]
  );
  const pj = rows[0]?.products_json;
  if (!Array.isArray(pj)) return null;
  const ids = pj
    .map(x => typeof x === 'string' ? x : (x?.product_id || x?.id))
    .filter(Boolean);
  return ids.length === 1 ? ids[0] : null;
}

// ── POST /follower/pay-at-store ───────────────────────────────────────────────

const initiatePayAtStore = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const {
    offer_id, campaign_id, set_id, campaign_influencer_id, bill_amount,
    product_id, variant_id,
    prebook_booking_id,                         // Q2 flow — balance-pay against an existing prebook
  } = req.body;

  if (!bill_amount || parseFloat(bill_amount) <= 0) {
    throw new AppError('VALIDATION_ERROR', 'bill_amount must be a positive number (rupees)', 422, 'bill_amount');
  }
  if (!campaign_id || !set_id || !campaign_influencer_id) {
    throw new AppError('VALIDATION_ERROR', 'campaign_id, set_id, campaign_influencer_id are required', 422);
  }

  // Validate tracking IDs (offer_id is optional — may not exist for CI-based offers)
  const record = await txService.validateTracking(campaign_id, set_id, campaign_influencer_id, offer_id || null);

  const billAmount = parseFloat(bill_amount);

  // Q2 flow — pay-at-store linked to a prebook. Look up the booking + token
  // already paid; this txn covers the balance.
  let tokenPaid = 0;
  let bookingForLink = null;
  if (prebook_booking_id) {
    const { rows: bookRows } = await db.query(
      `SELECT fb.id, fb.advance_paid, fb.transaction_id,
              ft.follower_id AS booking_follower_id,
              ft.campaign_influencer_id AS booking_ci_id
         FROM follower_bookings fb
         JOIN follower_transactions ft ON ft.id = fb.transaction_id
        WHERE fb.id = $1`,
      [prebook_booking_id]
    );
    bookingForLink = bookRows[0];
    if (!bookingForLink) {
      throw new AppError('NOT_FOUND', 'Prebook booking not found', 404);
    }
    if (bookingForLink.booking_follower_id !== follower.id) {
      throw new AppError('FORBIDDEN', 'This booking does not belong to you', 403);
    }
    if (bookingForLink.booking_ci_id !== campaign_influencer_id) {
      throw new AppError('VALIDATION_ERROR', 'Tracking does not match the prebook', 422);
    }
    tokenPaid = parseFloat(bookingForLink.advance_paid || 0);
  }

  // Tier-1 fix: discount via offer.service.js parser, not raw discount_value.
  // For pay-at-store: items array is empty; the offer parser falls back to
  // billAmount-based calc (only Discount type with sub_type pct/flat applies).
  // Volume/BOGO/Bundle/Free-gift offers can't be applied to a free-form bill;
  // they need cart items. Brand should pair those with online_order availing
  // mode, not pay_at_store.
  const offerResult = await computeOfferDiscount({
    trackingRecord: record,
    items: [],
    billAmount,
  });
  const discountAmount = parseFloat(offerResult.discount_amount || 0);

  const commissionPct = parseFloat(record.commission_pct || 0);

  // Q3 corrected math:
  //   discountedTotal = bill - discount
  //   amountToCharge  = discountedTotal - tokenPaid (when linked to prebook)
  // gross_amount on the txn record = bill - tokenPaid (the portion this txn
  // covers pre-discount); discount allocated entirely here since token was
  // full-price.
  const discountedTotal = parseFloat((billAmount - discountAmount).toFixed(2));
  const amountToCharge = parseFloat((discountedTotal - tokenPaid).toFixed(2));
  if (amountToCharge < 0) {
    throw new AppError('VALIDATION_ERROR', 'Token already covers the discounted total — nothing to charge', 422);
  }
  const grossForTxn = parseFloat((billAmount - tokenPaid).toFixed(2));
  const netAmount = amountToCharge;
  const influencerCommission = parseFloat((netAmount * commissionPct / 100).toFixed(2));

  // L3 marketplace fee (Phase A5): pricing.service classifies the path
  // (direct / influencer_direct / influencer_attributed) and resolves the
  // category × path percentage. Falls back to brands.platform_fee_pct
  // (legacy 8% default) when category doesn't map.
  const l3 = await pricingService.computeL3OnFollowerTxn({
    client:                db,
    brandId:               record.brand_id,
    followerId:            follower.id,
    campaignInfluencerId:  campaign_influencer_id,
    brandCategory:         record.brand_category,
    netAmount,
  });
  const platformFee = l3.fee_amount;
  const brandNet    = parseFloat((netAmount - influencerCommission - platformFee).toFixed(2));

  // Create Razorpay order — stash L3 classification in meta so verifyOrder
  // can write attribution_clicks atomically after the txn lands.
  const orderId = await txService.createOrder(amountToCharge, {
    type: 'pay_at_store',
    offer_id, campaign_id, set_id, campaign_influencer_id,
    bill_amount: billAmount,
    gross_for_txn: grossForTxn,
    discount_amount: discountAmount,
    influencer_commission: influencerCommission, platform_fee: platformFee, brand_net: brandNet,
    follower_id: follower.id, brand_id: record.brand_id,
    product_id: product_id || null,
    variant_id: variant_id || null,             // Tier-1 fashion attribution
    offer_type: record.ci_offer_type || null,   // denormalized analytics dim
    prebook_booking_id: prebook_booking_id || null,
    token_paid: tokenPaid,
    // L3 (Phase A5) classification — stashed for verifyOrder attribution write
    l3_path:          l3.path,
    l3_category_key:  l3.category_key,
    l3_source:        l3.source,
    l3_influencer_id: l3.influencer_id,
  });

  return success(res, {
    razorpay_order_id: orderId,
    razorpay_key_id: txService.getRazorpayKeyId(),
    bill_amount: billAmount,
    discount_amount: discountAmount,
    discounted_total: discountedTotal,
    token_paid: tokenPaid,
    amount_to_charge: amountToCharge,
    discount_reason: offerResult.reason,
    net_amount: netAmount,
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

  // Wave 3 commit 2 — commission-release window is per-category (admin-editable),
  // falling back to the global default. Replaces the flat RETURN_WINDOW_MS.
  const returnWindowEndsAt = await settlementService.resolveReturnWindowEndsAt(db, meta.brand_id);

  // Get coupon code
  const { rows: ciRows } = await db.query(
    `SELECT coupon_code FROM campaign_influencers WHERE id = $1`,
    [meta.campaign_influencer_id]
  );
  const couponCode = ciRows[0]?.coupon_code || null;

  let transactionId;
  const influencer = await getInfluencerByCiId(meta.campaign_influencer_id);

  // Phase Salon-3 Q3 — resolve product_id (mobile-provided or single-product offer)
  const productId = await resolveProductId(db, meta.offer_id, meta.product_id);

  // Tier-1 conversion fix: gross is the portion this txn covers pre-discount
  // (bill - token_paid); when there's no linked prebook, gross = bill_amount.
  // The Razorpay-charged amount is netAmount.
  const txGross = meta.gross_for_txn != null ? meta.gross_for_txn : meta.bill_amount;

  await db.withTransaction(async (client) => {
    // Create follower_transaction — all money columns in rupees
    const { rows: txRows } = await client.query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id, product_id,
          variant_id, offer_type, prebook_booking_id,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, marketplace_fee_amount, brand_net,
          status, coupon_code_used, return_window_ends_at, razorpay_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pay_at_store',$11,$12,$13,$14,$15,$16,'completed',$17,$18,$19)
       RETURNING id`,
      [
        meta.follower_id, meta.brand_id, meta.campaign_id, meta.set_id,
        meta.campaign_influencer_id, meta.offer_id, productId,
        meta.variant_id || null, meta.offer_type || null, meta.prebook_booking_id || null,
        txGross, meta.discount_amount, netAmount,
        meta.influencer_commission, meta.platform_fee, meta.brand_net,
        couponCode, returnWindowEndsAt, razorpay_payment_id,
      ]
    );
    transactionId = txRows[0].id;

    // Credit influencer pending_balance in rupees
    await txService.creditInfluencerCommission(client, influencer.id, meta.influencer_commission);

    // L3 attribution write (Phase A5) — on Path B (influencer_direct) transactions
    // record a 30-day attribution window so future direct buys by this follower
    // from this brand fall into Path C and the influencer keeps earning credit.
    if (meta.l3_path === 'influencer_direct' && meta.l3_influencer_id) {
      await client.query(
        `INSERT INTO attribution_clicks
           (follower_id, influencer_id, brand_id, campaign_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '30 days')`,
        [meta.follower_id, meta.l3_influencer_id, meta.brand_id, meta.campaign_id]
      );
    }
  });

  // Wave 3 commit 2 — settle the brand's net share (per-brand TCS + commission
  // GST + Razorpay Route transfer). Best-effort + post-commit: never breaks the
  // purchase the customer already paid for.
  await settlementService.settleCommerceTransaction(db, transactionId)
    .catch(e => console.error('[settlement] failed:', e.message));

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

  // Phase Salon-3 \u2014 follow-creator prompt to the follower
  if (influencer) {
    notificationService.notifyFollowCreatorPrompt({
      followerUserId: req.user.sub,
      influencer,
      brandName: brandRows[0]?.business_name,
    }).catch(e => console.error('[NOTIFY] follow_creator_prompt failed:', e.message));
  }

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

  const { offer_id, campaign_id, set_id, campaign_influencer_id, booking_date, booking_time, guest_count, product_id } = req.body;
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

  // Tier-1: at_venue_discount_pct captures the % the customer earned to
  // re-apply via the new "Pay Balance via INFLX" flow at venue. Returns 0
  // for non-percentage offers (those would need cart items to compute, which
  // a prebook doesn't have at booking time).
  const atVenueDiscountPct = resolveAtVenueDiscountPct(record);

  const orderId = await txService.createOrder(advanceAmount, {
    type: 'prebook',
    offer_id: offer_id || null, campaign_id, set_id, campaign_influencer_id,
    booking_date, booking_time, guest_count: guest_count || 1,
    advance_amount: advanceAmount,
    follower_id: follower.id, brand_id: record.brand_id,
    commission_pct: parseFloat(record.commission_pct || 0),
    product_id: product_id || null,
    offer_type: record.ci_offer_type || null,
    at_venue_discount_pct: atVenueDiscountPct,
  });

  return success(res, {
    razorpay_order_id: orderId,
    razorpay_key_id: txService.getRazorpayKeyId(),
    advance_amount: advanceAmount,
    at_venue_discount_pct: atVenueDiscountPct,
  }, 201);
});

// ── POST /follower/prebook/verify ─────────────────────────────────────────────

const verifyPrebook = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { razorpay_order_id, razorpay_payment_id, booking_type, stylist_id, notes } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id) {
    throw new AppError('VALIDATION_ERROR', 'razorpay_order_id and razorpay_payment_id are required', 422);
  }

  // booking_type: client may declare 'table' | 'slot' | 'appointment'.
  // Default 'table' matches today's de facto producer (restaurant) for old
  // clients that don't send the field. New mobile clients should send the
  // explicit value. date_range bookings go through the dedicated
  // /prebook-daterange endpoint, not this one.
  //
  // Unrecognized values are coerced to 'table' but log a warning so buggy
  // clients surface in observability rather than producing silently
  // mislabeled rows. Common case to watch for: a client mistakenly posting
  // booking_type='date_range' here instead of using /prebook-daterange.
  let bookingTypeValue = 'table';
  if (booking_type) {
    if (['table', 'slot', 'appointment'].includes(booking_type)) {
      bookingTypeValue = booking_type;
    } else {
      console.warn(
        `[verifyPrebook] Unrecognized booking_type "${booking_type}" — ` +
        `defaulting to "table". If this was intended as date_range, ` +
        `use POST /follower/prebook-daterange instead.`
      );
    }
  }

  const { amountRupees: advanceAmount, meta } = txService.consumeMockOrder(razorpay_order_id);

  // Wave 3 commit 2 — commission-release window is per-category (admin-editable),
  // falling back to the global default. Replaces the flat RETURN_WINDOW_MS.
  const returnWindowEndsAt = await settlementService.resolveReturnWindowEndsAt(db, meta.brand_id);
  const commissionAmount = parseFloat((advanceAmount * meta.commission_pct / 100).toFixed(2));
  // Prebook has no platform fee line today (always 0) — match pay_at_store /
  // online_order math: brand_net = net_amount − commission − platform_fee.
  // Previously the INSERT reused advanceAmount for brand_net, so the brand
  // appeared to keep the full advance without the commission being deducted.
  const platformFeeAmount = 0;
  const brandNetAmount = parseFloat((advanceAmount - commissionAmount - platformFeeAmount).toFixed(2));

  const { rows: ciRows } = await db.query(
    `SELECT coupon_code FROM campaign_influencers WHERE id = $1`,
    [meta.campaign_influencer_id]
  );
  const couponCode = ciRows[0]?.coupon_code || null;

  const influencer = await getInfluencerByCiId(meta.campaign_influencer_id);

  // Phase Salon-3 Q3 — resolve product_id (mobile-provided or single-product offer)
  const productId = await resolveProductId(db, meta.offer_id, meta.product_id);

  // Wave 5D — restaurant table bookings enter the brand-review queue as
  // 'pending' (restaurant confirms/rejects in BookingsInbox) rather than
  // auto-confirming. booking_status stays 'confirmed' (payment cleared,
  // slot held) — brand_status is the independent review dimension from
  // migration 052. Other categories / booking types keep brand_status
  // NULL → treated as confirmed everywhere (legacy UX preserved).
  const { rows: catRows } = await db.query(
    `SELECT category FROM brands WHERE id = $1`, [meta.brand_id]
  );
  const brandCategory = catRows[0]?.category || null;
  const brandStatusValue =
    (brandCategory === 'restaurant' && bookingTypeValue === 'table') ? 'pending' : null;

  let transactionId, bookingId, referenceCode;

  await db.withTransaction(async (client) => {
    const { rows: txRows } = await client.query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id, product_id,
          variant_id, offer_type,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, marketplace_fee_amount, brand_net,
          status, coupon_code_used, return_window_ends_at, razorpay_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'prebook',$10,0,$10,$11,$12,$13,'completed',$14,$15,$16)
       RETURNING id`,
      [
        meta.follower_id, meta.brand_id, meta.campaign_id, meta.set_id,
        meta.campaign_influencer_id, meta.offer_id, productId,
        meta.variant_id || null, meta.offer_type || null,
        advanceAmount, commissionAmount, platformFeeAmount, brandNetAmount,
        couponCode, returnWindowEndsAt, razorpay_payment_id,
      ]
    );
    transactionId = txRows[0].id;

    referenceCode = bookingService.generateReferenceCode();

    const { rows: bookRows } = await client.query(
      `INSERT INTO follower_bookings
         (transaction_id, booking_type, booking_date, booking_time, guest_count, reference_code,
          status, advance_paid, balance_due_at_venue, stylist_id, notes,
          at_venue_discount_pct, brand_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, 0, $8, $9, $10, $11)
       RETURNING id`,
      [
        transactionId, bookingTypeValue, meta.booking_date, meta.booking_time, meta.guest_count,
        referenceCode, advanceAmount, stylist_id || null, notes || null,
        meta.at_venue_discount_pct || 0, brandStatusValue,
      ]
    );
    bookingId = bookRows[0].id;

    await txService.creditInfluencerCommission(client, influencer.id, commissionAmount);

    // L3 attribution write (Phase A5) — Path B (CI present) opens a
    // 30-day attribution window so future direct buys by this follower
    // from this brand fall into Path C and the influencer keeps earning.
    if (meta.campaign_influencer_id && influencer?.id) {
      await client.query(
        `INSERT INTO attribution_clicks
           (follower_id, influencer_id, brand_id, campaign_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '30 days')`,
        [meta.follower_id, influencer.id, meta.brand_id, meta.campaign_id]
      );
    }
  });

  // Wave 3 commit 2 — settle the brand's net share (per-brand TCS + commission
  // GST + Razorpay Route transfer). Best-effort + post-commit: never breaks the
  // purchase the customer already paid for.
  await settlementService.settleCommerceTransaction(db, transactionId)
    .catch(e => console.error('[settlement] failed:', e.message));

  const { rows: brandRows } = await db.query(
    `SELECT b.business_name, u.phone AS brand_phone
     FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [meta.brand_id]
  );

  // Notification to follower — Wave 5D: pending restaurant bookings are
  // "requested", not "booked", until the restaurant confirms.
  const isPending = brandStatusValue === 'pending';
  notificationService.send({
    userId: req.user.sub,
    type: isPending ? 'booking.requested' : 'booking.confirmed',
    title: isPending ? 'Reservation requested' : 'Table booked!',
    body: isPending
      ? `Reservation requested at ${brandRows[0]?.business_name} for ${meta.booking_date} ${meta.booking_time}. We'll notify you the moment they confirm. Ref: ${referenceCode}`
      : `Table booked! ${meta.booking_date} ${meta.booking_time} at ${brandRows[0]?.business_name}. Ref: ${referenceCode}`,
    sendSms: true,
    phone: follower.phone,
  }).catch(e => console.error('[NOTIFY] booking notify failed:', e.message));

  // Phase Salon-3 — follow-creator prompt to the follower
  if (influencer) {
    notificationService.notifyFollowCreatorPrompt({
      followerUserId: req.user.sub,
      influencer,
      brandName: brandRows[0]?.business_name,
    }).catch(e => console.error('[NOTIFY] follow_creator_prompt failed:', e.message));
  }

  return success(res, {
    booking_id: bookingId,
    reference_code: referenceCode,
    booking_date: meta.booking_date,
    booking_time: meta.booking_time,
    advance_paid: advanceAmount,
    balance_due_at_venue: 0,
    brand_name: brandRows[0]?.business_name,
    brand_whatsapp: brandRows[0]?.brand_phone,
    // Wave 5D — surface the review state so the mobile confirmation
    // screen renders "Requested · awaiting confirmation" vs "Confirmed".
    brand_status: brandStatusValue,        // 'pending' | null
    booking: { reference_code: referenceCode, brand_status: brandStatusValue },
  });
});

// ── POST /follower/prebook-daterange ──────────────────────────────────────────
//
// Date-range bookings (car_rental today; hotel/homestay/function_hall later).
// Mirror of initiatePrebook + verifyPrebook but the booking has pickup_date /
// return_date / duration_days / pickup_type instead of booking_date /
// booking_time / guest_count. Replaces the legacy shoehorn through
// /follower/prebook (which serialized duration + pickup into a `notes`
// string). Reuses validateTracking, createOrder, verifyPaymentSignature,
// creditInfluencerCommission unchanged.

const initiatePrebookDateRange = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const {
    offer_id, campaign_id, set_id, campaign_influencer_id,
    pickup_date, return_date, duration_days, pickup_type, product_id,
  } = req.body;

  if (!campaign_id || !set_id || !campaign_influencer_id || !pickup_date || !return_date) {
    throw new AppError(
      'VALIDATION_ERROR',
      'campaign_id, set_id, campaign_influencer_id, pickup_date, return_date are required',
      422
    );
  }

  const record = await txService.validateTracking(
    campaign_id, set_id, campaign_influencer_id, offer_id || null
  );

  // Resolve advance amount (token). Same fallback chain as initiatePrebook:
  // campaign_offers.prebook_advance > campaign_influencers.offer_config_json.token_amount > default.
  let advanceAmount = 200;
  if (offer_id) {
    const { rows: offerRows } = await db.query(
      `SELECT prebook_advance FROM campaign_offers WHERE id = $1`,
      [offer_id]
    );
    if (offerRows[0]?.prebook_advance) advanceAmount = parseFloat(offerRows[0].prebook_advance);
  }
  if (advanceAmount === 200) {
    const tokenAmount = record.offer_config_json?.token_amount;
    if (tokenAmount) advanceAmount = parseFloat(tokenAmount);
  }

  // Tier-1: at_venue_discount_pct captures the % the customer earned for
  // the new "Pay Balance via INFLX" flow at pickup.
  const atVenueDiscountPct = resolveAtVenueDiscountPct(record);

  const orderId = await txService.createOrder(advanceAmount, {
    type: 'prebook_daterange',
    offer_id: offer_id || null, campaign_id, set_id, campaign_influencer_id,
    pickup_date, return_date,
    duration_days: duration_days || null,
    pickup_type: pickup_type || 'garage',
    advance_amount: advanceAmount,
    follower_id: follower.id, brand_id: record.brand_id,
    commission_pct: parseFloat(record.commission_pct || 0),
    product_id: product_id || null,
    offer_type: record.ci_offer_type || null,
    at_venue_discount_pct: atVenueDiscountPct,
  });

  return success(res, {
    razorpay_order_id: orderId,
    razorpay_key_id: txService.getRazorpayKeyId(),
    advance_amount: advanceAmount,
    at_venue_discount_pct: atVenueDiscountPct,
  }, 201);
});

// ── POST /follower/prebook-daterange/verify ──────────────────────────────────

const verifyPrebookDateRange = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { razorpay_order_id, razorpay_payment_id } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id) {
    throw new AppError('VALIDATION_ERROR', 'razorpay_order_id and razorpay_payment_id are required', 422);
  }

  const { amountRupees: advanceAmount, meta } = txService.consumeMockOrder(razorpay_order_id);

  // Wave 3 commit 2 — commission-release window is per-category (admin-editable),
  // falling back to the global default. Replaces the flat RETURN_WINDOW_MS.
  const returnWindowEndsAt = await settlementService.resolveReturnWindowEndsAt(db, meta.brand_id);
  const commissionAmount = parseFloat((advanceAmount * meta.commission_pct / 100).toFixed(2));
  const platformFeeAmount = 0;
  const brandNetAmount = parseFloat((advanceAmount - commissionAmount - platformFeeAmount).toFixed(2));

  const { rows: ciRows } = await db.query(
    `SELECT coupon_code FROM campaign_influencers WHERE id = $1`,
    [meta.campaign_influencer_id]
  );
  const couponCode = ciRows[0]?.coupon_code || null;

  const influencer = await getInfluencerByCiId(meta.campaign_influencer_id);

  let transactionId, bookingId, referenceCode;

  // Phase Salon-3 Q3 — resolve product_id (mobile-provided or single-product offer)
  const productId = await resolveProductId(db, meta.offer_id, meta.product_id);

  await db.withTransaction(async (client) => {
    const { rows: txRows } = await client.query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id, product_id,
          variant_id, offer_type,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, marketplace_fee_amount, brand_net,
          status, coupon_code_used, return_window_ends_at, razorpay_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'prebook',$10,0,$10,$11,$12,$13,'completed',$14,$15,$16)
       RETURNING id`,
      [
        meta.follower_id, meta.brand_id, meta.campaign_id, meta.set_id,
        meta.campaign_influencer_id, meta.offer_id, productId,
        meta.variant_id || null, meta.offer_type || null,
        advanceAmount, commissionAmount, platformFeeAmount, brandNetAmount,
        couponCode, returnWindowEndsAt, razorpay_payment_id,
      ]
    );
    transactionId = txRows[0].id;

    referenceCode = bookingService.generateReferenceCode();

    const { rows: bookRows } = await client.query(
      `INSERT INTO follower_bookings
         (transaction_id, booking_type,
          pickup_date, return_date, duration_days, pickup_type,
          reference_code, status, advance_paid, balance_due_at_venue,
          at_venue_discount_pct)
       VALUES ($1, 'date_range', $2, $3, $4, $5, $6, 'confirmed', $7, 0, $8)
       RETURNING id`,
      [
        transactionId,
        meta.pickup_date, meta.return_date, meta.duration_days, meta.pickup_type,
        referenceCode, advanceAmount,
        meta.at_venue_discount_pct || 0,
      ]
    );
    bookingId = bookRows[0].id;

    await txService.creditInfluencerCommission(client, influencer.id, commissionAmount);

    // L3 attribution write (Phase A5) — Path B (CI present) opens a
    // 30-day attribution window so future direct buys by this follower
    // from this brand fall into Path C and the influencer keeps earning.
    if (meta.campaign_influencer_id && influencer?.id) {
      await client.query(
        `INSERT INTO attribution_clicks
           (follower_id, influencer_id, brand_id, campaign_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '30 days')`,
        [meta.follower_id, influencer.id, meta.brand_id, meta.campaign_id]
      );
    }
  });

  // Wave 3 commit 2 — settle the brand's net share (per-brand TCS + commission
  // GST + Razorpay Route transfer). Best-effort + post-commit: never breaks the
  // purchase the customer already paid for.
  await settlementService.settleCommerceTransaction(db, transactionId)
    .catch(e => console.error('[settlement] failed:', e.message));

  const { rows: brandRows } = await db.query(
    `SELECT b.business_name, u.phone AS brand_phone
     FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [meta.brand_id]
  );

  notificationService.send({
    userId: req.user.sub,
    type: 'booking.confirmed',
    title: 'Booking confirmed!',
    body: `Pickup ${meta.pickup_date}, return ${meta.return_date} at ${brandRows[0]?.business_name}. Ref: ${referenceCode}`,
    sendSms: true,
    phone: follower.phone,
  }).catch(e => console.error('[NOTIFY] booking.confirmed (daterange) failed:', e.message));

  // Phase Salon-3 — follow-creator prompt to the follower
  if (influencer) {
    notificationService.notifyFollowCreatorPrompt({
      followerUserId: req.user.sub,
      influencer,
      brandName: brandRows[0]?.business_name,
    }).catch(e => console.error('[NOTIFY] follow_creator_prompt failed:', e.message));
  }

  return success(res, {
    booking_id: bookingId,
    reference_code: referenceCode,
    booking_type: 'date_range',
    pickup_date: meta.pickup_date,
    return_date: meta.return_date,
    duration_days: meta.duration_days,
    pickup_type: meta.pickup_type,
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

  // Build base + variant price maps + product metadata.
  // productMetaMap surfaces brand_products.section so category-scoped
  // discounts (e.g. "10% off Main Course") can filter the cart correctly.
  const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))];
  const variantIds = [...new Set(items.map(i => i.variant_id).filter(Boolean))];
  const [priceMap, variantPriceMap, productMetaMap] = await Promise.all([
    fetchPriceMap(productIds),
    fetchVariantPriceMap(variantIds),
    fetchProductMetaMap(productIds),
  ]);

  const safeItems = items.map(i => ({
    product_id: i.product_id,
    variant_id: i.variant_id || null,
    quantity: parseInt(i.quantity, 10),
  }));

  // Discount via offer.service.js parser. Handles all 5 offer mechanics
  // (Discount / Volume / BOGO / Bundle / Free gift) with the 3-tier scope
  // model (store / category / products) for Discount + Volume.
  const offerResult = offerService.resolveOfferDiscount({
    offerType: record.ci_offer_type,
    offerConfig: record.offer_config_json,
    items: safeItems,
    priceMap,
    variantPriceMap,
    productMetaMap,
  });

  const discountAmount = parseFloat(offerResult.discount_amount || 0);
  const commissionPct  = parseFloat(record.commission_pct || 0);
  const deliveryFee    = parseFloat(delivery_fee || 0);

  const itemsTotal = offerService.itemsTotal(safeItems, priceMap, variantPriceMap);
  const discountedItems = parseFloat((itemsTotal - discountAmount).toFixed(2));
  const netAmount = parseFloat((discountedItems + deliveryFee).toFixed(2));
  const influencerCommission = parseFloat((discountedItems * commissionPct / 100).toFixed(2));

  // L3 marketplace fee (Phase A5) — applied on discountedItems (matches
  // legacy: delivery_fee is brand pass-through, fee charged on item revenue only)
  const l3 = await pricingService.computeL3OnFollowerTxn({
    client:                db,
    brandId:               record.brand_id,
    followerId:            follower.id,
    campaignInfluencerId:  campaign_influencer_id,
    brandCategory:         record.brand_category,
    netAmount:             discountedItems,
  });
  const platformFee = l3.fee_amount;
  const brandNet    = parseFloat((discountedItems - influencerCommission - platformFee).toFixed(2));

  // items_json: per-item snapshot for follower_orders. Now carries variant_id
  // so returns + per-variant analytics work end-to-end.
  const itemsJson = safeItems.map(i => ({
    product_id: i.product_id,
    variant_id: i.variant_id,
    quantity: i.quantity,
    price: offerService.lineItemPrice(i, priceMap, variantPriceMap),
  }));

  const orderId = await txService.createOrder(netAmount, {
    type: 'online_order',
    offer_id, campaign_id, set_id, campaign_influencer_id,
    items_total: itemsTotal, discount_amount: discountAmount, net_amount: netAmount,
    influencer_commission: influencerCommission, platform_fee: platformFee, brand_net: brandNet,
    delivery_fee: deliveryFee, address_id, items_json: itemsJson,
    follower_id: follower.id, brand_id: record.brand_id,
    commission_pct: commissionPct,
    offer_type: record.ci_offer_type || null,
    discount_reason: offerResult.reason,
    adjustments: offerResult.adjustments || null,
    // L3 (Phase A5) classification — stashed for verifyOrder attribution write
    l3_path:          l3.path,
    l3_category_key:  l3.category_key,
    l3_source:        l3.source,
    l3_influencer_id: l3.influencer_id,
  });

  return success(res, {
    razorpay_order_id: orderId,
    net_amount: netAmount,
    breakdown: {
      items_total: itemsTotal,
      discount_amount: discountAmount,
      discount_reason: offerResult.reason,
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

  // Wave 3 commit 2 — commission-release window is per-category (admin-editable),
  // falling back to the global default. Replaces the flat RETURN_WINDOW_MS.
  const returnWindowEndsAt = await settlementService.resolveReturnWindowEndsAt(db, meta.brand_id);
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

  // Phase Salon-3 Q3 — for online_order, the "primary" product is the first
  // (highest-priced) item in the cart. Per-item attribution lives in
  // follower_orders.items_json — this denormalizes one row for single-JOIN
  // analytics.
  const primaryProductId = Array.isArray(meta.items_json) && meta.items_json[0]?.product_id
    ? meta.items_json[0].product_id
    : null;

  // Tier-1: pull primary variant_id from items_json[0] alongside primary
  // product_id, so single-row analytics can answer "Size M, Black T-shirt
  // — how much revenue?".
  const primaryVariantId = Array.isArray(meta.items_json) && meta.items_json[0]?.variant_id
    ? meta.items_json[0].variant_id
    : null;

  await db.withTransaction(async (client) => {
    const { rows: txRows } = await client.query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id, product_id,
          variant_id, offer_type,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, marketplace_fee_amount, brand_net,
          status, coupon_code_used, return_window_ends_at, razorpay_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'online_order',$10,$11,$12,$13,$14,$15,'completed',$16,$17,$18)
       RETURNING id`,
      [
        meta.follower_id, meta.brand_id, meta.campaign_id, meta.set_id,
        meta.campaign_influencer_id, meta.offer_id, primaryProductId,
        primaryVariantId, meta.offer_type || null,
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

    // L3 attribution write (Phase A5) — Path B (CI present) opens a
    // 30-day attribution window so future direct buys by this follower
    // from this brand fall into Path C and the influencer keeps earning.
    if (meta.campaign_influencer_id && influencer?.id) {
      await client.query(
        `INSERT INTO attribution_clicks
           (follower_id, influencer_id, brand_id, campaign_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '30 days')`,
        [meta.follower_id, influencer.id, meta.brand_id, meta.campaign_id]
      );
    }
  });

  // Wave 3 commit 2 — settle the brand's net share (per-brand TCS + commission
  // GST + Razorpay Route transfer). Best-effort + post-commit: never breaks the
  // purchase the customer already paid for.
  await settlementService.settleCommerceTransaction(db, transactionId)
    .catch(e => console.error('[settlement] failed:', e.message));

  // Notifications
  notificationService.send({
    userId: req.user.sub,
    type: 'order.confirmed',
    title: 'Order confirmed!',
    body: `Order confirmed! Expected delivery: ${estimatedDelivery}`,
    sendSms: true,
    phone: follower.phone,
  }).catch(e => console.error('[NOTIFY] order.confirmed failed:', e.message));

  // Phase Salon-3 — follow-creator prompt to the follower
  if (influencer) {
    notificationService.notifyFollowCreatorPrompt({
      followerUserId: req.user.sub,
      influencer,
      brandName: brandRows[0]?.business_name,
    }).catch(e => console.error('[NOTIFY] follow_creator_prompt failed:', e.message));
  }

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
  initiatePrebookDateRange,
  verifyPrebookDateRange,
  placeOrder,
  verifyOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
};
