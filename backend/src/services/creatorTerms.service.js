'use strict';

/**
 * creatorTerms — what a creator can sell in a collaboration (Level 2). Contract: features/creator-terms-v2
 * Rules: Docs/OFFER_TERMS_POSTS_RULES.md §2 (v1.4); locked screens T1–T7 (brand), C1–C5 (creator).
 *
 * For Pay for Sale and Hybrid, "what she can sell" is:
 *   · her OFFERS — one or more of the brand's published offers that start on or before the posting
 *     date and end at least a day after it (2.3, v1.15: the posting date is the LAST day to go
 *     live, so the offer must be there for a creator who goes live on it). LINKED through
 *     collab_offers, never copied: ending an offer reaches her collaboration by itself;
 *   · her PRODUCTS WITHOUT OFFERS — none, all, or chosen (2.4), from the products not held by any
 *     offer from the day the terms are sent (v1.15: her post can be live from that day on),
 *     FROZEN when the invitation is sent (founder Q2).
 * At least one of the two (2.2). Offers and products can't be countered (2.6) or added after
 * signing (2.8). When the brand ends an offer that sits in unsigned invitations, it drops out of
 * them, the creators are told, and an invitation left with nothing to sell is withdrawn (Q1).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { calendarDay, daysBetween, todayInIndia, istDayOf } = require('../utils/indiaDay');
const rules = require('./offerRules');
const pool = require('./offerPool.service');
const notificationService = require('./notification.service');
const { SIGNED_CONTRACT_SQL } = require('./collabState');

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'this creator';
const ENDS_SOON_DAYS = 7;
const LIVE_CI = ['invited', 'applied', 'accepted', 'negotiating', 'contracted', 'active', 'completed'];
const PRE_SIGN = ['invited', 'applied', 'accepted', 'negotiating'];

const MSG = {
  SELL_NOTHING: (name) => `Give ${first(name)} at least one offer or one product without an offer.`,
  // Item 21 (rules v1.34): Pay for Content words, and the Entire store.
  POST_ABOUT_NOTHING: (name) => `Give ${first(name)} at least one offer or one product to post about, or your entire store.`,
  POSTS_N: 'How many shoppable posts should she make? 1 to 10.',
  STORE_EMPTY: 'Your store has nothing to sell yet. Publish an offer or a product first.',
  CANT_COUNTER_SELL: "What you post about is the brand's to set.",
  OLD_TERMS: 'What a creator can sell has changed. Update the app, then set her terms again.',
  OFFER_UNKNOWN: "One of those offers isn't one of yours.",
  OFFER_NOT_VALID: (offer, day) => `"${offer}" has to start by ${rules.dayMonth(day)} and end after it. It can't be given for this set.`,
  PRODUCT_IN_OFFER: (product) => `"${product}" is in an offer, now or later. To give it, give its offer.`,
  PRODUCT_UNKNOWN: "One of those products isn't one of your published products.",
  NO_PRODUCTS_FREE: () => 'No product is free of offers from today.',
};

const NOTIFY = {
  offerDropped: (offerName, brandName) => ({
    type: 'offer_dropped',
    title: `"${offerName}" was taken out of your invitation`.slice(0, 100),
    body: `${brandName} ended this offer before you signed, so it's no longer in what you can sell.`,
  }),
  withdrawnEmpty: (brandName) => ({
    type: 'invitation.withdrawn',
    title: 'Invitation withdrawn',
    body: `${brandName} ended the offers in this invitation, so there's nothing left for you to sell. It's been withdrawn.`,
  }),
  outOfStock: (productName) => ({
    type: 'product_out_of_stock',
    title: `${productName} is out of stock`.slice(0, 100),
    body: "Shoppers can't buy it until the brand restocks it.",
  }),
  unavailable: (productName) => ({
    type: 'product_unavailable',
    title: `${productName} is no longer available`.slice(0, 100),
    body: 'The brand took it off sale, so it leaves what you can sell and your posts.',
  }),
  // listing-shop-safety (board C1): hidden is a pause, and Show brings it back.
  paused: (productName) => ({
    type: 'product_paused',
    title: `${productName} is not on sale right now`.slice(0, 100),
    body: 'The brand has paused it. It is back in your posts when the brand shows it again.',
  }),
  backOnSale: (productName) => ({
    type: 'product_back_on_sale',
    title: `${productName} is back on sale`.slice(0, 100),
    body: 'It is in your posts again.',
  }),
  priceChanged: (productName, oldPrice, newPrice) => ({
    type: 'offer_price_changed',
    title: `Price changed: ${productName}`.slice(0, 100),
    body: `${rules.inr(oldPrice)} → ${rules.inr(newPrice)} · it sells at the new price.`,
  }),
};

/* ───────────────────────────────────────────── the brand's choices (T2, T3, T4, T6) */

