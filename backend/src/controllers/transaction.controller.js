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

// features/follower-event-log (Slice 0) — a cart line driven by a creator post
// carries post_id, so a sale can be traced back to the post that caused it.
// Shape-checked here; existence is confirmed before it reaches the FK column,
// because a stale post id must never fail a checkout.
const POST_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safePostId = (v) => (POST_UUID_RE.test(String(v || '')) ? v : null);
const txService = require('../services/transaction.service');
const bookingService = require('../services/booking.service');
const notificationService = require('../services/notification.service');
const offerService = require('../services/offer.service');
// collab-part4 §4.3 — chooses WHICH offer applies (creator-specific vs published
// global, best single offer per checkout). Holds no discount maths of its own.
const offerResolution = require('../services/offerResolution.service');
const pricingService = require('../services/pricing.service');
const settlementService = require('../services/settlement.service');
const paymentConfigSvc = require('../services/paymentConfig.service');
const followerAppConfig = require('../services/followerAppConfig.service'); // app-config knobs (COD)

// Way-4 — resolve the admin-configured attribution window length (days) as a
// validated integer, safe to inline into `interval 'N days'`. Falls back to 30.
async function attributionWindowDays() {
  try {
    const cfg = await paymentConfigSvc.getConfig();
    const n = parseInt(cfg.attributionWindowDays, 10);
    return Number.isFinite(n) && n > 0 ? n : 30;
  } catch (_) { return 30; }
}

// stakeholder-sale-info S-D — admin-owned, distance-scaled delivery ETA. Admin
// sets one rule (delivery_ref_km + delivery_ref_days, e.g. 100km = 2 days); the
// system measures store↔address distance and scales:
//   days = max(1, ceil(distance_km / ref_km × ref_days)); coords missing → ref_days.
// Replaces the old hardcoded "order + 2 days".
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function computeEtaDate(brandId, addressId) {
  let refKm = 100, refDays = 2;
  try {
    const cfg = await paymentConfigSvc.getConfig();
    refKm = parseInt(cfg.deliveryRefKm, 10) || 100;
    refDays = parseInt(cfg.deliveryRefDays, 10) || 2;
  } catch (_) { /* defaults */ }
  let days = refDays;
  try {
    const { rows } = await db.query(
      `SELECT b.lat AS b_lat, b.lng AS b_lng, a.lat AS a_lat, a.lng AS a_lng
         FROM brands b LEFT JOIN follower_addresses a ON a.id = $2
        WHERE b.id = $1`,
      [brandId, addressId || null]
    );
    const r = rows[0];
    if (r && r.b_lat != null && r.b_lng != null && r.a_lat != null && r.a_lng != null) {
      const km = haversineKm(+r.b_lat, +r.b_lng, +r.a_lat, +r.a_lng);
      days = Math.max(1, Math.ceil((km / refKm) * refDays) || refDays);
    }
  } catch (_) { /* fallback to refDays */ }
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

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
 * Fetch product metadata for category-scoped offers.
 * Returns Map<product_id, { section, node_path }>. `section` powers the LEGACY
 * string category match (old offers); `node_path` is the product's category
 * node + all its ancestors, powering HIERARCHY-aware matching (offer-category-
 * hierarchy): a node-scoped offer applies if its node_id is anywhere in the
 * product's ancestor path (so "Men › Bottomwear › Jeans" matches jeans, and
 * "Men" matches everything under Men).
 */
async function fetchProductMetaMap(productIds) {
  const map = new Map();
  if (!productIds || productIds.length === 0) return map;
  const { rows } = await db.query(
    `SELECT id, section FROM brand_products WHERE id = ANY($1::uuid[]) AND is_active = true`,
    [productIds]
  );
  for (const r of rows) map.set(r.id, { section: r.section, node_path: [] });
  // Ancestor path per product (leaf category node → root).
  const { rows: paths } = await db.query(
    `WITH RECURSIVE anc AS (
       SELECT bp.id AS product_id, cn.id AS node_id, cn.parent_id
         FROM brand_products bp JOIN category_nodes cn ON cn.id = bp.category_node_id
        WHERE bp.id = ANY($1::uuid[]) AND bp.category_node_id IS NOT NULL
       UNION ALL
       SELECT anc.product_id, p.id, p.parent_id
         FROM anc JOIN category_nodes p ON p.id = anc.parent_id
     )
     SELECT product_id, array_agg(node_id::text) AS node_path FROM anc GROUP BY product_id`,
    [productIds]
  );
  for (const r of paths) {
    const m = map.get(r.product_id);
    if (m) m.node_path = r.node_path || [];
  }
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

  // collab-part4 §4.3 — the creator's own offer is no longer the only candidate.
  // Published global offers from the brand's engine now reach every creator holding
  // those products, and the BEST SINGLE offer wins against the whole cart. Never
  // combined, never stacked.
  //
  // §4.4 expiry is handled inside the resolver (offer_valid_until — not
  // offer_expires_at, which is the invitation clock).
  //
  // The pure maths is untouched: the resolver scores each candidate with the same
  // offerService.resolveOfferDiscount this used to call directly, so the only thing
  // that changed is WHICH offer is chosen.
  return offerResolution.resolveBestOffer({
    ci: trackingRecord,
    brandId: trackingRecord.brand_id,
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
    via_store_influencer_id,                    // store-context: bought inside this creator's store
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
    // Store-context (dormant until the app sends via_store_influencer_id): when the
    // follower bought inside this creator's store and genuinely stocked the product,
    // classifyPath makes store the winning touch (store > live-link > window > direct).
    storeInfluencerId:     via_store_influencer_id || null,
    productId:             product_id || null,
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
    // store-context stamp — recorded on the txn in verify (analytics + attribution)
    via_store_influencer_id: (l3.store_context && via_store_influencer_id) ? via_store_influencer_id : null,
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
  // Item 17 (review): these older flows wrote a COMPLETED sale (and a creator's pending commission)
  // on the caller's word alone. The payment's signature is checked now, as the shopper checkout
  // does. (In test mode the check passes, as every payment check does.)
  if (!txService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, req.body.razorpay_signature)) {
    throw new AppError('VALIDATION_ERROR', 'Payment could not be verified', 400, 'razorpay_signature');
  }

  // Peek the pending order — returns the rupees amount plus meta we stashed.
  // (Claimed atomically inside the withTransaction below.)
  const { amountRupees: netAmount, meta } = await txService.getPendingOrder(razorpay_order_id);

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
    // Claim the pending order atomically with the business rows below — a
    // failed verify rolls the claim back (retryable); a concurrent double-
    // verify loses this claim race and rolls back (no double spend).
    await txService.consumePendingOrder(client, razorpay_order_id);
    // Create follower_transaction — all money columns in rupees
    const { rows: txRows } = await client.query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id, product_id,
          variant_id, offer_type, prebook_booking_id,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, marketplace_fee_amount, brand_net,
          status, coupon_code_used, return_window_ends_at, razorpay_payment_id, via_store_influencer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pay_at_store',$11,$12,$13,$14,$15,$16,'completed',$17,$18,$19,$20)
       RETURNING id`,
      [
        meta.follower_id, meta.brand_id, meta.campaign_id, meta.set_id,
        meta.campaign_influencer_id, meta.offer_id, productId,
        meta.variant_id || null, meta.offer_type || null, meta.prebook_booking_id || null,
        txGross, meta.discount_amount, netAmount,
        meta.influencer_commission, meta.platform_fee, meta.brand_net,
        couponCode, returnWindowEndsAt, razorpay_payment_id, meta.via_store_influencer_id || null,
      ]
    );
    transactionId = txRows[0].id;

    // Credit influencer pending_balance in rupees
    await txService.creditInfluencerCommission(client, influencer.id, meta.influencer_commission);

    // L3 attribution write (Phase A5) — on Path B (influencer_direct) transactions
    // record a 30-day attribution window so future direct buys by this follower
    // from this brand fall into Path C and the influencer keeps earning credit.
    if (meta.l3_path === 'influencer_direct' && meta.l3_influencer_id) {
      const awDays = await attributionWindowDays();
      await client.query(
        `INSERT INTO attribution_clicks
           (follower_id, influencer_id, brand_id, campaign_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
        [meta.follower_id, meta.l3_influencer_id, meta.brand_id, meta.campaign_id, awDays]
      );
    }
  });

  // Money G-3: brand commerce settlement is DEFERRED. The txn is left at
  // brand_settlement_status='pending'; the commerce-settlement.job settles the
  // brand's NET share (after any return claw-backs) only once the return window
  // has closed. Do NOT settle at sale time. (Was: settleCommerceTransaction.)

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

