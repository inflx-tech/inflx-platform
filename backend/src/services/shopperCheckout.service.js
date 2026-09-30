'use strict';

/**
 * shopperCheckout.service.js — the bag, review and pay, Place order, and writing an order.
 * Contract: features/shopper-ordering (S3, S5, S6) · rules v1.13 §6.6–6.10, §6.13.
 *
 * What an order writes (6.13, R4):
 *   checkouts             one per Place order: amounts, address snapshot, the 15-minute hold
 *   follower_orders       one PARCEL per brand (the brand packs and ships it)
 *   follower_transactions one per POST inside a parcel: one creator, one offer — so the existing
 *                         commission-confirm, commerce-settlement and claw-back jobs run unchanged
 *   order_lines           one per item: its paid share and its three shares (creator · INFLX · brand),
 *                         frozen with the rates that made them
 *
 * The prices come only from orderPricing (R5). Stock is taken at Place order (R6): for cash on
 * delivery the order is written at once; for an online payment the stock is HELD for 15 minutes
 * and the order is written when the payment is verified (the app, or Razorpay's webhook).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const pricing = require('./orderPricing.service');
const stock = require('./stock.service');
const txService = require('./transaction.service');
const appConfig = require('./followerAppConfig.service');
const notificationService = require('./notification.service');
const { inr } = require('./offerRules');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOLD_MINUTES = 15;
const MAX_LINES = 50;
const P = pricing.P;
const R = pricing.R;

/* ───────────────────────────────────────────── settings (6.8, 6.10) */

async function settings() {
  const c = await appConfig.get().catch(() => ({}));
  const n = (v, d) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? d : Number(v));
  return {
    cod_enabled: c.cod_enabled !== false,
    cod_max_amount: n(c.cod_max_amount, 5000),
    cod_fee: n(c.cod_fee, 0),
    delivery_fee: n(c.delivery_fee, 0),               // off at launch (6.10)
    delivery_free_above: n(c.delivery_free_above, 0),
  };
}

/* ───────────────────────────────────────────── lines from the phone */

const str = (v, max) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));

/** Validates what the phone sent. Money fields are never taken from the phone. */
function cleanLines(raw) {
  if (!Array.isArray(raw)) throw new AppError('VALIDATION_ERROR', 'lines must be a list', 400, 'lines');
  if (raw.length > MAX_LINES) throw new AppError('VALIDATION_ERROR', `At most ${MAX_LINES} items`, 400, 'lines');
  return raw.map((l, i) => {
    if (!l || !UUID.test(String(l.post_id || ''))) throw new AppError('VALIDATION_ERROR', 'Each item needs its post', 400, 'post_id');
    const productId = UUID.test(String(l.product_id || '')) ? String(l.product_id) : null;
    const giftId = UUID.test(String(l.gift_item_id || '')) ? String(l.gift_item_id) : null;
    if (!productId && !giftId) throw new AppError('VALIDATION_ERROR', 'Each item needs a product', 400, 'product_id');
    const qty = Math.trunc(Number(l.qty === undefined ? 1 : l.qty));
    if (!(qty >= 1 && qty <= pricing.MAX_QTY)) throw new AppError('VALIDATION_ERROR', `Choose 1 to ${pricing.MAX_QTY}`, 400, 'qty');
    return {
      ref: l.ref != null ? String(l.ref).slice(0, 64) : String(i),
      post_id: String(l.post_id), product_id: productId, gift_item_id: giftId,
      colour: str(l.colour, 60), size: str(l.size, 30), qty,
      role: l.role === 'gift' ? 'gift' : l.role === 'free' ? 'free' : 'buy',
      price_seen: l.price_seen == null || !Number.isFinite(Number(l.price_seen)) ? null : Number(l.price_seen),
      ticked: l.ticked !== false,
    };
  });
}

/** Same post + product + colour + size + role adds quantity, up to 5 (6.6). */
function mergeSame(lines) {
  const out = [];
  const at = new Map();
  for (const l of lines) {
    const k = [l.post_id, l.product_id, l.gift_item_id, (l.colour || '').toLowerCase(), (l.size || '').toLowerCase(), l.role].join('|');
    if (at.has(k)) { const m = out[at.get(k)]; m.qty = Math.min(pricing.MAX_QTY, m.qty + l.qty); continue; }
    at.set(k, out.length); out.push({ ...l });
  }
  return out;
}