/**
 * Offers the brand can give for a posting date (2.3, v1.15): published, starting on or before that
 * day and ending at least one day after it — the posting date is the last day to go live, so a
 * creator who goes live on it must still have the offer, and one that starts later could never be
 * live in time. With the "ends within 7 days after posting" warning; plus the offers left out and why.
 * This is the BRAND's view: an offer the brand deleted (offer-delete, deleted_at) is in neither list.
 * Her own reads below (sellFor, creatorOffer, agreementSell) never filter on it.
 */
async function offerChoices(brandId, postingDate) {
  const D = calendarDay(postingDate);
  const { rows } = await db.query(
    `SELECT o.id, o.name, o.offer_type, o.sub_type, o.offer_config_json, o.status, o.starts_on, o.ends_on, o.ended_at,
            (SELECT count(*)::int FROM offer_pool_items i WHERE i.offer_id = o.id AND i.pool = 'buy' AND i.removed_at IS NULL) AS products,
            (SELECT count(*)::int FROM offer_pool_items i WHERE i.offer_id = o.id AND i.pool = 'gift' AND i.removed_at IS NULL) AS gifts
       FROM brand_offers o
      WHERE o.brand_id = $1 AND o.engine = 2 AND o.status IN ('published', 'ended') AND o.deleted_at IS NULL
      ORDER BY o.starts_on, o.name`, [brandId]);
  const offers = [], hidden = [];
  for (const r of rows) {
    const s = calendarDay(r.starts_on), e = calendarDay(r.ends_on);
    const valid = r.status === 'published' && daysBetween(s, D) >= 0 && daysBetween(D, e) >= 1;
    const shaped = { ...r, starts_on: s, ends_on: e, offer_config_json: r.offer_config_json || {} };
    if (valid) {
      const after = daysBetween(D, e);
      offers.push({
        id: r.id, name: r.name, type_label: rules.typeLabel(r.offer_type, r.sub_type),
        deal: rules.creatorDeal(shaped, r.products, r.gifts),
        products: r.products, gifts: r.gifts, starts_on: s, ends_on: e,
        ends_soon: after < ENDS_SOON_DAYS ? { days_after_posting: after } : null,
      });
    } else if (r.status === 'ended') {
      hidden.push({ name: r.name, why: 'ended', date: r.ended_at ? istDayOf(r.ended_at) : e });
    } else if (daysBetween(D, s) > 0) hidden.push({ name: r.name, why: 'starts', date: s });
    // Over already, or still running but gone by the posting date (it must end after it).
    else hidden.push({ name: r.name, why: daysBetween(e, todayInIndia()) > 0 ? 'ended' : 'ends', date: e });
  }
  return { posting_date: D, offers, hidden };
}

/**
 * Products not held by any offer from TODAY on (2.4, v1.15). It used to be "from the posting date":
 * with the posting date as the last day, her post at normal price can be live from the day it is
 * approved, so a product still inside another offer until then must not be given. `postingDate` is
 * kept in the signature for its callers and no longer decides anything.
 */
async function freeProducts(brandId, postingDate, filters = {}) { // eslint-disable-line no-unused-vars
  return pool.productsWithoutOffers(brandId, { ...filters, day: todayInIndia(), mode: 'on_or_after' });
}

/* ───────────────────────────────────────────── at sending */

/** Normalises the new terms from the app: { offers:[ids], productsWithoutOffers:{ mode, productIds } }. */
function readSellInput(raw) {
  const t = raw || {};
  const offersIn = t.offers !== undefined ? t.offers : t.offer_ids;
  const pwo = t.productsWithoutOffers !== undefined ? t.productsWithoutOffers : t.products_without_offers;
  if (offersIn === undefined && pwo === undefined) return null;
  // Item 21 (rules v1.34 §7A): the Entire store — every offer and every product without an offer,
  // now and later. Sent as { productsWithoutOffers: { mode: 'store' } } or { entireStore: true }.
  if ((pwo && pwo.mode === 'store') || t.entireStore === true || t.entire_store === true) return { offerIds: [], mode: 'store', productIds: [] };
  const offerIds = Array.isArray(offersIn) ? [...new Set(offersIn.map((x) => (x && typeof x === 'object' ? x.id : x)).filter(Boolean).map(String))] : [];
  const mode = pwo && ['none', 'all', 'chosen'].includes(pwo.mode) ? pwo.mode : 'none';
  const productIds = pwo && Array.isArray(pwo.productIds || pwo.product_ids)
    ? [...new Set((pwo.productIds || pwo.product_ids).filter(Boolean).map(String))] : [];
  return { offerIds, mode, productIds };
}