// ── Store-direct (Offer Engine D2) ────────────────────────────────────────────
// A follower buys a brand-store-published offer with NO influencer:
// no tracking IDs, NO commission, full brand margin. Mirrors pay-at-store but
// resolves the offer from brand_offers (published_to_store) instead of the
// campaign chain, and skips validateTracking / commission / attribution.

async function fetchStoreOfferOrThrow(brandOfferId, brandId) {
  const { rows } = await db.query(
    `SELECT bo.id, bo.offer_type, bo.offer_config_json, bo.status,
            bo.published_to_store, bo.store_starts_at, bo.store_ends_at,
            b.category AS brand_category
       FROM brand_offers bo
       JOIN brands b ON b.id = bo.brand_id
      WHERE bo.id = $1 AND bo.brand_id = $2`,
    [brandOfferId, brandId]
  );
  const o = rows[0];
  const UNAVAILABLE = new AppError('OFFER_UNAVAILABLE', 'This store offer is not available.', 409, 'brand_offer_id');
  if (!o) throw UNAVAILABLE;
  if (o.status !== 'active' || !o.published_to_store) throw UNAVAILABLE;
  const now = new Date();
  if (o.store_starts_at && new Date(o.store_starts_at) > now) throw UNAVAILABLE;
  if (o.store_ends_at && new Date(o.store_ends_at) < now) throw UNAVAILABLE;
  return o;
}

// ── POST /follower/store-offer/pay ────────────────────────────────────────────
const initiateStoreOfferPay = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { brand_id, brand_offer_id, bill_amount, items, product_id, variant_id } = req.body;

  if (!bill_amount || parseFloat(bill_amount) <= 0) {
    throw new AppError('VALIDATION_ERROR', 'bill_amount must be a positive number (rupees)', 422, 'bill_amount');
  }
  if (!brand_id) {
    throw new AppError('VALIDATION_ERROR', 'brand_id is required', 422, 'brand_id');
  }

  // brand_offer_id is OPTIONAL (walkthrough W9 / founder model): an
  // organically-browsing follower standing in the store can pay via INFLX
  // with NO offer at all — a plain direct (platform-owned) transaction with
  // zero discount and zero commission. With an offer id, the existing
  // store-offer discount flow applies unchanged.
  let offer;
  let offerResult;
  if (brand_offer_id) {
    offer = await fetchStoreOfferOrThrow(brand_offer_id, brand_id);
  } else {
    const { rows: brandRows } = await db.query(
      `SELECT b.id, b.category AS brand_category
       FROM brands b JOIN users u ON u.id = b.user_id
       WHERE b.id = $1 AND u.status = 'approved'`,
      [brand_id]
    );
    if (!brandRows[0]) throw new AppError('NOT_FOUND', 'Business not found', 404);
    offer = { offer_type: null, offer_config_json: null, brand_category: brandRows[0].brand_category };
  }
  const billAmount = parseFloat(bill_amount);

  if (brand_offer_id) {
    // Discount via the shared parser. No influencer record — synthesize the
    // minimal shape computeOfferDiscount needs from the library offer.
    offerResult = await computeOfferDiscount({
      trackingRecord: { ci_offer_type: offer.offer_type, offer_config_json: offer.offer_config_json },
      items: items || [],
      billAmount,
    });
  } else {
    offerResult = { discount_amount: 0, reason: null };
  }
  const discountAmount = parseFloat(offerResult.discount_amount || 0);

  const netAmount = parseFloat((billAmount - discountAmount).toFixed(2));
  if (netAmount < 0) throw new AppError('VALIDATION_ERROR', 'Discount exceeds bill amount', 422);

  // NO commission — store-direct has no influencer.
  const influencerCommission = 0;

  // L3 marketplace fee — campaignInfluencerId null → pricing.service classifies
  // as 'direct' (path A) unless a prior attribution window exists; either way no
  // commission is credited here (store-direct never writes attribution).
  const l3 = await pricingService.computeL3OnFollowerTxn({
    client:               db,
    brandId:              brand_id,
    followerId:           follower.id,
    campaignInfluencerId: null,
    brandCategory:        offer.brand_category,
    netAmount,
  });
  const platformFee = l3.fee_amount;
  const brandNet    = parseFloat((netAmount - influencerCommission - platformFee).toFixed(2));

  const orderId = await txService.createOrder(netAmount, {
    type: 'store_offer',
    brand_id, brand_offer_id: brand_offer_id || null, offer_source: 'store',
    bill_amount: billAmount,
    gross_for_txn: billAmount,
    discount_amount: discountAmount,
    influencer_commission: influencerCommission,
    platform_fee: platformFee,
    brand_net: brandNet,
    follower_id: follower.id,
    product_id: product_id || null,
    variant_id: variant_id || null,
    offer_type: offer.offer_type || null,
  });

  return success(res, {
    razorpay_order_id: orderId,
    razorpay_key_id: txService.getRazorpayKeyId(),
    bill_amount: billAmount,
    discount_amount: discountAmount,
    amount_to_charge: netAmount,
    discount_reason: offerResult.reason,
    net_amount: netAmount,
    breakdown: { influencer_commission: 0, platform_fee: platformFee, brand_net: brandNet },
  }, 201);
});