/* ───────────────────────────────────────────── the bag (S3) */

async function followerIdOf(userId, conn = db) {
  const { rows } = await conn.query(`SELECT id FROM followers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Shopper not found', 404);
  return rows[0].id;
}

async function readBag(followerId, conn = db) {
  const { rows } = await conn.query(
    `SELECT id, post_id, product_id, gift_item_id, colour, size, qty, role, deal_key, ticked, price_seen
       FROM follower_bag_items WHERE follower_id = $1 ORDER BY added_at, id`, [followerId]);
  return rows.map((r) => ({ ...r, ref: r.id, price_seen: r.price_seen == null ? null : Number(r.price_seen) }));
}

/** Replaces the whole bag at once (the phone holds the truth while she edits). */
async function writeBag(followerId, rawLines) {
  const lines = mergeSame(cleanLines(rawLines));
  await db.withTransaction(async (conn) => {
    await conn.query(`DELETE FROM follower_bag_items WHERE follower_id = $1`, [followerId]);
    for (const l of lines) {
      await conn.query(
        // clock_timestamp(), not now(): every row of one bag shares the transaction's now(), and the
        // bag must come back in the order she added things.
        `INSERT INTO follower_bag_items (follower_id, post_id, product_id, gift_item_id, colour, size, qty, role, ticked, price_seen, added_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, clock_timestamp())`,
        [followerId, l.post_id, l.product_id, l.gift_item_id, l.colour, l.size, l.qty, l.role, l.ticked, l.price_seen]);
    }
  });
  return readBag(followerId);
}

/** A guest's phone bag joins her account at sign-in (5.2, O8). Nothing she had is lost. */
async function mergeIntoBag(followerId, rawLines) {
  if (!Array.isArray(rawLines) || !rawLines.length) return readBag(followerId);
  const mine = await readBag(followerId);
  return writeBag(followerId, [...mine, ...rawLines].slice(0, MAX_LINES));
}

/** The priced bag: groups by post with progress and problems, and the totals (O6, O7, D11). */
async function priceBag(lines) {
  const priced = await pricing.priceLines(mergeSame(cleanLines(lines)));
  return shape(priced);
}

/** The engine's answer without its internals, plus names for each group. */
async function shape(priced) {
  const ctxs = priced.contexts;
  const infl = [...new Set(priced.groups.map((g) => g.influencer_id).filter(Boolean))];
  const brands = [...new Set(priced.groups.map((g) => g.brand_id).filter(Boolean))];
  const { rows: ir } = infl.length ? await db.query(
    `SELECT i.id, COALESCE(i.full_name, u.name) AS name, i.profile_image_url AS avatar FROM influencers i JOIN users u ON u.id = i.user_id
      WHERE i.id = ANY($1::uuid[])`, [infl]) : { rows: [] };
  const { rows: br } = brands.length ? await db.query(
    `SELECT id, business_name AS name, logo_url AS logo FROM brands WHERE id = ANY($1::uuid[])`, [brands]) : { rows: [] };
  const creator = new Map(ir.map((r) => [r.id, r]));
  const brand = new Map(br.map((r) => [r.id, r]));
  return {
    groups: priced.groups.map((g) => ({
      post_id: g.post_id,
      creator: creator.get(g.influencer_id) || null,
      brand: brand.get(g.brand_id) || null,
      offer: g.offer, progress: g.progress, gift: g.gift, problems: g.problems, buyable: g.buyable,
      normal_total: g.normal_total, paid_total: g.paid_total, savings: g.savings, gift_value: g.gift_value,
      lines: g.lines.map((l) => ({
        ref: l.ref, product_id: l.product_id, gift_item_id: l.gift_item_id, name: l.name, image_url: l.image_url,
        colour: l.colour, size: l.size, qty: l.qty, role: l.role, deal_key: l.deal_key, auto: l.auto,
        normal_unit: l.normal_unit, normal_total: l.normal_total, paid_total: l.paid_total,
        stock_left: l.stock != null && l.stock <= 3 ? l.stock : null,
        problems: l.problems, notes: l.notes, price_was: l.price_was || null,
      })),
    })),
    unticked: priced.unticked,
    items_normal: priced.items_normal, savings: priced.savings, items_total: priced.items_total,
    buyable: priced.buyable,
    _contexts: ctxs,
  };
}

/* ───────────────────────────────────────────── addresses (S4) as checkout reads them */

async function addressFor(followerId, addressId, conn = db) {
  if (!UUID.test(String(addressId || ''))) throw new AppError('VALIDATION_ERROR', 'Choose an address', 400, 'address_id');
  const { rows } = await conn.query(
    `SELECT id, label, receiver_name, receiver_phone, house, area, line1, line2, landmark, city, state, pincode
       FROM follower_addresses WHERE id = $1 AND follower_id = $2 AND deleted_at IS NULL`, [addressId, followerId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Address not found', 404, 'address_id');
  return rows[0];
}

/** "Arrives by": the brand's distance when both ends are known, else the reference days (6.8). */
async function arrivesBy(brandId) {
  let days = 2;
  try {
    const cfg = await require('./paymentConfig.service').getConfig();
    days = parseInt(cfg.deliveryRefDays, 10) || 2;
  } catch (_) { /* default */ }
  const d = new Date(Date.now() + (days + 1) * 86400000);   // +1: the brand packs first
  return d.toISOString().slice(0, 10);
}

/* ───────────────────────────────────────────── review and pay (O11, O12) */

/**
 * Everything the review shows, and the numbers Place order will charge. Parcels per brand with
 * their arrival dates; price details; which payment methods she may use and why not.
 */
async function review(followerId, { address_id, lines, payment_method }) {
  const address = await addressFor(followerId, address_id);
  const clean = mergeSame(cleanLines(lines)).map((l) => ({ ...l, ticked: true }));
  if (!clean.length) throw new AppError('VALIDATION_ERROR', 'Nothing to order', 400, 'lines');
  const bag = await shape(await pricing.priceLines(clean));
  const cfg = await settings();

  const byBrand = new Map();
  for (const g of bag.groups) {
    const k = g.brand ? g.brand.id : 'x';
    if (!byBrand.has(k)) byBrand.set(k, { brand: g.brand, groups: [] });
    byBrand.get(k).groups.push(g);
  }
  const parcels = [];
  for (const [brandId, p] of byBrand) {
    const items = p.groups.reduce((s, g) => s + P(g.paid_total), 0);
    const fee = cfg.delivery_fee > 0 && (!cfg.delivery_free_above || R(items) < cfg.delivery_free_above) ? P(cfg.delivery_fee) : 0;
    parcels.push({ brand: p.brand, arrives_by: await arrivesBy(brandId), groups: p.groups, items_total: R(items), delivery_fee: R(fee) });
  }
  const delivery = parcels.reduce((s, x) => s + P(x.delivery_fee), 0);
  const base = P(bag.items_total) + delivery;
  const codAllowed = cfg.cod_enabled && R(base + P(cfg.cod_fee)) <= cfg.cod_max_amount;
  const method = payment_method === 'cod' ? 'cod' : 'online';
  const codFee = method === 'cod' ? P(cfg.cod_fee) : 0;
  const problems = bag.groups.flatMap((g) => [...g.problems, ...g.lines.flatMap((l) => l.problems)]);
  return {
    address,
    parcels,
    items_normal: bag.items_normal,
    savings: bag.savings,
    delivery_fee: R(delivery),
    cod_fee: R(codFee),
    total: R(base + codFee),
    payment_method: method,
    payment: {
      online: { allowed: true, total: R(base) },
      cod: {
        allowed: codAllowed, fee: cfg.cod_fee, total: R(base + P(cfg.cod_fee)), max: cfg.cod_max_amount,
        reason: codAllowed ? null : !cfg.cod_enabled ? 'Cash on delivery is not available right now'
          : `Not available above ${inr(cfg.cod_max_amount)}`,
      },
    },
    buyable: bag.buyable && problems.length === 0,
    problems,
    _bag: bag,
    _lines: clean,
  };
}

/* ───────────────────────────────────────────── Place order (6.8) */

/** The products and gifts a priced review takes from stock. */
function stockNeeds(rv) {
  const products = [];
  const gifts = [];
  for (const g of rv._bag.groups) {
    for (const l of g.lines) {
      if (l.role === 'gift') {
        const ctx = rv._bag._contexts.get(g.post_id);
        const gift = ctx && ctx.gifts.get(l.gift_item_id ? `g:${l.gift_item_id}` : `p:${l.product_id}`);
        gifts.push({ pool_item_id: gift ? gift.pool_item_id : null, gift_item_id: l.gift_item_id, product_id: l.gift_item_id ? null : l.product_id,
          colour: l.colour, size: l.size, qty: l.qty, name: l.name });
      } else {
        products.push({ product_id: l.product_id, colour: l.colour, size: l.size, qty: l.qty, name: l.name });
      }
    }
  }
  return { products, gifts };
}

/** What is frozen on the checkout: every group with its ids and every priced line (6.13). */
function frozen(rv) {
  return {
    parcels: rv.parcels.map((p) => ({
      brand_id: p.brand ? p.brand.id : null, arrives_by: p.arrives_by, delivery_fee: p.delivery_fee,
      groups: p.groups.map((g) => {
        const ctx = rv._bag._contexts.get(g.post_id);
        const priced = ctx ? pricing.priceGroup(ctx, rv._lines.filter((l) => l.post_id === g.post_id)) : null;
        return {
          post_id: g.post_id, offer_id: g.offer ? g.offer.id : null,
          campaign_influencer_id: ctx.campaign_influencer_id, influencer_id: ctx.influencer_id,
          campaign_id: ctx.campaign_id, set_id: ctx.set_id,
          commission_pct: priced.commission_pct, fee_pct: priced.fee_pct, fee_source: priced.fee_source,
          normal_total: priced.normal_total, paid_total: priced.paid_total, savings: priced.savings,
          lines: priced.lines.map((l) => ({
            product_id: l.product_id, gift_item_id: l.gift_item_id, pool_item_id: l.pool_item_id, name: l.name, image_url: l.image_url,
            colour: l.colour, size: l.size, qty: l.qty, role: l.role, deal_key: l.deal_key,
            normal_unit: l.normal_unit, normal_total: l.normal_total, paid_total: l.paid_total,
            commission: l.commission, platform_fee: l.platform_fee, brand_net: l.brand_net,
          })),
        };
      }),
    })),
  };
}

/**
 * Place order ₹X. The total she saw must still be the total (M8), else nothing is taken and the
 * new review comes back. Cash on delivery writes the order now; online holds the stock 15 minutes.
 */
async function place(followerId, body, { deviceId = null } = {}) {
  const method = body.payment_method === 'cod' ? 'cod' : body.payment_method === 'online' ? 'online' : null;
  if (!method) throw new AppError('VALIDATION_ERROR', 'Choose how to pay', 400, 'payment_method');
  const rv = await review(followerId, { ...body, payment_method: method });
  if (!rv.buyable) throw Object.assign(new AppError('CONFLICT', 'Something in your order changed', 409), { details: publicReview(rv) });
  if (method === 'cod' && !rv.payment.cod.allowed) throw new AppError('VALIDATION_ERROR', rv.payment.cod.reason, 400, 'payment_method');
  const expected = Number(body.expected_total);
  if (!Number.isFinite(expected) || P(expected) !== P(rv.total)) {
    throw Object.assign(new AppError('PRICE_CHANGED', `The total is now ${inr(rv.total)}`, 409), { details: publicReview(rv) });
  }
  if (!(rv.total > 0)) throw new AppError('VALIDATION_ERROR', 'Nothing to pay for', 400);

  const snapshot = frozen(rv);
  const needs = stockNeeds(rv);
  const a = rv.address;
  const addressSnapshot = {
    name: a.receiver_name, phone: a.receiver_phone, house: a.house || a.line1, area: a.area || a.line2,
    landmark: a.landmark, city: a.city, state: a.state, pincode: a.pincode, label: a.label,
  };

  const razorpayOrderId = method === 'online'
    ? await txService.createOrder(rv.total, { type: 'shopper_checkout', follower_id: followerId })
    : null;

  const result = await db.withTransaction(async (conn) => {
    const took = await stock.take(conn, needs);
    if (!took.ok) {
      const names = [...new Set(took.short.map((s) => s.name).filter(Boolean))];
      throw Object.assign(new AppError('STOCK_UNAVAILABLE', names.length ? `Sold out: ${names.join(', ')}` : 'Something just sold out', 409), { details: { short: took.short } });
    }
    const { rows: [co] } = await conn.query(
      `INSERT INTO checkouts (follower_id, status, payment_method, address_id, address_snapshot, items_normal, savings,
                              delivery_fee, cod_fee, total, priced, razorpay_order_id, device_id, expires_at)
       VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               CASE WHEN $2 = 'online' THEN now() + make_interval(mins => $13) ELSE NULL END)
       RETURNING *`,
      [followerId, method, a.id, JSON.stringify(addressSnapshot), rv.items_normal, rv.savings, rv.delivery_fee, rv.cod_fee,
        rv.total, JSON.stringify(snapshot), razorpayOrderId, deviceId, HOLD_MINUTES]);
    if (method === 'cod') await writeOrders(conn, co, null);
    return co;
  });

  // Emptying the bag: what she ordered leaves it; unticked items stay (6.6).
  await removeOrderedFromBag(followerId, rv._lines).catch(() => {});
  if (method === 'cod') await notifyPlaced(result.id).catch((e) => console.error('[checkout] notify', e.message));
  return {
    checkout_id: result.id, status: method === 'cod' ? 'placed' : 'pending', total: rv.total, payment_method: method,
    razorpay: razorpayOrderId ? { order_id: razorpayOrderId, key_id: txService.getRazorpayKeyId(), amount: rv.total, expires_in_s: HOLD_MINUTES * 60 } : null,
  };
}

async function removeOrderedFromBag(followerId, lines) {
  for (const l of lines) {
    await db.query(
      `DELETE FROM follower_bag_items WHERE follower_id = $1 AND post_id = $2
          AND product_id IS NOT DISTINCT FROM $3 AND gift_item_id IS NOT DISTINCT FROM $4
          AND lower(COALESCE(colour,'')) = lower(COALESCE($5,'')) AND lower(COALESCE(size,'')) = lower(COALESCE($6,'')) AND role = $7`,
      [followerId, l.post_id, l.product_id, l.gift_item_id, l.colour, l.size, l.role]);
  }
}

/** The review without internals, for the phone. */
function publicReview(rv) {
  const { _bag, _lines, ...rest } = rv;
  const { _contexts, ...bag } = _bag;
  return { ...rest, groups: bag.groups };
}

/* ───────────────────────────────────────────── writing the order (S6) */

/**
 * Writes the parcels, the money rows and the lines for a checkout, inside the caller's
 * transaction. Idempotent on the checkout: a placed checkout is never written twice.
 */
async function writeOrders(conn, checkout, paymentId) {
  const { rows: [co] } = await conn.query(`SELECT * FROM checkouts WHERE id = $1 FOR UPDATE`, [checkout.id]);
  if (co.status === 'placed') return { already: true };
  const snap = co.priced;
  const settlement = require('./settlement.service');
  const postLinks = require('./postLinks.service');
  let codFeeLeft = Number(co.cod_fee) || 0;
  const parcelIds = [];

  for (const parcel of snap.parcels) {
    const txIds = [];
    for (const g of parcel.groups) {
      const sum = (k) => R(g.lines.reduce((s, l) => s + P(l[k]), 0));
      const windowEnds = await settlement.resolveReturnWindowEndsAt(conn, parcel.brand_id);
      const channel = await postLinks.channelForOrder({ deviceId: co.device_id, influencerId: g.influencer_id, postId: g.post_id }).catch(() => null);
      const first = g.lines.find((l) => l.product_id && l.role !== 'gift');
      const { rows: [tx] } = await conn.query(
        `INSERT INTO follower_transactions
           (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id, brand_offer_id, offer_source,
            product_id, transaction_type, gross_amount, discount_amount, net_amount, influencer_commission,
            marketplace_fee_amount, brand_net, status, razorpay_payment_id, return_window_ends_at, via_post_id,
            link_channel, checkout_id)
         VALUES ($1,$2,$3,$4,$5,$6,'influencer',$7,'online_order',$8,$9,$10,$11,$12,$13,'completed',$14,$15,$16,$17,$18)
         RETURNING id`,
        [co.follower_id, parcel.brand_id, g.campaign_id, g.set_id, g.campaign_influencer_id, g.offer_id,
          first ? first.product_id : null, g.normal_total, g.savings, g.paid_total, sum('commission'),
          sum('platform_fee'), sum('brand_net'), paymentId, windowEnds, g.post_id, channel, co.id]);
      txIds.push({ id: tx.id, g });
      const commission = sum('commission');
      if (commission > 0) await txService.creditInfluencerCommission(conn, g.influencer_id, commission, tx.id);
    }
    const codFee = codFeeLeft; codFeeLeft = 0;           // once per checkout, on the first parcel (as before)
    const { rows: br } = await conn.query(`SELECT u.phone FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`, [parcel.brand_id]);
    const itemsJson = parcel.groups.flatMap((g) => g.lines.map((l) => ({
      product_id: l.product_id, gift_item_id: l.gift_item_id, name: l.name, qty: l.qty, colour: l.colour, size: l.size,
      role: l.role, line_total: l.paid_total, post_id: g.post_id,
    })));
    const { rows: [order] } = await conn.query(
      `INSERT INTO follower_orders
         (transaction_id, address_id, order_status, estimated_delivery_date, whatsapp_number, items_json,
          payment_method, cod_fee, checkout_id, brand_id, address_snapshot, delivery_fee)
       VALUES ($1,$2,'confirmed',$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [txIds[0].id, co.address_id, parcel.arrives_by, br[0] ? String(br[0].phone || '').slice(-15) : null, JSON.stringify(itemsJson),
        co.payment_method === 'cod' ? 'cod' : 'prepaid', codFee, co.id, parcel.brand_id, JSON.stringify(co.address_snapshot),
        parcel.delivery_fee || 0]);
    parcelIds.push(order.id);
    for (const { id: txId, g } of txIds) {
      await conn.query(`UPDATE follower_transactions SET order_id = $2 WHERE id = $1`, [txId, order.id]);
      for (const l of g.lines) {
        await conn.query(
          `INSERT INTO order_lines
             (checkout_id, order_id, transaction_id, follower_id, brand_id, post_id, influencer_id, campaign_influencer_id,
              offer_id, product_id, gift_item_id, pool_item_id, name, image_url, colour, size, qty, role, deal_key,
              normal_unit, normal_total, paid_total, commission_pct, commission, fee_pct, fee_source, platform_fee, brand_net)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
          [co.id, order.id, txId, co.follower_id, parcel.brand_id, g.post_id, g.influencer_id, g.campaign_influencer_id,
            g.offer_id, l.gift_item_id ? null : l.product_id, l.gift_item_id, l.pool_item_id, l.name || 'Item', l.image_url,
            l.colour, l.size, l.qty, l.role, l.deal_key, l.normal_unit, l.normal_total, l.paid_total,
            g.commission_pct, l.commission, g.fee_pct, g.fee_source, l.platform_fee, l.brand_net]);
      }
    }
  }
  await conn.query(
    `UPDATE checkouts SET status = 'placed', placed_at = now(), razorpay_payment_id = COALESCE($2, razorpay_payment_id) WHERE id = $1`,
    [co.id, paymentId]);
  return { placed: true, parcel_ids: parcelIds };
}

/* ───────────────────────────────────────────── the payment arrives (6.8) */

/**
 * Verified payment → the order is written. Called by the app (with Razorpay's signature) and by
 * the webhook (already verified there). Safe to call twice. If the 15-minute hold already ended,
 * the stock is taken again; if it is gone, the whole payment is refunded.
 */
async function paymentArrived({ razorpayOrderId, paymentId, followerId = null }) {
  const { rows } = await db.query(`SELECT * FROM checkouts WHERE razorpay_order_id = $1`, [razorpayOrderId]);
  const co = rows[0];
  if (!co || (followerId && co.follower_id !== followerId)) throw new AppError('NOT_FOUND', 'Order not found', 404);
  if (co.status === 'placed') return { checkout_id: co.id, status: 'placed', already: true };
  if (co.status === 'refunded') return { checkout_id: co.id, status: 'refunded', already: true };

  let refund = false;
  const out = await db.withTransaction(async (conn) => {
    const { rows: [locked] } = await conn.query(`SELECT * FROM checkouts WHERE id = $1 FOR UPDATE`, [co.id]);
    if (locked.status === 'placed' || locked.status === 'refunded') return { status: locked.status, already: true };
    await conn.query(`UPDATE payment_pending_orders SET consumed_at = now() WHERE order_id = $1 AND consumed_at IS NULL`, [razorpayOrderId]);
    if (locked.status === 'expired' || locked.status === 'failed') {
      const took = await stock.take(conn, needsFromSnapshot(locked.priced));
      if (!took.ok) {
        await conn.query(`UPDATE checkouts SET status = 'refunded', razorpay_payment_id = $2 WHERE id = $1`, [locked.id, paymentId]);
        refund = true;
        return { status: 'refunded' };
      }
    }
    await writeOrders(conn, locked, paymentId);
    return { status: 'placed' };
  });
  if (refund) {
    try {
      const id = await txService.refundPayment(paymentId, Number(co.total), { checkout_id: co.id, reason: 'sold_out_after_hold' });
      await db.query(`UPDATE checkouts SET refund_id = $2 WHERE id = $1`, [co.id, id]);
    } catch (e) { console.error(`[checkout] REFUND FAILED for ${co.id}: ${e.message}`); }
  } else if (!out.already) {
    await notifyPlaced(co.id).catch((e) => console.error('[checkout] notify', e.message));
  }
  return { checkout_id: co.id, status: out.status, already: !!out.already };
}

/** The app's verify: Razorpay's signature first. */
async function verify(followerId, body) {
  const orderId = String(body.razorpay_order_id || '');
  const paymentId = String(body.razorpay_payment_id || '');
  if (!orderId || !paymentId) throw new AppError('VALIDATION_ERROR', 'Payment details missing', 400);
  if (!txService.verifyPaymentSignature(orderId, paymentId, body.razorpay_signature)) {
    throw new AppError('VALIDATION_ERROR', 'Payment could not be verified', 400, 'razorpay_signature');
  }
  return paymentArrived({ razorpayOrderId: orderId, paymentId, followerId });
}

function needsFromSnapshot(snap) {
  const products = [];
  const gifts = [];
  for (const p of snap.parcels) for (const g of p.groups) for (const l of g.lines) {
    if (l.role === 'gift') gifts.push({ pool_item_id: l.pool_item_id, gift_item_id: l.gift_item_id, product_id: l.gift_item_id ? null : l.product_id, colour: l.colour, size: l.size, qty: l.qty, name: l.name });
    else products.push({ product_id: l.product_id, colour: l.colour, size: l.size, qty: l.qty, name: l.name });
  }
  return { products, gifts };
}

/** The 15-minute hold ends: nothing ordered, stock and gifts back (checkout-expiry job). */
async function expireHolds(now = new Date()) {
  const { rows } = await db.query(
    `SELECT id FROM checkouts WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= $1 ORDER BY expires_at LIMIT 200`, [now]);
  let expired = 0;
  for (const r of rows) {
    await db.withTransaction(async (conn) => {
      const { rows: [co] } = await conn.query(`SELECT * FROM checkouts WHERE id = $1 FOR UPDATE`, [r.id]);
      if (!co || co.status !== 'pending') return;
      await stock.giveBack(conn, needsFromSnapshot(co.priced));
      await conn.query(`UPDATE checkouts SET status = 'expired' WHERE id = $1`, [co.id]);
      expired += 1;
    });
  }
  return { expired };
}

/* ───────────────────────────────────────────── telling people (6.9) */

async function notifyPlaced(checkoutId) {
  const { rows: [co] } = await db.query(
    `SELECT c.id, c.total, c.payment_method, f.user_id FROM checkouts c JOIN followers f ON f.id = c.follower_id WHERE c.id = $1`, [checkoutId]);
  if (!co) return;
  const { rows: parcels } = await db.query(
    `SELECT o.id, o.brand_id, b.user_id AS brand_user, b.business_name FROM follower_orders o JOIN brands b ON b.id = o.brand_id WHERE o.checkout_id = $1`, [checkoutId]);
  await notificationService.send({ userId: co.user_id, type: 'order_placed', title: 'Order placed',
    body: `${inr(co.total)} · ${parcels.length} parcel${parcels.length > 1 ? 's' : ''}${co.payment_method === 'cod' ? ' · pay on delivery' : ''}`,
    data: { checkout_id: co.id } });
  for (const p of parcels) {
    await notificationService.send({ userId: p.brand_user, type: 'brand_new_order', title: 'New order',
      body: 'A shopper ordered from your store. Pack it and mark it Packed.', data: { order_id: p.id } });
  }
  const { rows: sales } = await db.query(
    `SELECT DISTINCT i.user_id, l.post_id FROM order_lines l JOIN influencers i ON i.id = l.influencer_id WHERE l.checkout_id = $1`, [checkoutId]);
  for (const s of sales) {
    await notificationService.send({ userId: s.user_id, type: 'creator_post_sale', title: 'A sale through your post',
      body: 'Someone bought through your post. Your commission is in pending earnings.', data: { post_id: s.post_id } });
  }
}

module.exports = {
  HOLD_MINUTES, settings, cleanLines, mergeSame, followerIdOf,
  readBag, writeBag, mergeIntoBag, priceBag, review, publicReview, place, verify, paymentArrived,
  writeOrders, expireHolds, needsFromSnapshot, notifyPlaced,
};