/**
 * Item 21 — what the Entire store holds today: published offers not ended, and the products in no
 * offer TODAY (the same list her price-post picker reads, as a post for the creator's own brand
 * reads it — item 20, D1). A product whose offer starts later is hers at normal price until then.
 */
async function storeToday(brandId, { today = todayInIndia() } = {}) {
  const { rows: [o] } = await db.query(
    `SELECT count(*)::int AS n FROM brand_offers o
      WHERE o.brand_id = $1 AND o.engine = 2 AND o.status = 'published' AND o.ends_on >= $2::date`, [brandId, today]);
  const free = await pool.productsWithoutOffers(brandId, { day: today, mode: 'on' });
  return { offers: o.n, products: free.length, productIds: free.map((p) => p.id) };
}

/**
 * Validates what the brand gives this creator and FREEZES the products. Throws the first problem.
 * @returns { offerIds, mode, productIds, endsSoon:[offer names] }
 */
async function resolveSell({ brandId, postingDate, sell, creatorName, postsAbout = false }) {
  const D = calendarDay(postingDate);
  const out = { offerIds: [], mode: sell.mode, productIds: [], endsSoon: [] };
  // Item 21: the Entire store is a rule, not a list — nothing is frozen. It can only be sent on a
  // store that has something to sell today (R2).
  if (sell.mode === 'store') {
    const s = await storeToday(brandId);
    if (!s.offers && !s.products) throw new AppError('VALIDATION_ERROR', MSG.STORE_EMPTY, 422, 'offers');
    return out;
  }
  if (sell.offerIds.length) {
    const choices = await offerChoices(brandId, D);
    const valid = new Map(choices.offers.map((o) => [o.id, o]));
    const { rows } = await db.query(`SELECT id, name FROM brand_offers WHERE id = ANY($1::uuid[]) AND brand_id = $2 AND engine = 2`,
      [sell.offerIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)), brandId]);
    if (rows.length !== sell.offerIds.length) throw new AppError('VALIDATION_ERROR', MSG.OFFER_UNKNOWN, 422, 'offers');
    for (const r of rows) {
      const v = valid.get(r.id);
      if (!v) throw new AppError('VALIDATION_ERROR', MSG.OFFER_NOT_VALID(r.name, D), 422, 'offers');
      if (v.ends_soon) out.endsSoon.push(r.name);
    }
    out.offerIds = sell.offerIds;
  }
  if (sell.mode === 'all' || sell.mode === 'chosen') {
    const free = await freeProducts(brandId, D);
    if (sell.mode === 'all') {
      out.productIds = free.map((p) => p.id);            // frozen: the list on the day of sending
    } else {
      const freeIds = new Set(free.map((p) => p.id));
      const bad = sell.productIds.filter((id) => !freeIds.has(id));
      if (bad.length) {
        const { rows } = await db.query(`SELECT id, name FROM brand_products WHERE id = ANY($1::uuid[]) AND brand_id = $2`,
          [bad.filter((x) => /^[0-9a-f-]{36}$/i.test(x)), brandId]);
        if (!rows.length) throw new AppError('VALIDATION_ERROR', MSG.PRODUCT_UNKNOWN, 422, 'products_without_offers');
        const heldNow = await pool.offersByProduct(brandId, { productIds: rows.map((r) => r.id) });
        const held = rows.find((r) => heldNow[r.id]);
        if (held) throw new AppError('VALIDATION_ERROR', MSG.PRODUCT_IN_OFFER(held.name), 422, 'products_without_offers');
        throw new AppError('VALIDATION_ERROR', MSG.PRODUCT_UNKNOWN, 422, 'products_without_offers');
      }
      out.productIds = sell.productIds;
    }
  }
  if (!out.offerIds.length && !out.productIds.length) {
    throw new AppError('VALIDATION_ERROR', sell.mode === 'all' && !out.offerIds.length ? MSG.NO_PRODUCTS_FREE(D)
      : postsAbout ? MSG.POST_ABOUT_NOTHING(creatorName) : MSG.SELL_NOTHING(creatorName), 422, 'offers');
  }
  if (!out.productIds.length) out.mode = 'none';
  return out;
}