// ── POST /follower/store-offer/verify ─────────────────────────────────────────
const verifyStoreOfferPay = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { razorpay_order_id, razorpay_payment_id } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id) {
    throw new AppError('VALIDATION_ERROR', 'razorpay_order_id and razorpay_payment_id are required', 422);
  }
  // Item 17 (review): these older flows wrote a COMPLETED sale (and a creator's pending commission)
  // on the caller's word alone. The payment's signature is checked now, as the shopper checkout
  // does. (In test mode the check passes, as every payment check does.)
  if (!txService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, req.body.razorpay_signature)) {
    throw new AppError('VALIDATION_ERROR', 'Payment could not be verified', 400, 'razorpay_signature');
  }

  const { amountRupees: netAmount, meta } = await txService.getPendingOrder(razorpay_order_id);
  const returnWindowEndsAt = await settlementService.resolveReturnWindowEndsAt(db, meta.brand_id);

  let transactionId;
  await db.withTransaction(async (client) => {
    // Claim the pending order atomically with the business rows below — a
    // failed verify rolls the claim back (retryable); a concurrent double-
    // verify loses this claim race and rolls back (no double spend).
    await txService.consumePendingOrder(client, razorpay_order_id);
    const { rows: txRows } = await client.query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id,
          brand_offer_id, offer_source, product_id, variant_id, offer_type,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, marketplace_fee_amount, brand_net,
          status, return_window_ends_at, razorpay_payment_id)
       VALUES ($1,$2,NULL,NULL,NULL,NULL,$3,'store',$4,$5,$6,'pay_at_store',$7,$8,$9,0,$10,$11,'completed',$12,$13)
       RETURNING id`,
      [
        meta.follower_id, meta.brand_id, meta.brand_offer_id,
        meta.product_id || null, meta.variant_id || null, meta.offer_type || null,
        meta.gross_for_txn, meta.discount_amount, netAmount,
        meta.platform_fee, meta.brand_net,
        returnWindowEndsAt, razorpay_payment_id,
      ]
    );
    transactionId = txRows[0].id;
    // No influencer commission credit, no attribution_clicks write — store-direct.
  });

  // Money G-3: brand commerce settlement is DEFERRED to the commerce-settlement
  // job once the return window closes. Left at brand_settlement_status='pending'.
  // (Was: settleCommerceTransaction at sale time.)

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
  // Item 17 (review): these older flows wrote a COMPLETED sale (and a creator's pending commission)
  // on the caller's word alone. The payment's signature is checked now, as the shopper checkout
  // does. (In test mode the check passes, as every payment check does.)
  if (!txService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, req.body.razorpay_signature)) {
    throw new AppError('VALIDATION_ERROR', 'Payment could not be verified', 400, 'razorpay_signature');
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

  const { amountRupees: advanceAmount, meta } = await txService.getPendingOrder(razorpay_order_id);

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
    // Claim the pending order atomically with the business rows below — a
    // failed verify rolls the claim back (retryable); a concurrent double-
    // verify loses this claim race and rolls back (no double spend).
    await txService.consumePendingOrder(client, razorpay_order_id);
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
      const awDays = await attributionWindowDays();
      await client.query(
        `INSERT INTO attribution_clicks
           (follower_id, influencer_id, brand_id, campaign_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
        [meta.follower_id, influencer.id, meta.brand_id, meta.campaign_id, awDays]
      );
    }
  });

  // Money G-3: brand commerce settlement is DEFERRED to the commerce-settlement
  // job once the return window closes. Left at brand_settlement_status='pending'
  // so the brand is paid its NET (after any return claw-backs), never at sale.
  // (Was: settleCommerceTransaction at sale time.)

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
  // Item 17 (review): these older flows wrote a COMPLETED sale (and a creator's pending commission)
  // on the caller's word alone. The payment's signature is checked now, as the shopper checkout
  // does. (In test mode the check passes, as every payment check does.)
  if (!txService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, req.body.razorpay_signature)) {
    throw new AppError('VALIDATION_ERROR', 'Payment could not be verified', 400, 'razorpay_signature');
  }

  const { amountRupees: advanceAmount, meta } = await txService.getPendingOrder(razorpay_order_id);

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
    // Claim the pending order atomically with the business rows below — a
    // failed verify rolls the claim back (retryable); a concurrent double-
    // verify loses this claim race and rolls back (no double spend).
    await txService.consumePendingOrder(client, razorpay_order_id);
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
      const awDays = await attributionWindowDays();
      await client.query(
        `INSERT INTO attribution_clicks
           (follower_id, influencer_id, brand_id, campaign_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
        [meta.follower_id, influencer.id, meta.brand_id, meta.campaign_id, awDays]
      );
    }
  });

  // Money G-3: brand commerce settlement is DEFERRED to the commerce-settlement
  // job once the return window closes. Left at brand_settlement_status='pending'
  // so the brand is paid its NET (after any return claw-backs), never at sale.
  // (Was: settleCommerceTransaction at sale time.)

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

// follower-checkout Slice B — price ONE brand's slice of a checkout. Returns the
// per-brand { subMeta, netAmount, breakdown }. The single-order path (food /
// single-brand shop / creator-mediated) calls it once; the multi-brand shopping
// cart calls it per brand and the follower pays the SUMMED total ONCE (a single
// Razorpay order holding sub_orders[] → verifyOrder writes one order per brand).
async function priceOrderForGroup(follower, group) {
  const { offer_id, campaign_id, set_id, campaign_influencer_id, brand_id, brand_offer_id, items, address_id, delivery_fee } = group;
  if (!items?.length) {
    throw new AppError('VALIDATION_ERROR', 'items are required', 422, 'items');
  }

  // Two ordering modes (sprint3-cart-rebuild):
  //   creator-mediated — campaign_id + set_id + campaign_influencer_id present;
  //     discount + commission resolved from the contracted offer.
  //   organic — no creator, just brand_id. A brand-direct delivery order:
  //     zero discount, zero commission, platform fee only. Mirrors the
  //     store-offer/pay organic path (W9 founder model). campaign/set/CI/offer
  //     are NULL on the resulting follower_transactions row.
  const isOrganic = !campaign_influencer_id;
  let record;
  if (isOrganic) {
    if (!brand_id) {
      throw new AppError('VALIDATION_ERROR',
        'brand_id (organic) or campaign_id + set_id + campaign_influencer_id (creator) is required', 422);
    }
    const { rows } = await db.query(
      `SELECT b.id AS brand_id, b.category AS brand_category
         FROM brands b JOIN users u ON u.id = b.user_id
        WHERE b.id = $1 AND u.status = 'approved'`,
      [brand_id]
    );
    if (!rows[0]) throw new AppError('NOT_FOUND', 'Business not found', 404, 'brand_id');
    record = { brand_id: rows[0].brand_id, brand_category: rows[0].brand_category,
               commission_pct: 0, ci_offer_type: null, offer_config_json: null };
    // Offer Engine D2 — a STORE-DIRECT brand offer (BOGO / bundle / free-gift /
    // discount the owner published to store) applied to an organic delivery
    // cart. No influencer → no commission; validated active+published+window.
    if (brand_offer_id) {
      const so = await fetchStoreOfferOrThrow(brand_offer_id, record.brand_id);
      record.ci_offer_type = so.offer_type;
      record.offer_config_json = so.offer_config_json;
      record.brand_offer_id = brand_offer_id;
    } else {
      // Way-4 (attribution window): a PURE organic buy (no store offer) — if an
      // unexpired attribution window ties this follower+brand to a creator who
      // still has a live commissioned CI, credit that creator (Path C). The most
      // recent window wins (last-click). The buy carries NO discount; the creator
      // earns commission on the net. Reuses the normal credit path downstream by
      // stamping the attributed CI onto the txn.
      const { rows: aw } = await db.query(
        `SELECT ci.id AS campaign_influencer_id, ci.set_id, cs.campaign_id, ci.commission_pct
           FROM attribution_clicks ac
           JOIN campaign_influencers ci ON ci.influencer_id = ac.influencer_id
           JOIN campaign_sets cs ON cs.id = ci.set_id
           JOIN campaigns c ON c.id = cs.campaign_id AND c.brand_id = ac.brand_id
          WHERE ac.follower_id = $1 AND ac.brand_id = $2 AND ac.expires_at > now()
            AND ci.status IN ('contracted','active','completed')
            AND ci.commission_pct IS NOT NULL AND ci.commission_pct > 0
          ORDER BY ac.expires_at DESC, ci.created_at DESC
          LIMIT 1`,
        [follower.id, record.brand_id]
      );
      if (aw[0]) {
        record.attributed_ci = {
          campaign_influencer_id: aw[0].campaign_influencer_id,
          campaign_id: aw[0].campaign_id,
          set_id: aw[0].set_id,
        };
        record.commission_pct = parseFloat(aw[0].commission_pct);
      }
    }
  } else {
    if (!campaign_id || !set_id) {
      throw new AppError('VALIDATION_ERROR', 'campaign_id and set_id are required for a creator order', 422);
    }
    record = await txService.validateTracking(campaign_id, set_id, campaign_influencer_id, offer_id || null);
  }

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

  // Food World P1 — resolve dish customisation (variation + add-ons) server-side.
  // The client sends only ids; names + PRICES come from the DB (never trust
  // client-sent prices). Ownership is validated: an item_id must belong (via its
  // group) to the same product, and a variation item must come from a variation
  // group (and an add-on from a non-variation group).
  const customisationIds = [...new Set(
    items.flatMap(i => [
      i.variation && i.variation.item_id,
      ...(Array.isArray(i.addons) ? i.addons.map(a => a && a.item_id) : []),
    ]).filter(Boolean)
  )];
  let addonItemMap = new Map();
  if (customisationIds.length) {
    const { rows: aRows } = await db.query(
      `SELECT i.id, i.name, i.price, i.group_id, g.is_variation, g.product_id
         FROM product_addon_items i
         JOIN product_addon_groups g ON g.id = i.group_id
        WHERE i.id = ANY($1::uuid[]) AND i.is_active = true`,
      [customisationIds]
    );
    addonItemMap = new Map(aRows.map(r => [r.id, r]));
  }

  const safeItems = items.map(i => {
    const productId = i.product_id;
    // Variation (Half/Full) — single, sets the base price.
    let variation = null;
    if (i.variation && i.variation.item_id) {
      const row = addonItemMap.get(i.variation.item_id);
      if (!row || row.product_id !== productId || row.is_variation !== true) {
        throw new AppError('VALIDATION_ERROR', 'Invalid variation for product', 422, 'variation');
      }
      variation = { group_id: row.group_id, item_id: row.id, name: row.name, price: parseFloat(row.price || 0) };
    }
    // Add-ons (Roti/Coke) — stack as +deltas.
    const selectedAddons = [];
    if (Array.isArray(i.addons)) {
      for (const a of i.addons) {
        if (!a || !a.item_id) continue;
        const row = addonItemMap.get(a.item_id);
        if (!row || row.product_id !== productId || row.is_variation === true) {
          throw new AppError('VALIDATION_ERROR', 'Invalid add-on for product', 422, 'addons');
        }
        selectedAddons.push({ group_id: row.group_id, item_id: row.id, name: row.name, price: parseFloat(row.price || 0) });
      }
    }
    const note = typeof i.note === 'string' ? (i.note.trim().slice(0, 280) || null) : null;
    return {
      product_id: productId,
      variant_id: i.variant_id || null,
      quantity: parseInt(i.quantity, 10),
      // Fashion/furniture variants live in variants_json.colors[] as SKUs (no
      // product_variants rows). Carry the chosen colour·size + SKU as
      // fulfillment metadata so the brand knows what to ship; price stays base.
      variant_sku: i.variant_sku || null,
      variant_label: i.variant_label || null,
      // Food World P1 — resolved customisation (server-priced).
      variation,
      selected_addons: selectedAddons,
      note,
      // Slice 0 — which post drove this line (null for organic/browse adds).
      post_id: safePostId(i.post_id),
    };
  });

  // Customisation-aware unit (per-one) price: a chosen variation SETS the base
  // price; otherwise the product/variant base via lineItemPrice. Add-ons stack
  // as +deltas. With NO customisation this equals offerService.lineItemPrice
  // exactly → byte-identical pricing for non-food / uncustomised orders.
  const lineUnitPrice = (i) => {
    const base = i.variation ? i.variation.price : offerService.lineItemPrice(i, priceMap, variantPriceMap);
    const add = (i.selected_addons || []).reduce((s, a) => s + Number(a.price || 0), 0);
    return parseFloat((base + add).toFixed(2));
  };

  // Discount via offer.service.js parser. Handles all 5 offer mechanics
  // (Discount / Volume / BOGO / Bundle / Free gift) with the 3-tier scope
  // model (store / category / products) for Discount + Volume.
  let offerResult;
  if (!isOrganic) {
    // Creator-mediated: the contracted campaign chain PLUS the brand's published
    // global offers (collab-part4 §4.3), best single offer against the whole cart.
    //
    // Routed through the resolver rather than the engine directly so this checkout
    // path agrees with computeOfferDiscount. Leaving it on the creator's offer alone
    // would mean the same cart got a different discount depending on which checkout
    // route it took — the kind of inconsistency that surfaces as a customer
    // complaint rather than a test failure.
    offerResult = await offerResolution.resolveBestOffer({
      ci: record, brandId: record.brand_id,
      items: safeItems, priceMap, variantPriceMap, productMetaMap,
    });
  } else if (record.brand_offer_id) {
    // Organic + a store-direct brand offer → apply it to the cart. billAmount
    // (base item total) lets store-wide discount offers resolve too.
    offerResult = offerService.resolveOfferDiscount({
      offerType: record.ci_offer_type, offerConfig: record.offer_config_json,
      items: safeItems, priceMap, variantPriceMap, productMetaMap,
      billAmount: offerService.itemsTotal(safeItems, priceMap, variantPriceMap),
    });
  } else {
    // Organic, no offer → plain direct order, zero discount.
    offerResult = { discount_amount: 0, reason: null, adjustments: null };
  }

  const discountAmount = parseFloat(offerResult.discount_amount || 0);
  const commissionPct  = parseFloat(record.commission_pct || 0);
  const deliveryFee    = parseFloat(delivery_fee || 0);

  // Customisation-aware total (variation base + add-on deltas). Identical to
  // offerService.itemsTotal when no item carries customisation.
  const itemsTotal = parseFloat(
    safeItems.reduce((s, i) => s + lineUnitPrice(i) * Number(i.quantity || 1), 0).toFixed(2)
  );
  const discountedItems = parseFloat((itemsTotal - discountAmount).toFixed(2));
  const netAmount = parseFloat((discountedItems + deliveryFee).toFixed(2));
  const influencerCommission = parseFloat((discountedItems * commissionPct / 100).toFixed(2));

  // L3 marketplace fee (Phase A5) — applied on discountedItems (matches
  // legacy: delivery_fee is brand pass-through, fee charged on item revenue only)
  const l3 = await pricingService.computeL3OnFollowerTxn({
    client:                db,
    brandId:               record.brand_id,
    followerId:            follower.id,
    campaignInfluencerId:  campaign_influencer_id || null,
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
    variant_sku: i.variant_sku,
    variant_label: i.variant_label,
    quantity: i.quantity,
    price: lineUnitPrice(i),
    // Food World P1 — customisation snapshot (untyped jsonb; no migration).
    // Readers needing only product/variant/qty/price ignore these extra keys.
    variation: i.variation,
    selected_addons: i.selected_addons,
    note: i.note,
    // Slice 0 — per-item post attribution. The transaction row denormalizes only
    // the PRIMARY line's post (like product_id/variant_id); a cart mixing posts
    // keeps the per-item truth here.
    post_id: i.post_id || null,
  }));

  // Way-4: an organic buy attributed via the window carries the resolved CI so
  // the normal credit/attribution path (writeSubOrder) pays the creator.
  const attr = record.attributed_ci || null;

  const subMeta = {
    type: 'online_order',
    // Organic orders carry NO creator attribution (unless window-attributed via
    // `attr`) — keep these explicitly null so the pending-order meta round-trips
    // cleanly into the verify INSERT.
    offer_id:              attr ? null : (isOrganic ? null : (offer_id || null)),
    campaign_id:           attr ? attr.campaign_id : (isOrganic ? null : campaign_id),
    set_id:                attr ? attr.set_id : (isOrganic ? null : set_id),
    campaign_influencer_id: attr ? attr.campaign_influencer_id : (isOrganic ? null : campaign_influencer_id),
    items_total: itemsTotal, discount_amount: discountAmount, net_amount: netAmount,
    influencer_commission: influencerCommission, platform_fee: platformFee, brand_net: brandNet,
    delivery_fee: deliveryFee, address_id, items_json: itemsJson,
    follower_id: follower.id, brand_id: record.brand_id,
    commission_pct: commissionPct,
    offer_type: record.ci_offer_type || null,
    // Item 5 Gap A — the sale records WHICH offer produced it: the resolver's winner (a
    // library id for a snapshotted creator offer or a published global offer; null for a
    // bespoke special offer, which has no library row), falling back to the store-direct id.
    brand_offer_id: (offerResult && offerResult.offer_id) || record.brand_offer_id || null,
    offer_source: isOrganic && record.brand_offer_id ? 'store' : 'influencer',
    discount_reason: offerResult.reason,
    adjustments: offerResult.adjustments || null,
    // L3 (Phase A5) classification — stashed for verifyOrder attribution write
    l3_path:          l3.path,
    l3_category_key:  l3.category_key,
    l3_source:        l3.source,
    l3_influencer_id: l3.influencer_id,
  };

  const breakdown = {
    items_total: itemsTotal,
    discount_amount: discountAmount,
    discount_reason: offerResult.reason,
    delivery_fee: deliveryFee,
    influencer_commission: influencerCommission,
    platform_fee: platformFee,
    brand_net: brandNet,
  };

  return { subMeta, netAmount, breakdown };
}

// ── POST /follower/cart/price ─────────────────────────────────────────────────
// Preview an offer's effect on a cart BEFORE checkout (offer-cart-preview,
// Phase 2). Reuses the SAME pure engine (offerService.resolveOfferDiscount) and
// the SAME price-map helpers as placeOrder → the previewed discount + free-item
// adjustments match what checkout charges (exact for non-customised carts; the
// free-item adjustments are always exact). Creates nothing — no order, no
// Razorpay, no write. Lets the cart show WHY the total dropped for volume / BOGO
// / bundle / free-gift (not just plain discount).
const previewCartOffer = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);
  const { brand_id, brand_offer_id, campaign_id, set_id, campaign_influencer_id, offer_id, items } = req.body || {};

  if (!Array.isArray(items) || !items.length) {
    return success(res, { items_total: 0, discount_amount: 0, adjustments: [], offer_type: null, reason: null });
  }

  // Resolve the offer config: store-direct brand offer OR creator-mediated CI.
  let offerType = null, offerConfig = null;
  if (brand_offer_id && brand_id) {
    const so = await fetchStoreOfferOrThrow(brand_offer_id, brand_id);
    offerType = so.offer_type; offerConfig = so.offer_config_json;
  } else if (campaign_influencer_id && campaign_id && set_id) {
    const rec = await txService.validateTracking(campaign_id, set_id, campaign_influencer_id, offer_id || null);
    offerType = rec.ci_offer_type; offerConfig = rec.offer_config_json;
  }

  const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))];
  const variantIds = [...new Set(items.map(i => i.variant_id).filter(Boolean))];
  const [priceMap, variantPriceMap, productMetaMap] = await Promise.all([
    fetchPriceMap(productIds), fetchVariantPriceMap(variantIds), fetchProductMetaMap(productIds),
  ]);
  const safeItems = items
    .filter(i => i.product_id)
    .map(i => ({ product_id: i.product_id, variant_id: i.variant_id || null, quantity: parseInt(i.quantity, 10) || 1 }));
  const itemsTotal = parseFloat(offerService.itemsTotal(safeItems, priceMap, variantPriceMap).toFixed(2));

  let offerResult = { discount_amount: 0, reason: null, adjustments: null };
  if (offerType && offerConfig) {
    offerResult = offerService.resolveOfferDiscount({
      offerType, offerConfig, items: safeItems, priceMap, variantPriceMap, productMetaMap,
      billAmount: itemsTotal,
    });
  }

  // Enrich free-item adjustments (BOGO / free-gift) with product names for the UI.
  let adjustments = [];
  const adj = offerResult.adjustments || [];
  if (adj.length) {
    const adjIds = [...new Set(adj.map(a => a.product_id).filter(Boolean))];
    const { rows } = await db.query(`SELECT id, name FROM brand_products WHERE id = ANY($1::uuid[])`, [adjIds]);
    const nameMap = new Map(rows.map(r => [r.id, r.name]));
    adjustments = adj.map(a => ({
      product_id: a.product_id, name: nameMap.get(a.product_id) || 'Item',
      free_qty: a.free_qty, reason: a.reason || null,
    }));
  }

  return success(res, {
    items_total: itemsTotal,
    discount_amount: parseFloat(offerResult.discount_amount || 0),
    reason: offerResult.reason || null,
    offer_type: offerType,
    adjustments,
  });
});

const placeOrder = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { brand_groups, address_id } = req.body;

  // ── Stage C3 — Cash on Delivery ────────────────────────────────────────────
  // No Razorpay leg: price exactly as prepaid, then settle immediately through
  // the SAME write path verify uses. The admin toggle is enforced HERE (server
  // truth), not just hidden in the UI; the fee comes from app-config and lands
  // once on the primary order row (platform revenue, outside brand_net math).
  if (String(req.body.payment_method || '') === 'cod') {
    const appConfig = await followerAppConfig.get();
    if (!appConfig.cod_enabled) {
      throw new AppError('VALIDATION_ERROR', 'Cash on Delivery is not available right now', 422);
    }
    const codFee = Math.max(0, parseFloat(appConfig.cod_fee) || 0);

    const groups = Array.isArray(brand_groups) && brand_groups.length
      ? brand_groups
      : [{
          offer_id: req.body.offer_id, campaign_id: req.body.campaign_id,
          set_id: req.body.set_id, campaign_influencer_id: req.body.campaign_influencer_id,
          brand_id: req.body.brand_id, brand_offer_id: req.body.brand_offer_id,
          items: req.body.items, delivery_fee: req.body.delivery_fee,
        }];
    const priced = [];
    for (const g of groups) priced.push(await priceOrderForGroup(follower, { ...g, address_id }));
    const grandTotal = parseFloat(priced.reduce((s, p) => s + p.netAmount, 0).toFixed(2));

    return settleOrders(req, res, follower, priced.map(p => p.subMeta), {
      paymentMethod: 'cod',
      codFee,
      extraResponse: {
        cod: true,
        cod_fee: codFee,
        net_amount: grandTotal,
        total_due: parseFloat((grandTotal + codFee).toFixed(2)),
      },
    });
  }

  // ── Multi-brand shopping checkout (follower-checkout Slice B) ──────────────
  // The shopping cart (fashion/furniture/beauty) can hold lines from several
  // brands. The follower sees ONE flat list + bill and pays ONCE; the backend
  // splits into one order per brand (each brand gets only its items + the
  // customer's delivery info). One Razorpay order is created for the summed
  // total, stashing the per-brand sub_orders[] → verifyOrder writes them all.
  if (Array.isArray(brand_groups) && brand_groups.length) {
    const priced = [];
    for (const g of brand_groups) {
      priced.push(await priceOrderForGroup(follower, { ...g, address_id }));
    }
    const grandTotal = parseFloat(priced.reduce((s, p) => s + p.netAmount, 0).toFixed(2));
    const orderId = await txService.createOrder(grandTotal, {
      type: 'online_order_multi',
      follower_id: follower.id,
      address_id: address_id || null,
      sub_orders: priced.map(p => p.subMeta),
    });
    return success(res, {
      razorpay_order_id: orderId,
      razorpay_key_id: txService.getRazorpayKeyId(),
      net_amount: grandTotal,
      brand_count: priced.length,
      breakdowns: priced.map(p => p.breakdown),
    }, 201);
  }

  // ── Single-order path (food, single-brand shop, creator-mediated) ─────────
  const { offer_id, campaign_id, set_id, campaign_influencer_id, brand_id, brand_offer_id, items, delivery_fee } = req.body;
  const { subMeta, netAmount, breakdown } = await priceOrderForGroup(follower, {
    offer_id, campaign_id, set_id, campaign_influencer_id, brand_id, brand_offer_id, items, address_id, delivery_fee,
  });
  const orderId = await txService.createOrder(netAmount, subMeta);

  return success(res, {
    razorpay_order_id: orderId,
    // The app needs the key to open Razorpay. Pay-at-store/prebook return it;
    // the online-order response omitted it → the app opened Razorpay with an
    // undefined key → native hard-crash on Place Order (no payment, no order).
    razorpay_key_id: txService.getRazorpayKeyId(),
    net_amount: netAmount,
    breakdown,
  }, 201);
});

// ── POST /follower/orders/verify ──────────────────────────────────────────────

// follower-checkout Slice B — read-side enrichment for ONE order (one brand).
// Pulls the per-brand return window, coupon, influencer, brand contact + the
// primary product/variant for single-row analytics. Done OUTSIDE the write
// transaction (reads only) so the transaction stays short. `sm` is the per-brand
// sub-meta (the whole meta on the single-order path).
async function prepareSubOrder(sm) {
  // Wave 3 commit 2 — commission-release window is per-category (admin-editable),
  // falling back to the global default. Replaces the flat RETURN_WINDOW_MS.
  const returnWindowEndsAt = await settlementService.resolveReturnWindowEndsAt(db, sm.brand_id);
  const commissionAmount = parseFloat(sm.influencer_commission);

  const { rows: ciRows } = await db.query(
    `SELECT coupon_code FROM campaign_influencers WHERE id = $1`,
    [sm.campaign_influencer_id]
  );
  const couponCode = ciRows[0]?.coupon_code || null;

  const influencer = await getInfluencerByCiId(sm.campaign_influencer_id);
  const { rows: brandRows } = await db.query(
    `SELECT b.business_name, u.id AS brand_user_id, u.phone AS brand_phone
       FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [sm.brand_id]
  );

  // stakeholder-sale-info S-D — admin-owned, distance-scaled ETA (was now+2d).
  const estimatedDelivery = await computeEtaDate(sm.brand_id, sm.address_id);

  // Phase Salon-3 Q3 / Tier-1 — denormalize the first cart item's product +
  // variant onto the row for single-JOIN analytics (full per-item attribution
  // lives in follower_orders.items_json).
  const primaryProductId = Array.isArray(sm.items_json) && sm.items_json[0]?.product_id ? sm.items_json[0].product_id : null;
  const primaryVariantId = Array.isArray(sm.items_json) && sm.items_json[0]?.variant_id ? sm.items_json[0].variant_id : null;

  // Slice 0 (features/follower-event-log) — the post that drove this order.
  // Confirmed to exist before it touches the FK column: a post deleted while the
  // follower was mid-checkout must NOT fail the order, it must just go unlinked.
  const claimedPostId = Array.isArray(sm.items_json)
    ? safePostId(sm.items_json.find(i => i?.post_id)?.post_id)
    : null;
  let primaryPostId = null;
  if (claimedPostId) {
    const { rows: postRows } = await db.query(
      `SELECT id FROM creator_posts WHERE id = $1`, [claimedPostId]);
    primaryPostId = postRows[0]?.id || null;
  }

  return { sm, returnWindowEndsAt, commissionAmount, couponCode, influencer, brandRows, estimatedDelivery, primaryProductId, primaryVariantId, primaryPostId };
}

