'use strict';

/**
 * shoppablePosts.service.js — a creator makes a shoppable post for ONE collaboration (Level 3).
 * Contract: features/shoppable-posts-v2 · rules v1.4 §4 · boards P1–P15 · spec D1–D19
 *
 * Item 20 (features/item20-own-brand, rules v1.33 §2D): a post is for a collaboration OR for the
 * brand its creator is linked to (`own_brand`) — never both. An own-brand post has no campaign, set,
 * agreement, shoot, minimum, posting date or commission; what it may sell is the brand's own running
 * offers and its listed products that are in no offer. Everything else in this file is one path.
 *
 * A post is a row of creator_posts with v2 = true. It belongs to one collaboration (so one brand,
 * one set, one commission) and is either an OFFER post (one of her offers, products from its pool)
 * or a PRICE post (her products without offers). Every step saves; the post is a draft until she
 * sends it to INFLX. States (D3):
 *
 *   draft ─send→ submitted (in review) ─approve→ live (worked out, never stored). Since 1 Oct 2026
 *                     │    (features/posting-date-last-day) an approved post is live AT ONCE; only an
 *                     │    offer post whose offer has not started yet waits ("approved") for that day.
 *                     │    The set's posting date is the LAST day to go live, not the day it does.
 *                     └─send back→ rejected (sent back) ─fix and send again→ submitted
 *   approved / submitted ─offer ended · products gone · sold out · taken down→ removed (final)
 *
 * The facets shoppers filter by (category leaves, the offer, the price band) are worked out here
 * from the products and the offer, never typed (4.6).
 */

const crypto = require('crypto');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { calendarDay, todayInIndia, daysBetween, istDayOf } = require('../utils/indiaDay');
const rules = require('./offerRules');
const pool = require('./offerPool.service');
const terms = require('./creatorTerms.service');
const storage = require('./contentStorage.service');
const stockService = require('./stock.service');
const notificationService = require('./notification.service');
const events = require('./collabEvents.service');
const { SIGNED_CONTRACT_SQL } = require('./collabState');
const { MSG, REMOVED_WHY, NOTIFY } = require('./postsCopy');
const ownBrand = require('./ownBrand.service');
const OWN = require('./ownBrandCopy').MSG;