/** Links the offers to the new collaboration. Runs on the caller's transaction. */
async function linkOffers(ciId, offerIds, tx = db) {
  for (const id of offerIds) {
    await tx.query(`INSERT INTO collab_offers (campaign_influencer_id, offer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [ciId, id]);
  }
}

/* ───────────────────────────────────────────── reading (brand rows, creator screens, agreement) */

/** "2 offers + 12 products" · "2 offers" · "12 products at normal price" · "Entire store · 4 offers + 61 products today". */
function sellWords(nOffers, nProducts, store = false) {
  const o = `${nOffers} offer${nOffers === 1 ? '' : 's'}`;
  const p = `${nProducts} product${nProducts === 1 ? '' : 's'}`;
  if (store) return `Entire store · ${[nOffers ? o : null, nProducts ? p : null].filter(Boolean).join(' + ') || 'nothing yet'} today`;
  if (nOffers && nProducts) return `${o} + ${p}`;
  if (nOffers) return o;
  if (nProducts) return `${p} at normal price`;
  return 'Nothing to sell';
}

/** The normal-price products still on sale (an unpublished product leaves her list, 2.8). */
async function liveProducts(ids, conn = db) {
  if (!ids || !ids.length) return [];
  const { rows } = await conn.query(
    `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.stock, cn.name AS leaf_name
       FROM brand_products bp LEFT JOIN category_nodes cn ON cn.id = bp.category_node_id
      WHERE bp.id = ANY($1::uuid[]) AND bp.is_active = true AND bp.pushed_to_store = true
      ORDER BY bp.name`, [ids]);
  return rows.map((r) => ({ id: r.id, name: r.name, price: Number(r.price), image_url: r.image_url, stock: r.stock == null ? null : Number(r.stock), leaf_name: r.leaf_name }));
}

/**
 * The sell block for many collaborations at once (brand rows, creator reads).
 * @returns Map ciId → { offers:[...], products:{ mode, count }, words }
 */
async function sellFor(ciRows, { today = todayInIndia(), withProducts = false } = {}) {
  const out = new Map();
  const v2 = (ciRows || []).filter((r) => r && r.sell_v2);
  if (!v2.length) return out;
  const { rows: links } = await db.query(
    `SELECT co.campaign_influencer_id AS ci_id, o.id, o.name, o.offer_type, o.sub_type, o.offer_config_json, o.status,
            o.starts_on, o.ends_on, o.ended_at,
            (SELECT count(*)::int FROM offer_pool_items i WHERE i.offer_id = o.id AND i.pool = 'buy' AND i.removed_at IS NULL) AS products,
            (SELECT count(*)::int FROM offer_pool_items i WHERE i.offer_id = o.id AND i.pool = 'gift' AND i.removed_at IS NULL) AS gifts
       FROM collab_offers co JOIN brand_offers o ON o.id = co.offer_id
      WHERE co.campaign_influencer_id = ANY($1::uuid[]) AND co.dropped_at IS NULL
      ORDER BY o.starts_on, o.name`, [v2.map((r) => r.id)]);
  const byCi = new Map();
  for (const l of links) {
    const shaped = { ...l, starts_on: calendarDay(l.starts_on), ends_on: calendarDay(l.ends_on), offer_config_json: l.offer_config_json || {} };
    const list = byCi.get(l.ci_id) || [];
    list.push({
      id: l.id, name: l.name, type_label: rules.typeLabel(l.offer_type, l.sub_type),
      deal: rules.creatorDeal(shaped, l.products, l.gifts),
      products: l.products, gifts: l.gifts, starts_on: shaped.starts_on, ends_on: shaped.ends_on,
      display_status: rules.displayStatus(shaped, today),
    });
    byCi.set(l.ci_id, list);
  }
  // Item 21: an Entire store row reads the store as it is TODAY — its offers and its free products —
  // never a list of its own (rules v1.34 §7A).
  const storeRows = v2.filter((r) => r.sell_mode === 'store');
  const brandOf = new Map();
  if (storeRows.length) {
    const { rows: bs } = await db.query(
      `SELECT ci.id, c.brand_id FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id
        WHERE ci.id = ANY($1::uuid[])`, [storeRows.map((r) => r.id)]);
    for (const b of bs) brandOf.set(b.id, b.brand_id);
  }
  const storeCache = new Map();
  for (const r of v2) {
    if (r.sell_mode === 'store') {
      const brandId = brandOf.get(r.id);
      if (!storeCache.has(brandId)) {
        const offers = (await storeOffersFor(brandId, today)).map((o) => ({ ...o, display_status: rules.displayStatus(o, today) }));
        const s = await storeToday(brandId, { today });
        const list = withProducts ? await liveProducts(s.productIds) : [];
        storeCache.set(brandId, { offers, products: { mode: 'store', count: s.products, store: true, ...(withProducts ? { list } : {}) }, words: sellWords(offers.length, s.products, true) });
      }
      out.set(r.id, { ...storeCache.get(brandId), store: true });
      continue;
    }
    const offers = byCi.get(r.id) || [];
    const products = await liveProducts(r.sell_product_ids || []);
    out.set(r.id, {
      offers,
      products: { mode: r.sell_mode || 'none', count: products.length, ...(withProducts ? { list: products } : {}) },
      words: sellWords(offers.length, products.length),
    });
  }
  return out;
}

/** Item 21 — the Entire store's offers: every published offer of the brand not yet ended, as the sell block shapes one. */
async function storeOffersFor(brandId, today = todayInIndia()) {
  const { rows } = await db.query(
    `SELECT o.id, o.name, o.offer_type, o.sub_type, o.offer_config_json, o.status, o.starts_on, o.ends_on, o.ended_at,
            (SELECT count(*)::int FROM offer_pool_items i WHERE i.offer_id = o.id AND i.pool = 'buy' AND i.removed_at IS NULL) AS products,
            (SELECT count(*)::int FROM offer_pool_items i WHERE i.offer_id = o.id AND i.pool = 'gift' AND i.removed_at IS NULL) AS gifts
       FROM brand_offers o
      WHERE o.brand_id = $1 AND o.engine = 2 AND o.status = 'published' AND o.ends_on >= $2::date
      ORDER BY o.starts_on, o.name`, [brandId, today]);
  return rows.map((l) => {
    const shaped = { ...l, starts_on: calendarDay(l.starts_on), ends_on: calendarDay(l.ends_on), offer_config_json: l.offer_config_json || {} };
    return { id: l.id, name: l.name, type_label: rules.typeLabel(l.offer_type, l.sub_type), deal: rules.creatorDeal(shaped, l.products, l.gifts),
      products: l.products, gifts: l.gifts, starts_on: shaped.starts_on, ends_on: shaped.ends_on };
  });
}

/** Item 21 — is this collaboration on the Entire store? (one small read; callers that have the row test sell_mode themselves) */
async function isStore(ciId, conn = db) {
  const { rows: [x] } = await conn.query(`SELECT sell_mode, c.brand_id FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id WHERE ci.id = $1`, [ciId]);
  return x && x.sell_mode === 'store' ? x.brand_id : null;
}

/** Products she can sell right now: her offers' live buy pools + her normal-price list. */
async function sellableProductIds(ciId, conn = db) {
  // Item 21: the Entire store — every product of the store that is on sale, in an offer or not.
  const storeBrand = await isStore(ciId, conn);
  if (storeBrand) {
    const { rows: all } = await conn.query(`SELECT id FROM brand_products WHERE brand_id = $1 AND is_active = true AND pushed_to_store = true`, [storeBrand]);
    return all.map((r) => r.id);
  }
  const { rows } = await conn.query(
    `SELECT DISTINCT i.product_id AS id
       FROM collab_offers co JOIN brand_offers o ON o.id = co.offer_id
       JOIN offer_pool_items i ON i.offer_id = o.id AND i.pool = 'buy' AND i.removed_at IS NULL
      WHERE co.campaign_influencer_id = $1 AND co.dropped_at IS NULL AND o.status = 'published'
     UNION
     SELECT unnest(sell_product_ids) FROM campaign_influencers WHERE id = $1`, [ciId]);
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (!ids.length) return [];
  const { rows: live } = await conn.query(
    `SELECT id FROM brand_products WHERE id = ANY($1::uuid[]) AND is_active = true AND pushed_to_store = true`, [ids]);
  return live.map((r) => r.id);
}

/* ───────────────────────────────────────────── the creator's own screens (C2, C3) */

async function ownCollab(influencerId, ciId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(ciId || ''))) throw new AppError('NOT_FOUND', 'Not found', 404);
  const { rows } = await db.query(
    `SELECT ci.id, ci.sell_v2, ci.sell_mode, ci.sell_product_ids, ci.commission_pct, ci.status,
            cs.name AS set_name, cs.goal, c.name AS campaign_name, b.business_name AS brand_name
       FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id JOIN brands b ON b.id = c.brand_id
      WHERE ci.id = $1 AND ci.influencer_id = $2`, [ciId, influencerId]);
  if (!rows[0] || !rows[0].sell_v2) throw new AppError('NOT_FOUND', 'Not found', 404);
  return rows[0];
}

async function pctFor(ci) {
  return ci.commission_pct == null ? null : Number(ci.commission_pct);
}

/** C2 — what she can sell, read-only. */
async function creatorSell(influencerId, ciId) {
  const ci = await ownCollab(influencerId, ciId);
  const block = (await sellFor([ci], { withProducts: true })).get(ci.id);
  const pct = await pctFor(ci);
  const offers = [];
  for (const o of block.offers) {
    const frozen = await pool.frozenPool(o.id);
    const full = await db.query(`SELECT offer_type, sub_type, offer_config_json FROM brand_offers WHERE id = $1`, [o.id]);
    const shaped = { ...full.rows[0], offer_config_json: full.rows[0].offer_config_json || {} };
    offers.push({ ...o, thumbs: frozen.buy.slice(0, 4).map((p) => ({ id: p.id, name: p.name, image_url: p.image_url })), you_earn: rules.exampleEarning(shaped, frozen, pct) });
  }
  return {
    brand_name: ci.brand_name, set_name: ci.set_name, campaign_name: ci.campaign_name, commission_pct: pct,
    offers, products: block.products, words: block.words,
    // Item 21: the Entire store, and a Pay for Content collaboration (what she POSTS ABOUT, no commission).
    store: !!block.store, no_commission: ci.goal === 'engagement',
  };
}

/** C3 — one offer, read-only: the deal for shoppers, the dates, what she earns, every product. */
async function creatorOffer(influencerId, ciId, offerId) {
  const ci = await ownCollab(influencerId, ciId);
  // Item 21: on the Entire store any published offer of the brand is hers, linked or not.
  const { rows } = ci.sell_mode === 'store'
    ? await db.query(
      `SELECT o.* FROM brand_offers o JOIN campaigns c ON c.brand_id = o.brand_id JOIN campaign_sets cs ON cs.campaign_id = c.id
        JOIN campaign_influencers ci ON ci.set_id = cs.id
       WHERE ci.id = $1 AND o.id = $2 AND o.engine = 2 AND o.status = 'published'`, [ci.id, offerId])
    : await db.query(
      `SELECT o.* FROM collab_offers co JOIN brand_offers o ON o.id = co.offer_id
        WHERE co.campaign_influencer_id = $1 AND co.offer_id = $2 AND co.dropped_at IS NULL`, [ci.id, offerId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Not found', 404);
  const o = { ...rows[0], starts_on: calendarDay(rows[0].starts_on), ends_on: calendarDay(rows[0].ends_on), offer_config_json: rows[0].offer_config_json || {} };
  const frozen = await pool.frozenPool(o.id);
  return {
    id: o.id, name: o.name, type_label: rules.typeLabel(o.offer_type, o.sub_type),
    deal: rules.creatorDeal(o, frozen.buy.length, frozen.gift.length),
    how: rules.shopperHow(o, frozen),
    starts_on: o.starts_on, ends_on: o.ends_on, display_status: rules.displayStatus(o, todayInIndia()),
    you_earn: rules.exampleEarning(o, frozen, await pctFor(ci)),
    products: frozen.buy.map((p) => ({ id: p.id, name: p.name, price: p.price, image_url: p.image_url })),
    gifts: frozen.gift.map((g) => ({ name: g.name, value: g.value, kind: g.kind })),
  };
}

/* ───────────────────────────────────────────── the agreement (2.7) */

/** Her offers as of signing, for the agreement snapshot. */
async function agreementSell(ci) {
  const block = (await sellFor([ci])).get(ci.id);
  if (!block) return null;
  // Item 21 (rules v1.34 §7A, §9): the Entire store is recorded as the RULE, not as a list. The
  // offers and the count are what the store held at signing, for the record only.
  if (block.store) {
    return {
      store: true,
      offers: block.offers.map((o) => ({ name: o.name, deal: o.deal, starts_on: o.starts_on, ends_on: o.ends_on })),
      products_count: block.products.count,
      words: 'Everything in the store, now and later',
      offers_end_line: 'Every offer and every product without an offer, including ones added later. When an offer ends, posts using it are removed from the shop.',
    };
  }
  return {
    offers: block.offers.map((o) => ({ name: o.name, deal: o.deal, starts_on: o.starts_on, ends_on: o.ends_on })),
    products_count: block.products.count,
    words: block.words,
    offers_end_line: 'Offers end on their end date; when an offer ends, posts using it are removed from the shop.',
  };
}

/* ───────────────────────────────────────────── when the brand ends an offer (2.8, founder Q1) */

const UNSIGNED_SQL = `ci.status::text = ANY($2::text[])
  AND NOT EXISTS (SELECT 1 FROM contracts con WHERE con.campaign_influencer_id = ci.id AND ${SIGNED_CONTRACT_SQL})`;

/** How many unsigned invitations hold this offer — the warning before ending it. Item 21: an unsigned Entire store invitation of the brand holds every offer. */
async function unsignedWith(offerId) {
  const { rows } = await db.query(
    `SELECT count(DISTINCT ci.id)::int AS n FROM collab_offers co JOIN campaign_influencers ci ON ci.id = co.campaign_influencer_id
      WHERE co.offer_id = $1 AND co.dropped_at IS NULL AND ${UNSIGNED_SQL}`, [offerId, PRE_SIGN]);
  const { rows: st } = await db.query(
    `SELECT count(DISTINCT ci.id)::int AS n FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id
      WHERE ci.sell_mode = 'store' AND c.brand_id = (SELECT brand_id FROM brand_offers WHERE id = $1) AND ${UNSIGNED_SQL}`, [offerId, PRE_SIGN]);
  return rows[0].n + st[0].n;
}

/**
 * Item 21 (R3) — the signed Entire store collaborations of this offer's brand, and how many of their
 * live posts use the offer: the second line of the End-offer warning.
 */
async function storeSignedWith(offerId) {
  const { rows: [x] } = await db.query(
    `SELECT count(DISTINCT ci.id)::int AS collaborations,
            (SELECT count(*)::int FROM creator_posts cp WHERE cp.offer_id = $1 AND cp.v2 AND cp.status = 'approved'
               AND cp.campaign_influencer_id IN (SELECT ci2.id FROM campaign_influencers ci2 JOIN campaign_sets cs2 ON cs2.id = ci2.set_id JOIN campaigns c2 ON c2.id = cs2.campaign_id
                                                  WHERE ci2.sell_mode = 'store' AND c2.brand_id = (SELECT brand_id FROM brand_offers WHERE id = $1))) AS posts
       FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id
      WHERE ci.sell_mode = 'store' AND c.brand_id = (SELECT brand_id FROM brand_offers WHERE id = $1)
        AND ci.status::text = ANY($2::text[])
        AND EXISTS (SELECT 1 FROM contracts con WHERE con.campaign_influencer_id = ci.id AND ${SIGNED_CONTRACT_SQL})`, [offerId, LIVE_CI]);
  return { collaborations: x.collaborations, posts: x.posts };
}

/**
 * The offer has ended: it drops out of every unsigned invitation, each creator is told, and an
 * invitation left with nothing to sell is withdrawn (or, if she had answered, closed). Signed
 * collaborations keep the link: the offer shows as ended there. Never throws.
 */
async function dropEndedOffer(offerId, { offerName, brandName } = {}) {
  let dropped = 0, withdrawn = 0;
  try {
    const { rows } = await db.query(
      `UPDATE collab_offers co SET dropped_at = now(), dropped_reason = 'offer_ended'
         FROM campaign_influencers ci
        WHERE co.campaign_influencer_id = ci.id AND co.offer_id = $1 AND co.dropped_at IS NULL AND ${UNSIGNED_SQL}
        RETURNING ci.id, ci.status::text AS status, ci.sell_mode, ci.sell_product_ids`, [offerId, PRE_SIGN]);
    for (const r of rows) {
      dropped += 1;
      const { rows: u } = await db.query(
        `SELECT u.id AS user_id FROM campaign_influencers ci JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id WHERE ci.id = $1`, [r.id]);
      // An offer that has already ended is nothing left to sell, even if its link was never dropped.
      const { rows: left } = await db.query(
        `SELECT count(*)::int AS n FROM collab_offers co JOIN brand_offers o ON o.id = co.offer_id
          WHERE co.campaign_influencer_id = $1 AND co.dropped_at IS NULL AND o.status <> 'ended'`, [r.id]);
      const products = await liveProducts(r.sell_product_ids || []);
      const empty = left[0].n === 0 && products.length === 0;
      if (empty) {
        await db.withTransaction(async (tx) => {
          if (r.status === 'invited') {
            await tx.query(`UPDATE campaign_influencers SET status = 'withdrawn', withdrawn_at = now(), withdrawn_reason = 'offer_ended' WHERE id = $1 AND status = 'invited'`, [r.id]);
          } else {
            await tx.query(`UPDATE campaign_influencers SET status = 'removed', removed_at = now(), withdrawn_reason = 'offer_ended' WHERE id = $1`, [r.id]);
            await tx.query(`UPDATE contracts SET status = 'withdrawn', withdrawn_at = now()
                             WHERE campaign_influencer_id = $1 AND influencer_signed_at IS NULL AND brand_signed_at IS NULL`, [r.id]);
          }
        });
        withdrawn += 1;
      } else {
        // An agreement already sent but not yet signed carries the offer in its snapshot: the
        // agreement she signs lists her offers as of signing (rules 2.7), so it's refreshed.
        const sellNow = await agreementSell({ id: r.id, sell_v2: true, sell_mode: r.sell_mode, sell_product_ids: r.sell_product_ids });
        await db.query(
          `UPDATE contracts SET terms_json = jsonb_set(terms_json, '{sell}', $2::jsonb)
            WHERE campaign_influencer_id = $1 AND terms_json IS NOT NULL
              AND influencer_signed_at IS NULL AND brand_signed_at IS NULL`, [r.id, JSON.stringify(sellNow)]);
      }
      if (u[0]) {
        const m = empty ? NOTIFY.withdrawnEmpty(brandName || 'The brand') : NOTIFY.offerDropped(offerName || 'An offer', brandName || 'The brand');
        await notificationService.send({ userId: u[0].user_id, type: m.type, title: m.title, body: m.body, sendSms: false,
          data: { screen: 'invitation', campaign_influencer_id: r.id, offer_id: offerId } })
          .catch((e) => console.error('[terms] notify failed:', e.message));
      }
    }
  } catch (e) {
    console.error('[terms] dropping an ended offer failed:', e.message);
  }
  return { dropped, withdrawn };
}

/* ───────────────────────────────────────────── products changing (2.8, 2.11) */

/** Creators (users) who can sell this product: through a linked offer holding it, or at normal price. */
async function creatorsHoldingProduct(productId, { excludeOfferCreators = false } = {}) {
  const { rows } = await db.query(
    `SELECT DISTINCT u.id AS user_id, ci.id AS ci_id, 'offer' AS via
       FROM offer_pool_items i JOIN collab_offers co ON co.offer_id = i.offer_id AND co.dropped_at IS NULL
       JOIN brand_offers o ON o.id = i.offer_id AND o.status = 'published'
       JOIN campaign_influencers ci ON ci.id = co.campaign_influencer_id
       JOIN influencers inf ON inf.id = ci.influencer_id JOIN users u ON u.id = inf.user_id
      WHERE i.product_id = $1 AND i.removed_at IS NULL AND ci.status::text = ANY($2::text[]) AND NOT $3::boolean
     UNION
     SELECT DISTINCT u.id, ci.id, 'normal'
       FROM campaign_influencers ci JOIN influencers inf ON inf.id = ci.influencer_id JOIN users u ON u.id = inf.user_id
      WHERE ci.sell_v2 AND $1::uuid = ANY(ci.sell_product_ids) AND ci.status::text = ANY($2::text[])`,
    [productId, LIVE_CI, !!excludeOfferCreators]);
  return rows;
}

async function tell(people, message, data) {
  const seen = new Set();
  for (const p of people) {
    if (seen.has(p.user_id)) continue;
    seen.add(p.user_id);
    await notificationService.send({ userId: p.user_id, type: message.type, title: message.title, body: message.body, sendSms: false,
      data: { screen: 'creator_sell', campaign_influencer_id: p.ci_id, ...data } })
      .catch((e) => console.error('[terms] notify failed:', e.message));
  }
  return seen.size;
}

/**
 * After a product is saved: out of stock, taken off sale, or (for her normal-price list) a new
 * price. Offer-linked price notices are sent by offerLife.afterPriceChange. Never throws.
 */
async function afterProductChange(productId, before, after, { permanent = false } = {}) {
  try {
    if (!before || !after) return 0;
    // shoppable-posts-v2 (rules 4.9) as changed by listing-shop-safety (A): the posts it is in —
    // hidden or sold out is a pause (nothing leaves them), the brand's Remove (`permanent`) takes it
    // out for good, a new price recalculates their band. Never throws.
    await require('./shoppablePosts.service').afterProductChange(productId, before, after, { permanent });
    const name = after.name || before.name || 'A product';
    let told = 0;
    const wasOn = before.is_active !== false && before.pushed_to_store !== false;
    const isOn = after.is_active !== false && after.pushed_to_store !== false;
    if (permanent && !isOn) {
      told += await tell(await creatorsHoldingProduct(productId), NOTIFY.unavailable(name), { product_id: productId });
      return told;
    }
    if (wasOn && !isOn) {
      told += await tell(await creatorsHoldingProduct(productId), NOTIFY.paused(name), { product_id: productId });
      return told;
    }
    if (!wasOn && isOn) told += await tell(await creatorsHoldingProduct(productId), NOTIFY.backOnSale(name), { product_id: productId });
    const had = before.stock == null || Number(before.stock) > 0;
    if (had && after.stock != null && Number(after.stock) === 0) {
      told += await tell(await creatorsHoldingProduct(productId), NOTIFY.outOfStock(name), { product_id: productId });
    }
    if (before.price != null && after.price != null && Number(before.price) !== Number(after.price)) {
      const normal = (await creatorsHoldingProduct(productId, { excludeOfferCreators: true }));
      told += await tell(normal, NOTIFY.priceChanged(name, before.price, after.price), { product_id: productId, old_price: Number(before.price), new_price: Number(after.price) });
    }
    return told;
  } catch (e) {
    console.error('[terms] product-change notice failed:', e.message);
    return 0;
  }
}

module.exports = {
  MSG, NOTIFY, ENDS_SOON_DAYS, PRE_SIGN,
  offerChoices, freeProducts, readSellInput, resolveSell, linkOffers,
  sellWords, sellFor, sellableProductIds, liveProducts,
  creatorSell, creatorOffer, agreementSell,
  unsignedWith, storeSignedWith, dropEndedOffer, creatorsHoldingProduct, afterProductChange,
  // Item 21 — the Entire store
  storeToday, storeOffersFor, isStore,
};