// follower-checkout Slice B — write ONE order (one brand) inside the caller's
// transaction. Identical to the legacy single-order write; the multi-brand path
// calls it once per brand under the same transaction + single pending-order claim.
async function writeSubOrder(client, prepared, razorpay_payment_id, opts = {}) {
  const { sm, returnWindowEndsAt, commissionAmount, couponCode, influencer, brandRows, estimatedDelivery, primaryProductId, primaryVariantId, primaryPostId } = prepared;
  const netAmount = parseFloat(sm.net_amount);
  // Stage C3 — COD orders carry payment_method='cod'; the fee lands once, on
  // the primary order row (opts.codFee is 0 for the rest of a multi split).
  const paymentMethod = opts.paymentMethod || 'prepaid';
  const codFee = parseFloat(opts.codFee || 0);

  const { rows: txRows } = await client.query(
    `INSERT INTO follower_transactions
       (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, offer_id, product_id,
        variant_id, offer_type, brand_offer_id, offer_source,
        transaction_type, gross_amount, discount_amount, net_amount,
        influencer_commission, marketplace_fee_amount, brand_net,
        status, coupon_code_used, return_window_ends_at, razorpay_payment_id,
        via_post_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'online_order',$12,$13,$14,$15,$16,$17,'completed',$18,$19,$20,$21)
     RETURNING id`,
    [
      sm.follower_id, sm.brand_id, sm.campaign_id, sm.set_id,
      sm.campaign_influencer_id, sm.offer_id, primaryProductId,
      primaryVariantId, sm.offer_type || null,
      sm.brand_offer_id || null, sm.offer_source || 'influencer',
      sm.items_total, sm.discount_amount, netAmount,
      commissionAmount, sm.platform_fee, sm.brand_net,
      couponCode, returnWindowEndsAt, razorpay_payment_id,
      primaryPostId || null,
    ]
  );
  const transactionId = txRows[0].id;

  const { rows: orderRows } = await client.query(
    `INSERT INTO follower_orders
       (transaction_id, address_id, order_status, estimated_delivery_date, whatsapp_number, items_json,
        payment_method, cod_fee)
     VALUES ($1, $2, 'confirmed', $3, $4, $5, $6, $7)
     RETURNING id`,
    [transactionId, sm.address_id || null, estimatedDelivery, brandRows[0]?.brand_phone, JSON.stringify(sm.items_json),
     paymentMethod, codFee]
  );
  const orderRowId = orderRows[0].id;

  // Organic orders have no influencer → nothing to credit.
  if (influencer?.id && commissionAmount > 0) {
    await txService.creditInfluencerCommission(client, influencer.id, commissionAmount);
  }

  // L3 attribution write (Phase A5) — Path B (CI present) opens a 30-day
  // attribution window so future direct buys by this follower from this brand
  // fall into Path C and the influencer keeps earning.
  if (sm.campaign_influencer_id && influencer?.id) {
    const awDays = await attributionWindowDays();
    await client.query(
      `INSERT INTO attribution_clicks
         (follower_id, influencer_id, brand_id, campaign_id, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
      [sm.follower_id, influencer.id, sm.brand_id, sm.campaign_id, awDays]
    );
  }

  return {
    transactionId, orderRowId,
    brandPhone: brandRows[0]?.brand_phone,
    brandName: brandRows[0]?.business_name,
    brandUserId: brandRows[0]?.brand_user_id,
    influencer, estimatedDelivery,
    commissionAmount, couponCode,
  };
}

const verifyOrder = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id) {
    throw new AppError('VALIDATION_ERROR', 'razorpay_order_id and razorpay_payment_id are required', 422);
  }
  // Verify the Razorpay signature before writing the order — without this, a client
  // could "verify" a real pending order without actually paying. No-op in mock mode
  // (RAZORPAY_MOCK → returns true), so this is inert today and the gate for real money.
  if (!txService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    throw new AppError('VALIDATION_ERROR', 'Payment signature verification failed', 422);
  }

  const { meta } = await txService.getPendingOrder(razorpay_order_id);

  // Multi-brand checkout (Slice B): meta.sub_orders holds one sub-meta per brand;
  // the single-order path (food / single-brand / creator) has no sub_orders → the
  // whole meta IS the one sub. The follower paid ONCE; we write one order per brand.
  const subMetas = Array.isArray(meta.sub_orders) && meta.sub_orders.length ? meta.sub_orders : [meta];

  // Reads first (per brand), then the writes inside ONE transaction with a single
  // pending-order claim — a failed verify rolls back every sub-order (no partial
  // orders), a concurrent double-verify loses the claim race (no double spend).
  return settleOrders(req, res, follower, subMetas, {
    razorpayPaymentId: razorpay_payment_id,
    consumePendingOrderId: razorpay_order_id,
  });
});

// Stage C3 — the shared settle path: prepare (reads) → write every sub-order in
// ONE transaction → notifications → response. Prepaid verify passes the
// pending-order id to consume; COD passes paymentMethod/codFee and no pending
// order (there was no Razorpay leg). One code path = COD orders are identical
// to prepaid ones in attribution, commission, return-window and settlement.
async function settleOrders(req, res, follower, subMetas, opts = {}) {
  const { razorpayPaymentId = null, consumePendingOrderId = null,
          paymentMethod = 'prepaid', codFee = 0, extraResponse = {} } = opts;

  const prepared = [];
  for (const sm of subMetas) prepared.push(await prepareSubOrder(sm));

  const written = [];
  await db.withTransaction(async (client) => {
    if (consumePendingOrderId) await txService.consumePendingOrder(client, consumePendingOrderId);
    for (let i = 0; i < prepared.length; i++) {
      written.push(await writeSubOrder(client, prepared[i], razorpayPaymentId, {
        paymentMethod, codFee: i === 0 ? codFee : 0,
      }));
    }
  });

  // Money G-3: brand commerce settlement is DEFERRED to the commerce-settlement
  // job once the return window closes. Left at brand_settlement_status='pending'
  // so the brand is paid its NET (after any return claw-backs), never at sale.

  const primary = written[0];

  // One confirmation notification — the follower sees ONE order (locked: no
  // brand grouping). Estimated delivery is the same across sub-orders.
  notificationService.send({
    userId: req.user.sub,
    type: 'order.confirmed',
    title: 'Order confirmed!',
    body: `Order confirmed! Expected delivery: ${primary.estimatedDelivery}`,
    sendSms: true,
    phone: follower.phone,
  }).catch(e => console.error('[NOTIFY] order.confirmed failed:', e.message));

  // follower-creator-attribution Slice 4 — tell the CREATOR(s) they earned, and
  // the BRAND(s) they got an order. Aggregate per distinct creator (a cart can
  // carry several of a creator's items) and dedupe brands (creator + organic
  // sub-orders can share a brand).
  const byCreator = new Map();
  for (const w of written) {
    if (w.influencer?.id && w.commissionAmount > 0) {
      const e = byCreator.get(w.influencer.id) || { influencer: w.influencer, amount: 0, coupon: w.couponCode };
      e.amount += w.commissionAmount;
      byCreator.set(w.influencer.id, e);
    }
  }
  for (const { influencer, amount, coupon } of byCreator.values()) {
    const rupees = amount.toFixed(2);
    notificationService.send({
      userId: influencer.user_id,
      type: 'commission.sale',
      title: `₹${rupees} earned!`,
      body: `₹${rupees} earned — a follower bought via ${coupon || 'your store'}`,
      fcmToken: influencer.fcm_token,
      sendSms: false,
    }).catch(e => console.error('[NOTIFY] commission.sale failed:', e.message));
  }

  const brandSeen = new Set();
  for (const w of written) {
    if (w.brandUserId && !brandSeen.has(w.brandUserId)) {
      brandSeen.add(w.brandUserId);
      notificationService.send({
        userId: w.brandUserId,
        type: 'order.placed',
        title: 'New order received',
        body: 'You have a new order on INFLX. Open Orders to pack & ship.',
        sendSms: false,
      }).catch(e => console.error('[NOTIFY] order.placed failed:', e.message));
    }
  }

  // Phase Salon-3 — follow-creator prompt, once per distinct influencer across
  // the split (a multi-brand cart can carry more than one creator allocation).
  const promptedInfluencers = new Set();
  for (const w of written) {
    if (w.influencer?.id && !promptedInfluencers.has(w.influencer.id)) {
      promptedInfluencers.add(w.influencer.id);
      notificationService.notifyFollowCreatorPrompt({
        followerUserId: req.user.sub,
        influencer: w.influencer,
        brandName: w.brandName,
      }).catch(e => console.error('[NOTIFY] follow_creator_prompt failed:', e.message));
    }
  }

  return success(res, {
    // Primary order drives the confirmation screen; order_ids lists every
    // per-brand order so the orders list shows them all.
    order_id: primary.orderRowId,
    order_ids: written.map(w => w.orderRowId),
    transaction_id: primary.transactionId,
    estimated_delivery_date: primary.estimatedDelivery,
    brand_contact_whatsapp: primary.brandPhone,
    ...extraResponse,
  });
}

// ── GET /follower/orders ──────────────────────────────────────────────────────

const listOrders = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { rows } = await db.query(
    `SELECT fo.*, ft.net_amount, ft.created_at AS purchased_at, b.business_name AS brand_name,
            i.instagram_handle AS creator_handle,
            COALESCE(jsonb_array_length(fo.items_json::jsonb), 0) AS item_count,
            fp.name AS first_item_name, fp.image_url AS first_item_image
     FROM follower_orders fo
     JOIN follower_transactions ft ON ft.id = fo.transaction_id
     JOIN brands b ON b.id = ft.brand_id
     LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     LEFT JOIN influencers i ON i.id = ci.influencer_id
     LEFT JOIN LATERAL (
       SELECT bp.name, bp.image_url FROM brand_products bp
        WHERE bp.id = (fo.items_json::jsonb->0->>'product_id')::uuid
     ) fp ON true
     WHERE ft.follower_id = $1
     ORDER BY fo.created_at DESC`,
    [follower.id]
  );

  return success(res, { orders: rows });
});

// ── POST /follower/orders/:id/cancel ─────────────────────────────────────────
// Stage C4 (locked rule): a follower may cancel until 'dispatched' — the same
// guard the UI uses is enforced HERE, so a stale app that still shows the
// button gets a 409, never a late cancel. Prepaid refunds are messaging-only
// until the Wave-3 real-money rails; COD charged nothing. The commission job
// already excludes cancelled orders from release.
const cancelOrder = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { rows } = await db.query(
    `SELECT fo.id, fo.order_status, fo.payment_method, fo.cod_fee,
            ft.net_amount, ft.brand_id, b.user_id AS brand_user_id, b.business_name
       FROM follower_orders fo
       JOIN follower_transactions ft ON ft.id = fo.transaction_id
       JOIN brands b ON b.id = ft.brand_id
      WHERE fo.id = $1 AND ft.follower_id = $2`,
    [req.params.id, follower.id]
  );
  const order = rows[0];
  if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
  if (order.order_status === 'cancelled') {
    throw new AppError('VALIDATION_ERROR', 'This order is already cancelled', 422);
  }
  if (!['confirmed', 'packed'].includes(order.order_status)) {
    throw new AppError('VALIDATION_ERROR', 'This order has been dispatched and can no longer be cancelled', 409);
  }

  // Guarded update — the status check repeats in SQL so a racing brand
  // dispatch beats a racing cancel deterministically (0 rows = lost race).
  const { rows: upd } = await db.query(
    `UPDATE follower_orders
        SET order_status = 'cancelled', cancelled_at = now()
      WHERE id = $1 AND order_status IN ('confirmed','packed')
      RETURNING id, cancelled_at`,
    [order.id]
  );
  if (!upd[0]) {
    throw new AppError('VALIDATION_ERROR', 'This order has been dispatched and can no longer be cancelled', 409);
  }

  if (order.brand_user_id) {
    notificationService.send({
      userId: order.brand_user_id,
      type: 'order.cancelled',
      title: 'Order cancelled',
      body: 'A customer cancelled an order before dispatch. Open Orders for details.',
      sendSms: false,
    }).catch(e => console.error('[NOTIFY] order.cancelled failed:', e.message));
  }

  const prepaid = order.payment_method !== 'cod';
  return success(res, {
    cancelled: true,
    cancelled_at: upd[0].cancelled_at,
    refund: prepaid
      ? { initiated: true, amount: parseFloat(order.net_amount), note: 'Refund initiated to your payment method.' }
      : { initiated: false, amount: 0, note: 'Nothing was charged for this COD order.' },
  });
});

// ── GET /follower/activity ────────────────────────────────────────────────────
// Unified inbox feed for the Orders screen: every follower_transaction (online
// order · pay-at-store · prebook/booking) with brand, the via-creator (4-ID
// attribution), savings, order-tracker status, and booking date/ref. Read-only.
// Enquiries + returns are separate feeds (not yet unioned here) — surfaced when wired.
const listActivity = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { rows } = await db.query(
    `SELECT ft.id, ft.transaction_type, ft.net_amount, ft.discount_amount,
            ft.status AS txn_status, ft.created_at, ft.campaign_influencer_id,
            ft.via_store_influencer_id,
            b.business_name AS brand_name, b.category AS brand_category,
            i.instagram_handle AS via_handle, u_i.name AS via_name,
            fo.id AS order_id, fo.order_status,
            fb.id AS booking_id, fb.booking_date, fb.pickup_date, fb.booking_type
       FROM follower_transactions ft
       JOIN brands b ON b.id = ft.brand_id
       LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
       LEFT JOIN influencers i ON i.id = ci.influencer_id
       LEFT JOIN users u_i ON u_i.id = i.user_id
       LEFT JOIN follower_orders fo ON fo.transaction_id = ft.id
       LEFT JOIN follower_bookings fb ON fb.transaction_id = ft.id
      WHERE ft.follower_id = $1
      ORDER BY ft.created_at DESC
      LIMIT 100`,
    [follower.id]
  );

  // Normalize to inbox items (kind drives the card + tab on the client).
  const items = rows.map(r => {
    const kind = r.booking_id ? 'booking'
      : r.transaction_type === 'online_order' ? 'order'
      : r.transaction_type === 'pay_at_store' ? 'pay_at_store'
      : r.transaction_type === 'prebook' ? 'booking'
      : 'order';
    return {
      id: r.id,
      kind,
      transaction_type: r.transaction_type,
      brand_name: r.brand_name,
      brand_category: r.brand_category,
      net_amount: r.net_amount != null ? parseFloat(r.net_amount) : null,
      savings: r.discount_amount != null ? parseFloat(r.discount_amount) : 0,
      status: r.order_status || r.txn_status || null,
      created_at: r.created_at,
      order_id: r.order_id || null,
      booking_id: r.booking_id || null,
      booking_date: r.booking_date || r.pickup_date || null,
      booking_type: r.booking_type || null,
      via_creator: r.via_handle ? { handle: r.via_handle, name: r.via_name } : null,
    };
  });

  return success(res, { items });
});

// ── GET /follower/orders/:id ──────────────────────────────────────────────────

const getOrder = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  requireFollowerProfile(follower);

  const { rows } = await db.query(
    `SELECT fo.*, ft.net_amount, ft.gross_amount, ft.discount_amount,
            ft.transaction_type,
            ft.created_at AS purchased_at, b.business_name AS brand_name,
            u_b.phone AS brand_contact,
            inf.instagram_handle AS creator_handle, u_i.name AS creator_name,
            a.label AS address_label,
            NULLIF(CONCAT_WS(', ', a.line1, a.line2, a.city, a.pincode), '') AS delivery_address,
            pm.product_meta
     FROM follower_orders fo
     JOIN follower_transactions ft ON ft.id = fo.transaction_id
     JOIN brands b ON b.id = ft.brand_id
     JOIN users u_b ON u_b.id = b.user_id
     LEFT JOIN follower_addresses a ON a.id = fo.address_id
     LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     LEFT JOIN influencers inf ON inf.id = ci.influencer_id
     LEFT JOIN users u_i ON u_i.id = inf.user_id
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(jsonb_build_object('product_id', bp.id, 'name', bp.name, 'image_url', bp.image_url)) AS product_meta
         FROM brand_products bp
        WHERE bp.id IN (SELECT (e->>'product_id')::uuid
                          FROM jsonb_array_elements(fo.items_json::jsonb) e)
     ) pm ON true
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
  const { order_status, courier_name, tracking_number } = req.body;

  // 5-step lifecycle (migration 105): confirmed → packed → dispatched(=Shipped)
  // → out_for_delivery → delivered ; cancelled (terminal). 'dispatched' kept for
  // back-compat as the Shipped step.
  const VALID_STATUSES = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled'];
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

  // Per-step timestamp (set once, on first entry into that status).
  const tsCol = {
    packed: 'packed_at', dispatched: 'dispatched_at',
    out_for_delivery: 'out_for_delivery_at', delivered: 'delivered_at',
    cancelled: 'cancelled_at',
  }[order_status] || null;

  const { rows } = await db.query(
    `UPDATE follower_orders SET
       order_status    = $1,
       courier_name    = COALESCE($2, courier_name),
       tracking_number = COALESCE($3, tracking_number)
       ${tsCol ? `, ${tsCol} = COALESCE(${tsCol}, now())` : ''}
     WHERE id = $4
     RETURNING *`,
    [order_status, courier_name || null, tracking_number || null, id]
  );

  // Notify follower at each meaningful step.
  const followerUserId = existing[0].follower_user_id;
  const msgMap = {
    packed:           'Your order is packed and ready to ship.',
    dispatched:       'Your order has been shipped!',
    out_for_delivery: 'Your order is out for delivery.',
    delivered:        'Your order has been delivered!',
    cancelled:        'Your order has been cancelled.',
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
  initiateStoreOfferPay,
  verifyStoreOfferPay,
  getSlots,
  initiatePrebook,
  verifyPrebook,
  initiatePrebookDateRange,
  verifyPrebookDateRange,
  previewCartOffer,
  placeOrder,
  verifyOrder,
  listOrders,
  cancelOrder,
  listActivity,
  getOrder,
  updateOrderStatus,
};