const MAX_SLIDES = 10;
const MAX_PRODUCTS = 30;
const MAX_VIDEO_S = 90;
const CAPTION_MAX = 2000;
const ENDS_SOON_DAYS = 7;
const IMAGE = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const VIDEO = { 'video/mp4': 'mp4' };
const MB = 1024 * 1024;
const LIMIT_MB = { image: 10, video: 200 };
const COVER_MB = 2;                      // a picture taken from a video (W15) — small on purpose
// Item 21 (rules v1.34 §12.2): a Pay for Content collaboration on the new terms makes shoppable
// posts too — `postable` still asks for sell_v2, which an old-terms one never has.
const SELLING = ['conversion', 'hybrid', 'engagement'];
const COLLAB_ON = ['contracted', 'active', 'completed'];
const GROUPS = ['season', 'occasion', 'style', 'use'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');
const bad = (message, field = null) => new AppError('VALIDATION_ERROR', message, 422, field);
const notFound = () => new AppError('NOT_FOUND', MSG.NOT_FOUND, 404);
const money = (v) => (v == null ? null : Number(v));
const inr = rules.inr;

/* ───────────────────────────────────────────── who can post (D2) */

const COLLAB_SQL = `
  SELECT ci.id, ci.influencer_id, ci.status::text AS status, ci.sell_v2, ci.sell_mode, ci.sell_product_ids,
         ci.commission_pct, ci.agreed_fee, ci.min_shoppable_posts, ci.shoppable_posts_n,
         cs.id AS set_id, cs.name AS set_name, cs.goal, cs.go_live_date,
         c.id AS campaign_id, c.name AS campaign_name, c.brand_id,
         b.business_name AS brand_name, b.logo_url AS brand_logo,
         (con.id IS NOT NULL AND ${SIGNED_CONTRACT_SQL}) AS signed,
         EXISTS (SELECT 1 FROM production_events pe WHERE pe.contract_id = con.id AND pe.status = 'completed') AS shoot_done
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN brands b ON b.id = c.brand_id
    LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id`;

/** The one rule (D2). Changes here when the founder's shoot-plan rules arrive (O1). */
function postable(ci) {
  return !!(ci && ci.sell_v2 && SELLING.includes(ci.goal) && COLLAB_ON.includes(ci.status) && ci.signed && ci.shoot_done);
}

/**
 * How many posts this collaboration owes: the admin minimum on Pay for Sale and Hybrid; on Pay for
 * Content (item 21) the number the brand asked for. ONE rule for the Create tab, Home and completion.
 */
function minOf(ci) {
  if (ci && ci.goal === 'engagement') return ci.shoppable_posts_n == null ? 1 : Number(ci.shoppable_posts_n);
  return ci && ci.min_shoppable_posts != null ? Number(ci.min_shoppable_posts) : 1;
}

/** Her selling collaborations on the new terms that are signed — postable or waiting for the shoot. */
async function myCollabs(influencerId, { brandId = null } = {}) {
  const params = [influencerId, SELLING, COLLAB_ON];
  let extra = '';
  if (brandId) { params.push(brandId); extra = ` AND c.brand_id = $${params.length}`; }
  const { rows } = await db.query(
    `${COLLAB_SQL}
      WHERE ci.influencer_id = $1 AND ci.sell_v2 AND cs.goal::text = ANY($2::text[]) AND ci.status::text = ANY($3::text[])
        AND con.id IS NOT NULL AND ${SIGNED_CONTRACT_SQL}${extra}
      ORDER BY cs.go_live_date NULLS LAST, c.name, cs.name`, params);
  return rows;
}

async function ownCollab(influencerId, ciId) {
  if (!UUID.test(String(ciId || ''))) throw notFound();
  const { rows } = await db.query(`${COLLAB_SQL} WHERE ci.id = $1 AND ci.influencer_id = $2`, [ciId, influencerId]);
  if (!rows[0] || !rows[0].sell_v2) throw notFound();
  return rows[0];
}

/* ───────────────────────────────────────────── a post for his own brand (item 20) */

/** The brand he is linked to, shaped like a collaboration row so every step reads one thing. */
function ownCtx(influencerId, b) {
  return { own: true, id: null, influencer_id: influencerId, linked: !!b.linked, brand_status: b.brand_status,
    brand_id: b.brand_id, brand_name: b.brand_name, brand_logo: b.brand_logo,
    set_id: null, set_name: null, campaign_id: null, campaign_name: null, go_live_date: null,
    commission_pct: null, agreed_fee: null, min_shoppable_posts: null, sell_product_ids: [] };
}

/** Who this post is for: its collaboration, or the brand he is linked to. */
async function postFor(influencerId, p) {
  if (!p.own_brand) return ownCollab(influencerId, p.campaign_influencer_id);
  const b = await ownBrand.postingBrand(influencerId, p.brand_id);
  if (!b) throw notFound();
  return ownCtx(influencerId, b);
}

/** May he post for it now? D2 for a collaboration; for his own brand: still linked, and the brand approved. */
function canPost(ctx) {
  return ctx && ctx.own ? !!(ctx.linked && ctx.brand_status === 'approved') : postable(ctx);
}
function cantPostWhy(ctx) {
  if (!ctx || !ctx.own) return MSG.NOT_POSTABLE;
  if (!ctx.linked) return OWN.OWN_NOT_LINKED;
  return ctx.brand_status === 'pending' ? OWN.OWN_BRAND_NOT_APPROVED : OWN.OWN_BRAND_STOPPED;
}

/**
 * Approved posts counted against the minimum. Item 14 (rules v1.30 §12.1, board S7): a post INFLX
 * approves after the posting date STILL COUNTS — it is shown to the brand as late, never refused.
 * One number with saleLive.approvedCount, which completion reads.
 */
async function doneCounts(ciIds) {
  if (!ciIds.length) return new Map();
  const { rows } = await db.query(
    `SELECT cp.campaign_influencer_id AS ci_id, count(*)::int AS n
       FROM creator_posts cp
      WHERE cp.v2 AND cp.campaign_influencer_id = ANY($1::uuid[]) AND cp.approved_at IS NOT NULL
      GROUP BY 1`, [ciIds]);
  return new Map(rows.map((r) => [r.ci_id, r.n]));
}

function earningWords(ci) {
  const pct = ci.commission_pct == null ? null : `${Number(ci.commission_pct) % 1 === 0 ? Number(ci.commission_pct) : Number(ci.commission_pct).toFixed(1)}%`;
  if (ci.goal === 'hybrid' && ci.agreed_fee != null) return `earning ${[pct, inr(ci.agreed_fee)].filter(Boolean).join(' + ')}`;
  // Item 21 (D5): Pay for Content pays the fee alone — a sale through her post earns her nothing.
  if (ci.goal === 'engagement') return 'fixed fee · no commission';
  return pct ? `earning ${pct}` : null;
}

/* ───────────────────────────────────────────── P2 · P3: brand, collaboration */

/** P2 — the brands she can post for. A brand with no postable collaboration yet shows locked. */
async function brands(influencerId) {
  const collabs = await myCollabs(influencerId);
  const mine = await ownBrand.linkedBrand(influencerId);
  const byBrand = new Map();
  for (const ci of collabs) {
    if (mine && ci.brand_id === mine.brand_id) continue;   // item 20: his own brand shows once, as his own
    const b = byBrand.get(ci.brand_id) || { id: ci.brand_id, name: ci.brand_name, logo_url: ci.brand_logo, postable: 0, waiting: 0 };
    if (postable(ci)) b.postable += 1; else b.waiting += 1;
    byBrand.set(ci.brand_id, b);
  }
  const list = [...byBrand.values()].map((b) => ({
    id: b.id, name: b.name, logo_url: b.logo_url, own: false,
    open: b.postable > 0,
    line: b.postable > 0 ? `${b.postable} collaboration${b.postable > 1 ? 's' : ''}${b.postable > 1 ? ' you can post for' : ''}` : 'Opens after your shoot plan',
  })).sort((a, b) => Number(b.open) - Number(a.open) || a.name.localeCompare(b.name));
  if (!mine) return list;
  // Item 20 (board C2): the brand he runs comes first. It needs no collaboration, only INFLX's approval of the brand.
  const open = mine.brand_status === 'approved';
  return [{ id: mine.brand_id, name: mine.brand_name, logo_url: mine.brand_logo, own: true, open,
    line: open ? OWN.OWN_LINE : mine.brand_status === 'pending' ? OWN.OWN_LINE_PENDING : OWN.OWN_LINE_STOPPED }, ...list];
}

/** P3 — her collaborations with this brand: what she can sell, posting date, posts done. */
async function collaborations(influencerId, brandId) {
  if (!UUID.test(String(brandId || ''))) throw notFound();
  const collabs = await myCollabs(influencerId, { brandId });
  const sells = await terms.sellFor(collabs);
  const done = await doneCounts(collabs.map((c) => c.id));
  return collabs.map((ci) => {
    const sell = sells.get(ci.id);
    const min = minOf(ci);
    return {
      id: ci.id, campaign_name: ci.campaign_name, set_name: ci.set_name,
      sell_words: sell ? sell.words : null,
      posting_date: calendarDay(ci.go_live_date),
      posts_done: done.get(ci.id) || 0, posts_min: min,
      earning: earningWords(ci),
      open: postable(ci),
      closed_why: postable(ci) ? null : 'Opens after your shoot plan',
    };
  });
}

/* ───────────────────────────────────────────── the offers and products she may use */

/** Her offers in this collaboration that are running today (linked, published, not ended). */
async function runningOffers(ci, today = todayInIndia()) {
  const { rows } = await db.query(
    `SELECT o.id, o.name, o.offer_type, o.sub_type, o.offer_config_json, o.status, o.starts_on, o.ends_on
       FROM collab_offers co JOIN brand_offers o ON o.id = co.offer_id
      WHERE co.campaign_influencer_id = $1 AND co.dropped_at IS NULL AND o.status = 'published' AND o.ends_on >= $2::date
      ORDER BY o.offer_type, o.ends_on, o.name`, [ci.id, today]);
  return rows.map((o) => ({ ...o, starts_on: calendarDay(o.starts_on), ends_on: calendarDay(o.ends_on), offer_config_json: o.offer_config_json || {} }));
}

/**
 * Item 20 (O5): every offer of his own store that is published and has not ended. (An offer the
 * brand deleted is always an ended one — rule 1.9 — so it is already out; the deleted mark itself is
 * read only by the brand's own lists, features/offer-delete.)
 */
async function storeOffers(brandId, today = todayInIndia()) {
  const { rows } = await db.query(
    `SELECT o.id, o.name, o.offer_type, o.sub_type, o.offer_config_json, o.status, o.starts_on, o.ends_on
       FROM brand_offers o
      WHERE o.brand_id = $1 AND o.engine = 2 AND o.status = 'published' AND o.ends_on >= $2::date
      ORDER BY o.offer_type, o.ends_on, o.name`, [brandId, today]);
  return rows.map((o) => ({ ...o, starts_on: calendarDay(o.starts_on), ends_on: calendarDay(o.ends_on), offer_config_json: o.offer_config_json || {} }));
}
/** The offers this post may use: the collaboration's, or his own store's — or, on the Entire store (item 21), the whole store's. */
const offersFor = (ctx, today = todayInIndia()) => (ctx.own || ctx.sell_mode === 'store' ? storeOffers(ctx.brand_id, today) : runningOffers(ctx, today));

async function offerRow(offerId) {
  const { rows } = await db.query(`SELECT * FROM brand_offers WHERE id = $1`, [offerId]);
  const o = rows[0];
  return o ? { ...o, starts_on: calendarDay(o.starts_on), ends_on: calendarDay(o.ends_on), offer_config_json: o.offer_config_json || {} } : null;
}

const onSale = (p) => p && p.is_active !== false && p.pushed_to_store !== false;

/** The price one item costs a shopper in this post (4.6): discounts → the discounted price. */
function shopperPrice(offer, price) {
  if (offer && offer.offer_type === 'discount') {
    const d = rules.discountedPrice(offer, price);
    if (d) return d.pays;
  }
  return Number(price);
}

/** How the creator picks from this offer (4.3): { min, auto, gifts } */
function pickRule(offer, frozen) {
  const c = rules.normaliseConfig(offer.sub_type, offer.offer_config_json);
  if (offer.sub_type === 'fixed') return { min: frozen.buy.length, auto: true, gifts: [] };
  if (offer.sub_type === 'pick_any' || offer.sub_type === 'mix_match') return { min: Math.max(1, c.pick || 1), auto: false, gifts: [] };
  if (offer.offer_type === 'free_gift') return { min: 1, auto: false, gifts: frozen.gift.map((g) => g.name), gift_words: giftWords(offer, frozen) };
  return { min: 1, auto: false, gifts: [] };
}

function giftWords(offer, frozen) {
  const names = frozen.gift.map((g) => g.name);
  if (!names.length) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
  const c = rules.normaliseConfig(offer.sub_type, offer.offer_config_json);
  const when = offer.sub_type === 'spend' && c.min_spend != null ? ` when spending ${inr(c.min_spend)}`
    : offer.sub_type === 'buy_x' && c.buy_qty ? ` when buying ${c.buy_qty}` : '';
  return names.length === 1 ? `Free with this: ${list}.${when ? ` The shopper gets it${when}.` : ''}`
    : `Free with this: ${list}. The shopper chooses one${when}.`;
}

/** The offer's live buy pool as she can pick it, with the price shoppers pay. */
async function offerProducts(offer) {
  const frozen = await pool.frozenPool(offer.id);
  const ids = frozen.buy.map((p) => p.id);
  const { rows: live } = ids.length
    ? await db.query(`SELECT id FROM brand_products WHERE id = ANY($1::uuid[]) AND is_active AND pushed_to_store`, [ids])
    : { rows: [] };
  const liveIds = new Set(live.map((r) => r.id));
  const products = frozen.buy.filter((p) => liveIds.has(p.id)).map((p) => ({
    id: p.id, name: p.name, image_url: p.image_url, price: p.price, shopper_price: shopperPrice(offer, p.price),
    leaf_id: p.leaf_id, leaf_name: p.leaf_name, stock: p.stock,
  }));
  return { frozen, products, rule: pickRule(offer, { ...frozen, buy: products }) };
}

/** Her products without offers that are still on sale, with each one's category path (P8). */
async function priceProducts(ci) {
  const ids = ci.sell_product_ids || [];
  if (!ids.length) return [];
  const { rows } = await db.query(
    `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.stock, bp.category_node_id AS leaf_id
       FROM brand_products bp
      WHERE bp.id = ANY($1::uuid[]) AND bp.is_active AND bp.pushed_to_store
      ORDER BY bp.price, bp.name`, [ids]);
  return priceRows(rows);
}

/**
 * Item 20 (O5, D1): his own store's listed products that no offer holds today — the same reading as
 * the offer builder's "products without offers". A product in an offer is sold through an offer post.
 */
async function storeProductsWithoutOffers(brandId, today = todayInIndia()) {
  const { rows } = await db.query(
    `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.stock, bp.category_node_id AS leaf_id
       FROM brand_products bp
      WHERE bp.brand_id = $1 AND bp.is_active AND bp.pushed_to_store
        AND NOT EXISTS (SELECT 1 FROM offer_pool_items i WHERE i.product_id = bp.id AND i.removed_at IS NULL AND i.lock_days @> $2::date)
      ORDER BY bp.price, bp.name`, [brandId, today]);
  return priceRows(rows);
}
/** The products a price post may carry: the collaboration's, or his own store's. */
const priceProductsFor = (ctx, today = todayInIndia()) => (ctx.own || ctx.sell_mode === 'store' ? storeProductsWithoutOffers(ctx.brand_id, today) : priceProducts(ctx));

async function priceRows(rows) {
  const paths = await categoryPaths(rows.map((r) => r.leaf_id).filter(Boolean));
  return rows.map((r) => ({
    id: r.id, name: r.name, price: Number(r.price), shopper_price: Number(r.price), image_url: r.image_url,
    stock: r.stock == null ? null : Number(r.stock), leaf_id: r.leaf_id, path: paths.get(r.leaf_id) || [],
  }));
}

/** leaf id → [{ id, name }] from the top (e.g. Men › Topwear › Shirts). */
async function categoryPaths(leafIds) {
  const out = new Map();
  const ids = [...new Set(leafIds)];
  if (!ids.length) return out;
  const { rows } = await db.query(
    `WITH RECURSIVE up AS (
       SELECT id AS leaf, id, parent_id, name, depth FROM category_nodes WHERE id = ANY($1::uuid[])
       UNION ALL
       SELECT up.leaf, n.id, n.parent_id, n.name, n.depth FROM category_nodes n JOIN up ON n.id = up.parent_id)
     SELECT leaf, id, name, depth FROM up ORDER BY leaf, depth`, [ids]);
  for (const r of rows) {
    const list = out.get(r.leaf) || [];
    list.push({ id: r.id, name: r.name });
    out.set(r.leaf, list);
  }
  return out;
}

async function priceBands() {
  const { rows } = await db.query(`SELECT id, label, min_price, max_price FROM price_bands WHERE status = 'active' ORDER BY sort_order`);
  return rows.map((b) => ({ id: b.id, label: b.label, min_price: Number(b.min_price), max_price: money(b.max_price) }));
}

/** The band a price falls in: the first "under" band that holds it, else the open-ended one. */
function bandFor(bands, price) {
  if (price == null) return null;
  const under = bands.filter((b) => b.max_price != null).sort((a, b) => a.max_price - b.max_price);
  const hit = under.find((b) => price <= b.max_price);
  if (hit) return hit;
  return bands.find((b) => b.max_price == null && price >= b.min_price) || null;
}

async function themeTags() {
  const { rows } = await db.query(`SELECT id, tag_group, name FROM theme_tags WHERE status = 'active' ORDER BY tag_group, sort_order`);
  return rows;
}

/* ───────────────────────────────────────────── reading a post */

const POST_SQL = `
  SELECT cp.*, ci.set_id, ci.commission_pct AS ci_commission_pct, cs.name AS set_name, cs.goal, cs.go_live_date, c.name AS campaign_name,
         b.business_name AS brand_name, b.logo_url AS brand_logo,
         o.name AS offer_name, o.offer_type, o.sub_type, o.offer_config_json, o.status AS offer_status,
         o.starts_on AS offer_starts_on, o.ends_on AS offer_ends_on,
         pb.label AS band_label
    FROM creator_posts cp
    -- item 20: an own-brand post has no collaboration, so these three are loose. A collaboration
    -- post always has all three (the post rule and its foreign keys), so it reads exactly as before.
    LEFT JOIN campaign_influencers ci ON ci.id = cp.campaign_influencer_id
    LEFT JOIN campaign_sets cs ON cs.id = ci.set_id
    LEFT JOIN campaigns c ON c.id = cs.campaign_id
    JOIN brands b ON b.id = cp.brand_id
    LEFT JOIN brand_offers o ON o.id = cp.offer_id
    LEFT JOIN price_bands pb ON pb.id = cp.price_band_id`;

/**
 * features/posting-date-last-day (founder, 1 Oct 2026; rules v1.15 §4.1). An approved post is in
 * the shop at once. The one thing it can wait for is its offer: an offer post is visible only
 * while its offer is active, so one approved before its offer starts waits for that day. The set's
 * posting date is not asked here — it is the last day to go live (late after it), nothing more.
 * Returns the day an approved post waits for, or null when it waits for nothing.
 */
function liveDayOf(p) {
  return p.post_kind === 'offer' && p.offer_starts_on ? calendarDay(p.offer_starts_on) : null;
}

/** The state she sees (D3). An offer that has ended takes an approved post out, even before the sweep. */
function stateOf(p, today = todayInIndia()) {
  if (p.status === 'draft') return 'draft';
  if (p.status === 'submitted') return 'in_review';
  if (p.status === 'rejected') return 'sent_back';
  if (p.status === 'removed') return 'removed';
  if (offerOver(p, today)) return 'removed';
  const live = liveDayOf(p);
  return live && today < live ? 'approved' : 'live';
}

function offerOver(p, today) {
  if (p.post_kind !== 'offer' || !p.offer_id) return false;
  return p.offer_status === 'ended' || (p.offer_ends_on && calendarDay(p.offer_ends_on) < today);
}

/** A name for the post: the caption's first line, else the offer, else "Price post". */
function titleOf(p) {
  const line = String(p.caption || '').split('\n').map((s) => s.trim()).find(Boolean);
  if (line) return line.length > 40 ? `${line.slice(0, 39).trim()}…` : line;
  return p.offer_name || (p.post_kind === 'price' ? 'Price post' : 'Untitled post');
}

/**
 * What a SHOPPER reads as the post's title (shopper-app-fixes N7): the first line of its caption,
 * else its products ("Blue polo and 2 more"). Never an internal name — a post with no caption used
 * to be titled "Price post", "Untitled post" or the brand's own name for its offer.
 */
function shopperTitleOf(p, products) {
  const line = String(p.caption || '').split('\n').map((s) => s.trim()).find(Boolean);
  if (line) return titleOf(p);
  const names = (products || []).filter((x) => x.on_sale !== false).map((x) => x.name).filter(Boolean);
  if (!names.length) return 'A post on INFLX';
  return names.length === 1 ? names[0] : `${names[0]} and ${names.length - 1} more`;
}

function offerWords(p) {
  if (p.post_kind !== 'offer' || !p.offer_id) return null;
  const shaped = { offer_type: p.offer_type, sub_type: p.sub_type, offer_config_json: p.offer_config_json || {} };
  return { type: rules.TYPE_LABEL[p.offer_type] || p.offer_type, deal: rules.dealLine(shaped) || p.offer_name, name: p.offer_name, ends_on: calendarDay(p.offer_ends_on) };
}

async function mediaOf(postIds) {
  if (!postIds.length) return new Map();
  const { rows } = await db.query(
    `SELECT id, post_id, slide_index, r2_key, mime, width, height, size_bytes, duration_s, cover_r2_key FROM post_media
      WHERE post_id = ANY($1::uuid[]) ORDER BY post_id, slide_index`, [postIds]);
  const out = new Map();
  for (const m of rows) {
    const list = out.get(m.post_id) || [];
    list.push({ id: m.id, slide_index: m.slide_index, r2_key: m.r2_key, mime: m.mime, width: m.width, height: m.height,
      size_bytes: m.size_bytes == null ? null : Number(m.size_bytes), duration_s: money(m.duration_s), url: mediaUrl(m.id),
      // W15: a picture taken from this video on her phone (null for a photo and for an older video).
      cover_r2_key: m.cover_r2_key || null, cover_url: m.cover_r2_key ? coverUrl(m.id) : null });
    out.set(m.post_id, list);
  }
  return out;
}

function mediaUrl(mediaId) {
  const base = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_PUBLIC_URL || '';
  return `${base}/v1/media/post/${mediaId}`;
}
/** The picture taken from a video slide (W15). Served like the slide itself. */
function coverUrl(mediaId) {
  const base = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_PUBLIC_URL || '';
  return `${base}/v1/media/post/${mediaId}/cover`;
}

async function productsOf(postIds) {
  if (!postIds.length) return new Map();
  const { rows } = await db.query(
    `SELECT pp.post_id, pp.product_id, pp.media_id, pp.x_pct, pp.y_pct, pm.slide_index,
            bp.name, bp.price, bp.image_url, bp.stock, bp.variants_json, bp.is_active, bp.pushed_to_store, bp.category_node_id AS leaf_id
       FROM post_products pp JOIN brand_products bp ON bp.id = pp.product_id
       LEFT JOIN post_media pm ON pm.id = pp.media_id
      WHERE pp.post_id = ANY($1::uuid[]) ORDER BY pp.created_at, bp.name`, [postIds]);
  const out = new Map();
  for (const r of rows) {
    const list = out.get(r.post_id) || [];
    list.push({ id: r.product_id, name: r.name, price: Number(r.price), image_url: r.image_url, leaf_id: r.leaf_id,
      stock: r.stock == null ? null : Number(r.stock), on_sale: r.is_active && r.pushed_to_store,
      // shopper-app-fixes (F6): can anything of it still be bought — its sizes decide when it has sizes.
      available: stockService.available({ stock: r.stock, variants_json: r.variants_json }),
      pin: r.media_id ? { media_index: r.slide_index, x_pct: Number(r.x_pct), y_pct: Number(r.y_pct) } : null });
    out.set(r.post_id, list);
  }
  return out;
}

/** Sales through the post (D18). Nothing can sell through a new post until the shopper app. */
async function salesOf(postIds) {
  if (!postIds.length) return new Map();
  const { rows } = await db.query(
    `SELECT via_post_id AS post_id, count(*)::int AS orders, COALESCE(SUM(influencer_commission), 0) AS commission,
            COALESCE(SUM(net_amount), 0) AS sales
       FROM follower_transactions WHERE via_post_id = ANY($1::uuid[]) AND status = 'completed' GROUP BY 1`, [postIds]);
  return new Map(rows.map((r) => [r.post_id, { orders: r.orders, commission: Number(r.commission), sales: Number(r.sales) }]));
}

/** Item 20: a post for his own brand earns no commission, so it says what it sold. Item 21 (R9): so does a post on a collaboration that pays none. */
function salesWords(s, noCommission = false) {
  if (!s || !s.orders) return 'No sales yet';
  return `${s.orders} sale${s.orders > 1 ? 's' : ''} · ${noCommission ? inr(s.sales) : `${inr(s.commission)} to you`}`;
}
/** True when nothing from a sale through this post reaches the creator: his own brand, or a collaboration with no commission %. */
const noCommissionOn = (p) => !!(p && (p.own_brand || (p.campaign_influencer_id && p.ci_commission_pct == null)));

async function tagsById() {
  const all = await themeTags();
  return new Map(all.map((t) => [t.id, t]));
}

/** One post as the creator's screens read it. */
async function shape(p, { media, products, sales, tags, paths, today = todayInIndia() }) {
  const state = stateOf(p, today);
  const offer = offerWords(p);
  const leafNames = (p.category_node_ids || []).map((id) => (paths.get(id) || []).map((n) => n.name).join(' › ')).filter(Boolean);
  const removedReason = p.status === 'removed' ? p.removed_reason : (state === 'removed' ? 'offer_ended' : null);
  return {
    id: p.id, state, status: p.status, title: titleOf(p), shopper_title: shopperTitleOf(p, products.get(p.id)), caption: p.caption,
    // post-links-codes: the code given at approval (4.14); null for drafts and posts in review.
    code: p.post_code || null, influencer_id: p.influencer_id, set_id: p.set_id,
    // The day a post waiting for its offer enters the shop (null once it is in).
    goes_live_on: state === 'approved' ? liveDayOf(p) : null,
    // The day it entered the shop: its approval, or its offer's start if that came later.
    live_since: state !== 'live' ? null
      : [p.approved_at ? istDayOf(new Date(p.approved_at)) : null, liveDayOf(p)].filter(Boolean).sort().pop() || null,
    collaboration: { id: p.campaign_influencer_id, brand_id: p.brand_id, brand_name: p.brand_name, brand_logo: p.brand_logo,
      campaign_name: p.campaign_name, set_name: p.set_name, posting_date: calendarDay(p.go_live_date) },
    // item 20: a post for the brand he runs. `collaboration` then carries the brand alone.
    own_brand: !!p.own_brand,
    for_line: p.own_brand ? `${p.brand_name} · ${OWN.YOUR_BRAND}` : [p.brand_name, p.campaign_name, p.set_name].filter(Boolean).join(' · '),
    kind: p.post_kind, offer_id: p.offer_id, offer,
    products: products.get(p.id) || [],
    theme_tags: (p.theme_tag_ids || []).map((id) => tags.get(id)).filter(Boolean).map((t) => ({ id: t.id, group: t.tag_group, name: t.name })),
    media_kind: p.media_kind, media_layout: p.media_layout, tag_style: p.tag_style,
    media: media.get(p.id) || [],
    facets: {
      category: leafNames.length ? leafNames : null,
      offer: offer ? `${offer.type} · ${offer.deal}` : null,
      price_band: p.band_label || null,
      top_price: money(p.top_price),
      theme: (p.theme_tag_ids || []).map((id) => (tags.get(id) || {}).name).filter(Boolean).join(' · ') || null,
    },
    draft_step: p.draft_step, draft_state: p.draft_state || {},
    submitted_at: p.submitted_at, approved_at: p.approved_at,
    sent_back: p.status === 'rejected' ? { reason: p.reject_reason, count: p.sent_back_count } : null,
    removed: removedReason ? {
      reason: removedReason, at: p.removed_at || null,
      why: (REMOVED_WHY[removedReason] || (() => MSG.REMOVED))(p.offer_name),
      offer_ended_on: removedReason === 'offer_ended' ? calendarDay(p.offer_ends_on) : null,
    } : null,
    sales: sales.get(p.id) || { orders: 0, commission: 0, sales: 0 },
    sales_words: salesWords(sales.get(p.id), noCommissionOn(p)),
    no_commission: noCommissionOn(p),
    can: {
      edit: p.status === 'draft',
      fix: p.status === 'rejected',
      send: p.status === 'draft' || p.status === 'rejected',
      delete: p.status === 'draft' || p.status === 'rejected',
      take_down: state === 'approved' || state === 'live',
    },
    updated_at: p.updated_at,
  };
}

async function hydrate(rows, today = todayInIndia()) {
  const ids = rows.map((r) => r.id);
  const [media, products, sales, tags] = await Promise.all([mediaOf(ids), productsOf(ids), salesOf(ids), tagsById()]);
  const paths = await categoryPaths(rows.flatMap((r) => r.category_node_ids || []));
  const out = [];
  for (const r of rows) out.push(await shape(r, { media, products, sales, tags, paths, today }));
  return out;
}

async function loadOwn(influencerId, postId, conn = db) {
  if (!UUID.test(String(postId || ''))) throw notFound();
  const { rows } = await conn.query(`${POST_SQL} WHERE cp.id = $1 AND cp.influencer_id = $2 AND cp.v2`, [postId, influencerId]);
  if (!rows[0]) throw notFound();
  return rows[0];
}

/** post-links-codes: any new post by id (links and brand screens check ownership themselves). */
async function getMany(ids) {
  const clean = (ids || []).filter((x) => UUID.test(String(x)));
  if (!clean.length) return [];
  const { rows } = await db.query(`${POST_SQL} WHERE cp.id = ANY($1::uuid[]) AND cp.v2`, [clean]);
  const byId = new Map((await hydrate(rows)).map((x) => [x.id, x]));
  return clean.map((id) => byId.get(id)).filter(Boolean);
}
async function getAny(id) { return (await getMany([id]))[0] || null; }

async function getPost(influencerId, postId) {
  const p = await loadOwn(influencerId, postId);
  const out = (await hydrate([p]))[0];
  // listing-shop-safety (C1): a live post whose products are all paused, or whose set is not whole.
  out.not_in_shop = out.state === 'live' ? await notInShopWhy(p) : null;
  // post-performance-v2 (board C3): the post's social numbers, one line under Share / Stats.
  if (['approved', 'live', 'removed'].includes(out.state) && !out.own_brand) {
    out.social = (await require('./postStats.service').socialOfPost(p.id, { postingDate: out.collaboration ? out.collaboration.posting_date : null })).summary;
  }
  // post-engagement-stats (E2): "In INFLX · views · likes · comments", one line under Share / Stats.
  if (['approved', 'live', 'removed'].includes(out.state)) out.inflx = await require('./postEngagement.service').threeOne(p.id);
  return out;
}

/* ───────────────────────────────────────────── making a draft (P3 → P4) */

async function createDraft(influencerId, ciId, ownBrandId = null) {
  if (!ciId && ownBrandId) return createOwnDraft(influencerId, ownBrandId);
  const ci = await ownCollab(influencerId, ciId);
  if (!postable(ci)) throw new AppError('NOT_POSTABLE', MSG.NOT_POSTABLE, 422);
  const { rows } = await db.query(
    `INSERT INTO creator_posts (influencer_id, scope, scoped_brand_ids, v2, campaign_influencer_id, brand_id,
                                status, media_kind, draft_step)
     VALUES ($1, 'single', ARRAY[$2::uuid], true, $3, $2, 'draft', 'image', 3) RETURNING id`,
    [influencerId, ci.brand_id, ci.id]);
  return getPost(influencerId, rows[0].id);
}

/** Item 20 (board C2): a post for the brand he is linked to. No collaboration is asked or made. */
async function createOwnDraft(influencerId, brandId) {
  const b = await ownBrand.postingBrand(influencerId, brandId);
  if (!b || !b.linked) throw notFound();                       // not his brand: nothing about it is said
  const ctx = ownCtx(influencerId, b);
  if (!canPost(ctx)) throw new AppError('NOT_POSTABLE', cantPostWhy(ctx), 422);
  const { rows } = await db.query(
    `INSERT INTO creator_posts (influencer_id, scope, scoped_brand_ids, v2, own_brand, brand_id, status, media_kind, draft_step)
     VALUES ($1, 'single', ARRAY[$2::uuid], true, true, $2, 'draft', 'image', 3) RETURNING id`,
    [influencerId, ctx.brand_id]);
  return getPost(influencerId, rows[0].id);
}

/* ───────────────────────────────────────────── the choices for each step (P4–P9) */

/** Everything the steps need for this post, worked out now. */
async function options(influencerId, postId) {
  const p = await loadOwn(influencerId, postId);
  const ci = await postFor(influencerId, p);
  const today = todayInIndia();
  const posting = calendarDay(ci.go_live_date);
  const offers = await offersFor(ci, today);
  const free = await priceProductsFor(ci, today);

  const byType = new Map();
  const offerList = [];
  for (const o of offers) {
    const frozen = await pool.frozenPool(o.id);
    const ends = o.ends_on;
    const after = posting ? daysBetween(posting, ends) : null;
    offerList.push({
      id: o.id, name: o.name, offer_type: o.offer_type, type_label: rules.typeLabel(o.offer_type, o.sub_type),
      deal: rules.creatorDeal(o, frozen.buy.length, frozen.gift.length), products: frozen.buy.length,
      starts_on: o.starts_on, ends_on: ends,
      ends_soon: after != null && after >= 0 && after < ENDS_SOON_DAYS
        ? `"${o.name}" ends ${rules.dayMonth(ends)}, ${after} day${after === 1 ? '' : 's'} after posting. The post leaves the shop when it ends.` : null,
    });
    byType.set(o.offer_type, (byType.get(o.offer_type) || 0) + 1);
  }
  const types = rules.TYPES.filter((t) => byType.get(t)).map((t) => ({ key: t, label: rules.TYPE_LABEL[t], count: byType.get(t) }));
  const hidden = rules.TYPES.filter((t) => !byType.get(t)).map((t) => rules.TYPE_LABEL[t]);

  const out = {
    post_id: p.id,
    collaboration: { id: ci.id, brand_name: ci.brand_name, campaign_name: ci.campaign_name, set_name: ci.set_name, posting_date: posting },
    own_brand: !!ci.own,
    kinds: {
      offer: { available: offers.length > 0, count: offers.length, why: offers.length ? null : (ci.own ? OWN.OWN_NO_OFFERS : MSG.NO_OFFERS) },
      price: { available: free.length > 0, count: free.length, why: free.length ? null : (ci.own ? OWN.OWN_NO_FREE_PRODUCTS : MSG.NO_FREE_PRODUCTS) },
    },
    offer_types: types,
    offer_types_hidden: !hidden.length ? null
      : ci.own ? OWN.OWN_TYPES_HIDDEN(andList(hidden), hidden.length > 1)
        : `${andList(hidden)} ${hidden.length > 1 ? "aren't" : "isn't"} shown because this collaboration has none.`,
    offers: offerList,
    pool: null,
    price_products: free,
    price_bands: await priceBands(),
    theme_tags: GROUPS.map((g) => ({ group: g, tags: [] })),
  };
  for (const t of await themeTags()) out.theme_tags.find((x) => x.group === t.tag_group).tags.push({ id: t.id, name: t.name });
  if (p.post_kind === 'offer' && p.offer_id) {
    const o = await offerRow(p.offer_id);
    const { products, rule } = await offerProducts(o);
    out.pool = { offer_id: o.id, name: o.name, type_label: rules.typeLabel(o.offer_type, o.sub_type), products, rule, count: products.length };
  }
  return out;
}

/* ───────────────────────────────────────────── saving a step */

/** What she may send in a patch, by state (D4, D12). */
const DRAFT_FIELDS = ['post_kind', 'offer_id', 'product_ids', 'theme_tag_ids', 'media_kind', 'media_layout', 'media', 'pins', 'tag_style', 'caption', 'draft_step', 'draft_state'];
const FIX_FIELDS = ['product_ids', 'theme_tag_ids', 'media_kind', 'media_layout', 'media', 'pins', 'tag_style', 'caption', 'draft_state'];

async function update(influencerId, postId, patch) {
  const body = patch && typeof patch === 'object' ? patch : {};
  const p = await loadOwn(influencerId, postId);
  if (p.status === 'submitted') throw new AppError('POST_LOCKED', MSG.SENT, 409);
  if (p.status === 'approved') throw new AppError('POST_LOCKED', MSG.APPROVED_LOCKED, 409);
  if (p.status === 'removed') throw new AppError('POST_LOCKED', MSG.REMOVED, 409);
  const allowed = p.status === 'draft' ? DRAFT_FIELDS : FIX_FIELDS;
  const sent = Object.keys(body).filter((k) => body[k] !== undefined);
  const refused = sent.filter((k) => !allowed.includes(k) && k !== 'draft_step');
  if (refused.length) throw new AppError('POST_LOCKED', MSG.SENT_BACK_ONLY, 409, refused[0]);

  const ci = await postFor(influencerId, p);
  const next = {
    post_kind: p.post_kind, offer_id: p.offer_id, theme_tag_ids: p.theme_tag_ids || [],
    media_kind: p.media_kind, media_layout: p.media_layout, tag_style: p.tag_style, caption: p.caption,
    draft_step: p.draft_step, draft_state: p.draft_state || {},
  };
  const current = (await productsOf([p.id])).get(p.id) || [];
  let productIds = current.map((x) => x.id);
  let pins = current.filter((x) => x.pin).map((x) => ({ product_id: x.id, ...x.pin }));
  let media = null;   // null = unchanged
  let productsChanged = false;

  if (body.post_kind !== undefined && p.status === 'draft') {
    if (!['offer', 'price'].includes(body.post_kind)) throw bad(MSG.KIND_NEEDED, 'post_kind');
    if (body.post_kind !== next.post_kind) { next.post_kind = body.post_kind; next.offer_id = null; productIds = []; pins = []; productsChanged = true; }
  }
  if (body.offer_id !== undefined && p.status === 'draft') {
    if (next.post_kind !== 'offer') throw bad(MSG.KIND_NEEDED, 'post_kind');
    if (body.offer_id === null) { next.offer_id = null; productIds = []; pins = []; productsChanged = true; }
    else {
      const mine = await offersFor(ci);
      const o = mine.find((x) => x.id === body.offer_id);
      if (!o && ci.own) {
        // item 20: an offer of his own store that has ended, or not his store's at all
        const his = UUID.test(String(body.offer_id)) ? await db.query(`SELECT 1 FROM brand_offers WHERE id = $1 AND brand_id = $2`, [body.offer_id, ci.brand_id]) : { rows: [] };
        throw bad(his.rows[0] ? MSG.OFFER_ENDED : OWN.OWN_OFFER_NOT_YOURS, 'offer_id');
      }
      if (!o) {
        const linked = await db.query(`SELECT 1 FROM collab_offers WHERE campaign_influencer_id = $1 AND offer_id = $2 AND dropped_at IS NULL`, [ci.id, body.offer_id]);
        throw bad(linked.rows[0] ? MSG.OFFER_ENDED : MSG.OFFER_NOT_YOURS, 'offer_id');
      }
      if (o.id !== next.offer_id) {
        next.offer_id = o.id; pins = []; productsChanged = true;
        // A fixed bundle's products are all added for her (4.3).
        productIds = o.sub_type === 'fixed' ? (await offerProducts(o)).products.map((x) => x.id) : [];
      }
    }
  }
  if (body.product_ids !== undefined) {
    if (!Array.isArray(body.product_ids)) throw bad(MSG.PICK_AT_LEAST_ONE, 'product_ids');
    const ids = [...new Set(body.product_ids.map(String))];
    if (ids.length > MAX_PRODUCTS) throw bad(MSG.TOO_MANY_PRODUCTS, 'product_ids');
    await checkProducts(ci, next, ids);
    productIds = ids; productsChanged = true;
    pins = pins.filter((x) => ids.includes(x.product_id));
  }
  if (body.theme_tag_ids !== undefined) next.theme_tag_ids = await checkTags(body.theme_tag_ids);
  if (body.media_kind !== undefined) {
    if (!['image', 'video'].includes(body.media_kind)) throw bad(MSG.FILE_TYPE, 'media_kind');
    next.media_kind = body.media_kind;
  }
  if (body.media_layout !== undefined) {
    if (!['single', 'carousel'].includes(body.media_layout)) throw bad(MSG.MEDIA_SINGLE, 'media_layout');
    next.media_layout = body.media_layout;
  }
  if (body.media !== undefined) {
    media = await checkMedia(influencerId, p.id, body.media, next);
    pins = pins.filter((x) => x.media_index < media.length && media[x.media_index].kind === 'image');
  }
  if (body.pins !== undefined) {
    const slides = media || ((await mediaOf([p.id])).get(p.id) || []).map((m) => ({ ...m, kind: kindOf(m.mime) }));
    pins = checkPins(body.pins, productIds, slides);
  }
  if (body.tag_style !== undefined) {
    if (!['soft_editorial', 'minimal', 'hidden'].includes(body.tag_style)) throw bad('Choose how product tags look.', 'tag_style');
    next.tag_style = body.tag_style;
  }
  if (body.caption !== undefined) {
    const cap = body.caption == null ? null : String(body.caption);
    if (cap && cap.length > CAPTION_MAX) throw bad(MSG.CAPTION_LONG, 'caption');
    next.caption = cap && cap.trim() ? cap : null;
  }
  if (body.draft_step !== undefined && p.status === 'draft') {
    const n = Number(body.draft_step);
    if (Number.isInteger(n) && n >= 1 && n <= 8) next.draft_step = n;
  }
  if (body.draft_state !== undefined && body.draft_state && typeof body.draft_state === 'object' && !Array.isArray(body.draft_state)) {
    next.draft_state = body.draft_state;
  }

  await db.withTransaction(async (tx) => {
    await tx.query(
      `UPDATE creator_posts SET post_kind = $2, offer_id = $3, theme_tag_ids = $4, media_kind = $5, media_layout = $6,
              tag_style = $7, caption = $8, draft_step = $9, draft_state = $10, updated_at = now()
        WHERE id = $1`,
      [p.id, next.post_kind, next.offer_id, next.theme_tag_ids, next.media_kind || 'image', next.media_layout,
        next.tag_style || 'soft_editorial', next.caption, next.draft_step, JSON.stringify(next.draft_state)]);
    if (media || productsChanged || body.pins !== undefined) {
      let slides;
      if (media) {
        await tx.query(`DELETE FROM post_products WHERE post_id = $1`, [p.id]);
        await tx.query(`DELETE FROM post_media WHERE post_id = $1`, [p.id]);
        slides = [];
        for (let i = 0; i < media.length; i += 1) {
          const m = media[i];
          const { rows } = await tx.query(
            `INSERT INTO post_media (post_id, slide_index, r2_key, mime, size_bytes, width, height, duration_s, cover_r2_key)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [p.id, i, m.r2_key, m.mime, m.size_bytes, m.width, m.height, m.duration_s, m.cover_r2_key || null]);
          slides.push(rows[0].id);
        }
      } else {
        const { rows } = await tx.query(`SELECT id FROM post_media WHERE post_id = $1 ORDER BY slide_index`, [p.id]);
        slides = rows.map((r) => r.id);
      }
      await tx.query(`DELETE FROM post_products WHERE post_id = $1`, [p.id]);
      for (const id of productIds) {
        const pin = pins.find((x) => x.product_id === id);
        await tx.query(
          `INSERT INTO post_products (post_id, media_id, product_id, x_pct, y_pct) VALUES ($1,$2,$3,$4,$5)`,
          [p.id, pin ? slides[pin.media_index] : null, id, pin ? pin.x_pct : null, pin ? pin.y_pct : null]);
      }
    }
    await refreshFacets(p.id, tx);
  });
  return getPost(influencerId, p.id);
}

async function checkProducts(ci, next, ids) {
  if (!ids.length) return;
  if (next.post_kind === 'offer') {
    if (!next.offer_id) throw bad(MSG.OFFER_NEEDED, 'offer_id');
    const o = await offerRow(next.offer_id);
    const { products } = await offerProducts(o);
    const inPool = new Set(products.map((x) => x.id));
    if (ids.some((id) => !inPool.has(id))) throw bad(MSG.PRODUCT_NOT_IN_OFFER, 'product_ids');
  } else if (next.post_kind === 'price') {
    const free = new Set((await priceProductsFor(ci)).map((x) => x.id));
    if (ids.some((id) => !free.has(id))) throw bad(MSG.PRODUCT_NOT_YOURS, 'product_ids');
  } else {
    throw bad(MSG.KIND_NEEDED, 'post_kind');
  }
}

async function checkTags(raw) {
  if (!Array.isArray(raw)) throw bad(MSG.TAGS_MIN, 'theme_tag_ids');
  const ids = [...new Set(raw.map(String))];
  const all = await tagsById();
  const groups = new Set();
  for (const id of ids) {
    const t = all.get(id);
    if (!t) throw bad(MSG.TAG_UNKNOWN, 'theme_tag_ids');
    if (groups.has(t.tag_group)) throw bad(MSG.TAGS_ONE_PER_GROUP, 'theme_tag_ids');
    groups.add(t.tag_group);
  }
  return ids;
}

const kindOf = (mime) => (VIDEO[mime] ? 'video' : IMAGE[mime] ? 'image' : null);

/** The slides she uploaded: her own keys for this post, the right kind, landed in storage, within limits. */
async function checkMedia(influencerId, postId, raw, next) {
  if (!Array.isArray(raw)) throw bad(MSG.MEDIA_MIN, 'media');
  if (raw.length > MAX_SLIDES) throw bad(MSG.MEDIA_MAX, 'media');
  if (next.media_layout === 'single' && raw.length > 1) throw bad(MSG.MEDIA_SINGLE, 'media');
  const prefix = `posts/${influencerId}/${postId}/`;
  const out = [];
  for (const m of raw) {
    if (!m || typeof m.r2_key !== 'string' || !m.r2_key.startsWith(prefix)) throw bad(MSG.MEDIA_NOT_YOURS, 'media');
    const mime = String(m.mime || '').toLowerCase();
    const kind = kindOf(mime);
    if (!kind) throw bad(MSG.FILE_TYPE, 'media');
    if (kind !== (next.media_kind || 'image')) throw bad(MSG.MEDIA_KIND_MIX, 'media');
    const landed = await storage.head(m.r2_key);
    if (!landed || !landed.size) throw bad(MSG.MEDIA_NOT_UPLOADED, 'media');
    if (landed.size > LIMIT_MB[kind] * MB) throw bad(MSG.FILE_TOO_BIG(LIMIT_MB[kind]), 'media');
    let duration = null;
    if (kind === 'video') {
      duration = Number(m.duration_s);
      if (!Number.isFinite(duration) || duration <= 0) throw bad(MSG.VIDEO_TOO_LONG, 'media');
      if (duration > MAX_VIDEO_S) throw bad(MSG.VIDEO_TOO_LONG, 'media');
    }
    // W15: the picture her phone took from this video. Her own key for this post, a JPEG that
    // really landed, and small. A video without one is accepted exactly as before.
    let cover = null;
    if (kind === 'video' && m.cover_r2_key != null && m.cover_r2_key !== '') {
      if (typeof m.cover_r2_key !== 'string' || !m.cover_r2_key.startsWith(prefix) || m.cover_r2_key === m.r2_key) throw bad(MSG.MEDIA_NOT_YOURS, 'media');
      const pic = await storage.head(m.cover_r2_key);
      if (!pic || !pic.size) throw bad(MSG.MEDIA_NOT_UPLOADED, 'media');
      if (String(pic.contentType || '').split(';')[0].trim().toLowerCase() !== 'image/jpeg') throw bad(MSG.FILE_TYPE, 'media');
      if (pic.size > COVER_MB * MB) throw bad(MSG.FILE_TOO_BIG(COVER_MB), 'media');
      cover = m.cover_r2_key;
    }
    out.push({ r2_key: m.r2_key, mime, kind, size_bytes: landed.size, duration_s: duration, cover_r2_key: cover,
      width: Number.isInteger(m.width) ? m.width : null, height: Number.isInteger(m.height) ? m.height : null });
  }
  return out;
}

function checkPins(raw, productIds, slides) {
  if (!Array.isArray(raw)) throw bad(MSG.PIN_BAD, 'pins');
  const seen = new Set();
  const out = [];
  for (const x of raw) {
    if (!x || !productIds.includes(String(x.product_id)) || seen.has(String(x.product_id))) throw bad(MSG.PIN_BAD, 'pins');
    const i = Number(x.media_index);
    if (!Number.isInteger(i) || i < 0 || i >= slides.length || slides[i].kind !== 'image') throw bad(MSG.PIN_BAD, 'pins');
    const xp = Number(x.x_pct); const yp = Number(x.y_pct);
    if (![xp, yp].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw bad(MSG.PIN_BAD, 'pins');
    seen.add(String(x.product_id));
    out.push({ product_id: String(x.product_id), media_index: i, x_pct: Math.round(xp * 100) / 100, y_pct: Math.round(yp * 100) / 100 });
  }
  return out;
}

/** The facets (4.6): category leaves, the highest price one item costs, and its band. */
async function refreshFacets(postId, conn = db) {
  const { rows: [p] } = await conn.query(
    `SELECT cp.id, cp.post_kind, o.offer_type, o.sub_type, o.offer_config_json
       FROM creator_posts cp LEFT JOIN brand_offers o ON o.id = cp.offer_id WHERE cp.id = $1`, [postId]);
  if (!p) return;
  // listing-shop-safety (A): a hidden product stays in the post, so the band and the categories are
  // read from the products that are on sale. With none on sale the post is not in the shop at all:
  // what it had is left as it was, for the day one is shown again.
  const { rows: every } = await conn.query(
    `SELECT bp.price, bp.category_node_id, (bp.is_active AND bp.pushed_to_store IS NOT FALSE) AS on_sale
       FROM post_products pp JOIN brand_products bp ON bp.id = pp.product_id WHERE pp.post_id = $1`, [postId]);
  const prods = every.filter((r) => r.on_sale);
  if (every.length && !prods.length) return;
  const offer = p.post_kind === 'offer' && p.offer_type ? { offer_type: p.offer_type, sub_type: p.sub_type, offer_config_json: p.offer_config_json || {} } : null;
  const prices = prods.map((r) => shopperPrice(offer, r.price));
  const top = prices.length ? Math.max(...prices) : null;
  const band = bandFor(await priceBands(), top);
  const leaves = [...new Set(prods.map((r) => r.category_node_id).filter(Boolean))];
  await conn.query(
    `UPDATE creator_posts SET top_price = $2, price_band_id = $3, category_node_ids = $4 WHERE id = $1`,
    [postId, top, band ? band.id : null, leaves]);
}

/* ───────────────────────────────────────────── uploads (P10) */

async function uploadUrl(influencerId, postId, { content_type, size_bytes, filename } = {}) {
  const p = await loadOwn(influencerId, postId);
  if (!['draft', 'rejected'].includes(p.status)) throw new AppError('POST_LOCKED', p.status === 'submitted' ? MSG.SENT : MSG.APPROVED_LOCKED, 409);
  const mime = String(content_type || '').toLowerCase();
  const kind = kindOf(mime);
  if (!kind) throw bad(MSG.FILE_TYPE, 'content_type');
  const size = Number(size_bytes);
  if (!Number.isInteger(size) || size <= 0) throw bad(MSG.MEDIA_NOT_UPLOADED, 'size_bytes');
  if (size > LIMIT_MB[kind] * MB) throw bad(MSG.FILE_TOO_BIG(LIMIT_MB[kind]), 'size_bytes');
  const ext = VIDEO[mime] || IMAGE[mime];
  void filename;
  const key = `posts/${influencerId}/${p.id}/${crypto.randomUUID()}.${ext}`;
  const upload = await storage.uploadUrl(key, mime === 'image/jpg' ? 'image/jpeg' : mime, size);
  return { key, kind, ...upload, music_warning: kind === 'video' ? 'No copyrighted music. INFLX checks every post, and one with copyrighted music is sent back.' : null };
}

/* ───────────────────────────────────────────── is it complete? (send, approve) */

/** Everything that must hold for the post to go to INFLX or be approved. Returns the first problem, or null. */
async function problemOf(p, ci) {
  if (!canPost(ci)) return cantPostWhy(ci);
  if (!['offer', 'price'].includes(p.post_kind)) return MSG.KIND_NEEDED;
  const products = (await productsOf([p.id])).get(p.id) || [];
  const ids = products.map((x) => x.id);
  if (p.post_kind === 'offer') {
    if (!p.offer_id) return MSG.OFFER_NEEDED;
    const running = await offersFor(ci);
    const o = running.find((x) => x.id === p.offer_id);
    if (!o) return MSG.OFFER_ENDED;
    const { products: poolProducts, rule } = await offerProducts(o);
    const inPool = new Set(poolProducts.map((x) => x.id));
    if (ids.some((id) => !inPool.has(id))) return MSG.PRODUCT_NOT_IN_OFFER;
    if (rule.auto && ids.length < poolProducts.length) return MSG.PRODUCT_NOT_IN_OFFER;
    if (ids.length < rule.min) return rule.min > 1 ? MSG.PICK_AT_LEAST(rule.min) : MSG.PICK_AT_LEAST_ONE;
  } else {
    const free = new Set((await priceProductsFor(ci)).map((x) => x.id));
    if (!ids.length) return MSG.PICK_AT_LEAST_ONE;
    if (ids.some((id) => !free.has(id))) return MSG.PRODUCT_NOT_YOURS;
  }
  if (ids.length > MAX_PRODUCTS) return MSG.TOO_MANY_PRODUCTS;
  const tagIds = p.theme_tag_ids || [];
  if (!tagIds.length) return MSG.TAGS_MIN;
  try { await checkTags(tagIds); } catch (e) { return e.message; }
  const media = (await mediaOf([p.id])).get(p.id) || [];
  if (!media.length) return MSG.MEDIA_MIN;
  if (media.length > MAX_SLIDES) return MSG.MEDIA_MAX;
  if (p.media_layout === 'single' && media.length > 1) return MSG.MEDIA_SINGLE;
  if (media.some((m) => kindOf(m.mime) !== (p.media_kind || 'image'))) return MSG.MEDIA_KIND_MIX;
  if (media.some((m) => kindOf(m.mime) === 'video' && !(Number(m.duration_s) <= MAX_VIDEO_S))) return MSG.VIDEO_TOO_LONG;
  if (!p.caption || !String(p.caption).trim()) return MSG.CAPTION_NEEDED;
  return null;
}

/* ───────────────────────────────────────────── send · take down · delete */

async function submit(influencerId, postId, actorUserId) {
  const p = await loadOwn(influencerId, postId);
  if (!['draft', 'rejected'].includes(p.status)) throw new AppError('POST_LOCKED', MSG.CANT_SEND, 409);
  const ci = await postFor(influencerId, p);
  const problem = await problemOf(p, ci);
  if (problem) throw bad(problem);
  await refreshFacets(p.id);
  const { rowCount } = await db.query(
    `UPDATE creator_posts SET status = 'submitted', submitted_at = now(), draft_step = NULL, updated_at = now()
      WHERE id = $1 AND status IN ('draft', 'rejected')`, [p.id]);
  if (!rowCount) throw new AppError('POST_LOCKED', MSG.CANT_SEND, 409);
  await events.record({ postId: p.id, step: events.STEP.SHOP_POSTS, actorRole: 'creator', actorUserId,
    action: p.status === 'rejected' ? 'resubmitted' : 'submitted' });
  return getPost(influencerId, p.id);
}

async function takeDown(influencerId, postId, actorUserId) {
  const p = await loadOwn(influencerId, postId);
  const state = stateOf(p);
  if (!['approved', 'live'].includes(state)) throw new AppError('POST_LOCKED', MSG.CANT_TAKE_DOWN, 409);
  await db.query(
    `UPDATE creator_posts SET status = 'removed', removed_at = now(), removed_reason = 'taken_down', updated_at = now()
      WHERE id = $1 AND status = 'approved'`, [p.id]);
  await events.record({ postId: p.id, step: events.STEP.SHOP_POSTS, actorRole: 'creator', actorUserId, action: 'taken_down' });
  return getPost(influencerId, p.id);
}

async function remove(influencerId, postId) {
  const p = await loadOwn(influencerId, postId);
  if (!['draft', 'rejected'].includes(p.status)) throw new AppError('POST_LOCKED', MSG.CANT_DELETE, 409);
  const media = (await mediaOf([p.id])).get(p.id) || [];
  await db.query(`DELETE FROM creator_posts WHERE id = $1 AND status IN ('draft', 'rejected')`, [p.id]);
  for (const m of media) { await storage.remove(m.r2_key); if (m.cover_r2_key) await storage.remove(m.cover_r2_key); }
  return { deleted: true };
}

/* ───────────────────────────────────────────── her posts (P1, P14) */

const STATES = ['live', 'approved', 'in_review', 'sent_back', 'removed', 'draft'];

async function listMine(influencerId, { state = null } = {}) {
  const { rows } = await db.query(`${POST_SQL} WHERE cp.influencer_id = $1 AND cp.v2 ORDER BY cp.updated_at DESC`, [influencerId]);
  const posts = await hydrate(rows);
  const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
  for (const x of posts) counts[x.state] += 1;
  return { counts, posts: state ? posts.filter((x) => x.state === state || (state === 'live' && x.state === 'approved')) : posts };
}

/** P1 — the Create tab: collaborations still short of their minimum, her recent posts, collections. */
async function createHome(influencerId) {
  const today = todayInIndia();
  const collabs = (await myCollabs(influencerId)).filter(postable);
  const done = await doneCounts(collabs.map((c) => c.id));
  const needs = collabs.map((ci) => {
    const min = minOf(ci);
    const posting = calendarDay(ci.go_live_date);
    return { campaign_influencer_id: ci.id, brand_id: ci.brand_id, brand_name: ci.brand_name, brand_logo: ci.brand_logo,
      set_name: ci.set_name, campaign_name: ci.campaign_name, posting_date: posting, done: done.get(ci.id) || 0, min };
  }).filter((n) => n.done < n.min && (!n.posting_date || today <= n.posting_date));
  const mine = await listMine(influencerId);
  const { rows: [col] } = await db.query(`SELECT count(*)::int AS n FROM creator_collections WHERE influencer_id = $1`, [influencerId]);
  // post-links-codes (L1): her store link on the Create tab.
  const { rows: [me] } = await db.query(`SELECT lower(regexp_replace(COALESCE(instagram_handle, ''), '^@', '')) AS h FROM influencers WHERE id = $1`, [influencerId]);
  const host = (process.env.PUBLIC_LINK_HOST || 'inflx.in').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  // Item 20 (board C1): a linked, approved brand opens Create on its own, with no collaboration.
  const own = await ownBrand.linkedBrand(influencerId);
  const ownOpen = !!(own && own.brand_status === 'approved');
  return { needs, counts: mine.counts, total: mine.posts.length, recent: mine.posts.slice(0, 3), collections: col.n,
    can_post: collabs.length > 0 || ownOpen,
    own_brand: own ? { id: own.brand_id, name: own.brand_name, logo_url: own.brand_logo, open: ownOpen } : null,
    store_link: me && me.h ? `${host}/s/${me.h}` : null };
}

/* ───────────────────────────────────────────── INFLX review (admin; D14) */

async function approveCheck(postId) {
  const { rows } = await db.query(`${POST_SQL} WHERE cp.id = $1 AND cp.v2`, [postId]);
  const p = rows[0];
  if (!p) return null;
  // Item 20: an own-brand post is checked against the link and the brand, never waved through for
  // want of a collaboration (a missing link reads as "cannot post", which refuses the approval).
  if (p.own_brand) {
    const b = await ownBrand.postingBrand(p.influencer_id, p.brand_id);
    return problemOf(p, b ? ownCtx(p.influencer_id, b) : { own: true, linked: false });
  }
  const { rows: [ci] } = await db.query(`${COLLAB_SQL} WHERE ci.id = $1`, [p.campaign_influencer_id]);
  return problemOf(p, ci);
}

/** After INFLX decides: sent-back count, and her notice in the post's own words. */
async function afterDecision(postId, approve, reason) {
  const { rows } = await db.query(`${POST_SQL} WHERE cp.id = $1 AND cp.v2`, [postId]);
  const p = rows[0];
  if (!p) return;
  if (!approve) await db.query(`UPDATE creator_posts SET sent_back_count = sent_back_count + 1 WHERE id = $1`, [p.id]);
  // post-links-codes (4.14): the code and links appear the moment INFLX approves.
  if (approve) await require('./postLinks.service').issuePostCode(p.id);
  // It is in the shop now, unless its offer has not started yet — then it says which day.
  const liveDay = liveDayOf(p);
  const today = todayInIndia();
  const m = approve
    ? NOTIFY.approved(titleOf(p), liveDay && today < liveDay ? rules.dayMonth(liveDay) : null)
    : NOTIFY.sentBack(titleOf(p), String(reason || '').trim() || 'Not specified');
  await tellCreator(p.influencer_id, m, { screen: 'post', post_id: p.id });
  // Item 14 (rules v1.30 §19): an approval can be what reaches the minimum on a collaboration the
  // brand already confirmed live — then it completes now. Never throws into the approval.
  // (An own-brand post belongs to no collaboration, so there is nothing to complete.)
  if (approve && !p.own_brand) await require('./saleLive.service').afterPostApproved(p.id);
}

async function tellCreator(influencerId, m, data) {
  try {
    const { rows } = await db.query(`SELECT u.id FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`, [influencerId]);
    if (rows[0]) await notificationService.send({ userId: rows[0].id, type: m.type, title: m.title, body: m.body, data, sendSms: false });
  } catch (e) { console.error('[posts] notify failed:', e.message); }
}

/** Admin read of new posts: what they are for, and the facets. */
async function adminShape(rows) {
  const v2 = rows.filter((r) => r.v2);
  if (!v2.length) return new Map();
  const { rows: full } = await db.query(`${POST_SQL} WHERE cp.id = ANY($1::uuid[])`, [v2.map((r) => r.id)]);
  const shaped = await hydrate(full);
  return new Map(shaped.map((s) => [s.id, s]));
}

/* ───────────────────────────────────────────── a post's life after it goes live (4.9, D15) */

const OPEN = `cp.v2 AND cp.status IN ('submitted', 'approved')`;

async function removePosts(postIds, reason) {
  if (!postIds.length) return [];
  const { rows } = await db.query(
    `UPDATE creator_posts cp SET status = 'removed', removed_at = now(), removed_reason = $2, updated_at = now()
      WHERE cp.id = ANY($1::uuid[]) AND ${OPEN}
      RETURNING cp.id`, [postIds, reason]);
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    const { rows: full } = await db.query(`${POST_SQL} WHERE cp.id = ANY($1::uuid[])`, [ids]);
    for (const p of full) {
      await events.record({ postId: p.id, step: events.STEP.SHOP_POSTS, actorRole: 'system', action: 'removed', note: reason });
      await tellCreator(p.influencer_id, NOTIFY.removed(titleOf(p), REMOVED_WHY[reason](p.offer_name)), { screen: 'post', post_id: p.id });
    }
  }
  return ids;
}

/** The offer ended (early or by date): every post using it leaves the shop. Never throws. */
async function afterOfferEnded(offerId) {
  try {
    const { rows } = await db.query(`SELECT cp.id FROM creator_posts cp WHERE cp.offer_id = $1 AND ${OPEN}`, [offerId]);
    return (await removePosts(rows.map((r) => r.id), 'offer_ended')).length;
  } catch (e) { console.error('[posts] offer ended:', e.message); return 0; }
}

/** Products left an offer: they leave its posts; a post left with none is removed. Never throws. */
async function afterProductsLeftOffer(offerId, productIds) {
  try {
    if (!productIds || !productIds.length) return 0;
    const { rows } = await db.query(
      `DELETE FROM post_products pp USING creator_posts cp
        WHERE pp.post_id = cp.id AND cp.offer_id = $1 AND pp.product_id = ANY($2::uuid[])
          AND cp.v2 AND cp.status IN ('draft', 'submitted', 'approved', 'rejected')
        RETURNING cp.id, cp.status`, [offerId, productIds]);
    return await afterProductsLeft(rows, 'products_removed');
  } catch (e) { console.error('[posts] products left offer:', e.message); return 0; }
}

async function afterProductsLeft(rows, emptyReason) {
  const touched = [...new Set(rows.map((r) => r.id))];
  const empty = [];
  for (const id of touched) {
    const { rows: [n] } = await db.query(`SELECT count(*)::int AS n FROM post_products WHERE post_id = $1`, [id]);
    if (n.n === 0) empty.push(id); else await refreshFacets(id);
  }
  const removed = await removePosts(empty, emptyReason);
  const stillOpen = touched.filter((id) => !empty.includes(id));
  if (stillOpen.length) {
    const { rows: full } = await db.query(`${POST_SQL} WHERE cp.id = ANY($1::uuid[]) AND cp.status = 'approved'`, [stillOpen]);
    for (const p of full) {
      const n = rows.filter((r) => r.id === p.id).length;
      await tellCreator(p.influencer_id, NOTIFY.productsLeft(titleOf(p), n), { screen: 'post', post_id: p.id });
    }
  }
  return removed.length;
}

/**
 * A product changed (brand edit). Never throws.
 *
 * listing-shop-safety (A; rules 2.8 and 4.9 as changed on 11 Oct 2026): a product that is hidden,
 * or out of stock, is a PAUSE. It stays in every post that carries it — the shop simply does not
 * show or sell it (the card and the pricing engine both ask "is it on sale"), and a post with
 * nothing left to sell is not in the shop (`shopperPosts.livePool`) until the brand shows or
 * restocks one. Nothing is deleted, so Show brings all of it back. (Hide used to delete the product
 * from every post and remove a post left empty, for good; a zero-stock save removed the post too,
 * while selling out through orders never did.)
 *
 * `permanent` is the brand's Remove: the product leaves every post for good and a post left with
 * none is removed, as before.
 *
 * Either way the posts' price band and categories are worked out again from what is on sale.
 */
async function afterProductChange(productId, before, after, { permanent = false } = {}) {
  try {
    const wasOn = onSale(before);
    const isOn = onSale(after);
    if (permanent && !isOn) {
      const { rows } = await db.query(
        `DELETE FROM post_products pp USING creator_posts cp
          WHERE pp.post_id = cp.id AND pp.product_id = $1 AND cp.v2 AND cp.status IN ('draft', 'submitted', 'approved', 'rejected')
          RETURNING cp.id, cp.status`, [productId]);
      await afterProductsLeft(rows, 'unavailable');
      return;
    }
    const { rows: posts } = await db.query(
      `SELECT DISTINCT cp.id FROM post_products pp JOIN creator_posts cp ON cp.id = pp.post_id
        WHERE pp.product_id = $1 AND cp.v2 AND cp.status IN ('draft', 'submitted', 'approved', 'rejected')`, [productId]);
    if (!posts.length) return;
    if (wasOn !== isOn || Number(before.price) !== Number(after.price)) for (const r of posts) await refreshFacets(r.id);
  } catch (e) { console.error('[posts] product change:', e.message); }
}

/**
 * listing-shop-safety (board C1): why a live post is not in the shop right now — said on the
 * creator's own post page — or null when shoppers can see it. One query set per call: asked for a
 * single post, never for a list.
 */
async function notInShopWhy(p) {
  if (await require('./shopperPosts.service').isLive(p.id)) return null;
  const { rows: prods } = await db.query(
    `SELECT bp.is_active, bp.pushed_to_store, bp.stock, bp.variants_json
       FROM post_products pp JOIN brand_products bp ON bp.id = pp.product_id WHERE pp.post_id = $1`, [p.id]);
  const sells = prods.some((x) => onSale(x) && stockService.available(x));
  if (!sells) return MSG.NOT_IN_SHOP_PRODUCTS;
  if (p.post_kind === 'offer' && p.offer_id) {
    const { rows: [o] } = await db.query(`SELECT sub_type FROM brand_offers WHERE id = $1`, [p.offer_id]);
    if (o && o.sub_type === 'fixed') return MSG.NOT_IN_SHOP_SET;
  }
  return MSG.NOT_IN_SHOP;
}

/** The offer page (O10, O11): her posts using this offer, and what removing products would empty. */
async function offerPostStats(offerId, { productIds = null, today = todayInIndia() } = {}) {
  const { rows } = await db.query(
    `${POST_SQL} WHERE cp.v2 AND cp.offer_id = $1 AND cp.status IN ('submitted', 'approved')`, [offerId]);
  const byCi = new Map();
  let live = 0;
  for (const p of rows) {
    const st = stateOf(p, today);
    if (st === 'live') live += 1;
    // item 20: an own-brand post counts as live on the offer, and belongs to no creator's collaboration row
    if ((st === 'live' || st === 'approved') && p.campaign_influencer_id) byCi.set(p.campaign_influencer_id, (byCi.get(p.campaign_influencer_id) || 0) + 1);
  }
  let touched = 0; let emptied = 0;
  if (productIds && productIds.length && rows.length) {
    const prods = await productsOf(rows.map((r) => r.id));
    for (const p of rows) {
      const ids = (prods.get(p.id) || []).map((x) => x.id);
      const hit = ids.filter((id) => productIds.includes(id));
      if (hit.length) touched += 1;
      if (ids.length && hit.length === ids.length) emptied += 1;
    }
  }
  return { live, byCi, touched, emptied };
}

/** Daily: offers whose end date has passed take their posts out of the shop (and tell her). */
async function sweepEndedOffers(today = todayInIndia()) {
  const { rows } = await db.query(
    `SELECT DISTINCT cp.offer_id FROM creator_posts cp JOIN brand_offers o ON o.id = cp.offer_id
      WHERE ${OPEN} AND (o.status = 'ended' OR o.ends_on < $1::date)`, [today]);
  let n = 0;
  for (const r of rows) n += await afterOfferEnded(r.offer_id);
  return { offers: rows.length, posts: n };
}

/**
 * shopper-walk-fixes (W16): INFLX adds the picture of a video that has none — a video uploaded before
 * the creator's phone made one (4 Oct 2026). The picture is a JPEG taken from that same video. It is
 * stored where her own would have been and served by the same door, so every tile shows the post
 * instead of a product photo. A picture that is already there is kept unless `replace` is asked.
 */
async function setVideoPicture(mediaId, jpeg, { replace = false } = {}) {
  if (!UUID.test(String(mediaId || ''))) throw new AppError('NOT_FOUND', 'Not found', 404);
  const { rows: [m] } = await db.query(
    `SELECT m.id, m.mime, m.cover_r2_key, p.id AS post_id, p.post_code, p.influencer_id
       FROM post_media m JOIN creator_posts p ON p.id = m.post_id WHERE m.id = $1`, [mediaId]);
  if (!m) throw new AppError('NOT_FOUND', 'Not found', 404);
  if (kindOf(String(m.mime || '').toLowerCase()) !== 'video') throw bad('Only a video has a picture taken from it', 'media');
  if (!Buffer.isBuffer(jpeg) || jpeg.length < 4 || jpeg[0] !== 0xFF || jpeg[1] !== 0xD8 || jpeg[2] !== 0xFF) throw bad('The picture must be a JPEG', 'jpeg');
  if (jpeg.length > COVER_MB * MB) throw bad(MSG.FILE_TOO_BIG(COVER_MB), 'jpeg');
  if (m.cover_r2_key && !replace) return { media_id: m.id, post_code: m.post_code, changed: false, cover_url: coverUrl(m.id) };
  const key = `posts/${m.influencer_id}/${m.post_id}/${crypto.randomUUID()}.jpg`;
  await storage.put(key, 'image/jpeg', jpeg);
  await db.query(`UPDATE post_media SET cover_r2_key = $2 WHERE id = $1`, [m.id, key]);
  if (m.cover_r2_key) await storage.remove(m.cover_r2_key);
  return { media_id: m.id, post_code: m.post_code, changed: true, cover_url: coverUrl(m.id) };
}

module.exports = {
  setVideoPicture,
  MAX_SLIDES, MAX_PRODUCTS, MAX_VIDEO_S, GROUPS,
  postable, brands, collaborations, createDraft, options, update, uploadUrl, submit, takeDown, remove,
  getPost, getMany, getAny, listMine, createHome, stateOf, liveDayOf, titleOf, bandFor, shopperPrice, priceBands, themeTags,
  approveCheck, afterDecision, adminShape,
  afterOfferEnded, afterProductsLeftOffer, afterProductChange, sweepEndedOffers, refreshFacets, offerPostStats,
  doneCounts, myCollabs, canPost, minOf,
};
