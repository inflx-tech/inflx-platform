'use strict';

/**
 * shopperPosts.service.js — posts as the shopper app sees them (follower-app-v2).
 * Contract: features/follower-app-v2 · boards F2–F12 · rules v1.7 §5, §4.12–4.15, M1–M6
 *
 * Every purchase happens through a creator's post (P1), so everything a shopper sees is built
 * from LIVE posts: approved, posting date reached, not removed, the offer still running, and at
 * least one product on sale and in stock. A post shows its offer already applied (F3).
 *
 * Shopper identity ("who"): a signed-in follower, or a guest known only by the phone's anonymous
 * device id. Location arrives with the request and is never stored (5.3).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { calendarDay, todayInIndia } = require('../utils/indiaDay');
const rules = require('./offerRules');
const posts = require('./shoppablePosts.service');
const { MSG } = require('./shopperCopy');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[BCDFGHJKMNPQRSTVWXYZ2-9]{6}$/;
const SEGMENTS = { women: 'Women', men: 'Men', kids: 'Kids' };
const inr = rules.inr;
const notFound = (m = MSG.NOT_FOUND) => new AppError('NOT_FOUND', m, 404);
const linkHost = () => (process.env.PUBLIC_LINK_HOST || 'inflx.in').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const cleanIds = (xs) => [...new Set((Array.isArray(xs) ? xs : []).map(String).filter((x) => UUID.test(x)))];

/* ───────────────────────────────────────────── who is asking */

/** The shopper behind a request. Nothing here is stored. */
function whoOf(req, extra = {}) {
  const src = { ...(req.query || {}), ...(req.body || {}), ...extra };
  const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const lat = num(src.lat);
  const lng = num(src.lng);
  const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
  return {
    userId: req.user && req.user.role === 'follower' ? req.user.sub : null,
    followerId: null,                               // filled by resolveWho
    deviceId: String(req.headers['x-device-id'] || src.device_id || '').slice(0, 128) || null,
    lat: lat != null && Math.abs(lat) <= 90 ? lat : null,
    lng: lng != null && Math.abs(lng) <= 180 ? lng : null,
    cityId: num(src.city_id),
    shopFor: list(src.shop_for).map((s) => s.toLowerCase()).filter((s) => SEGMENTS[s]),
    styleIds: cleanIds(list(src.styles)),
    follows: cleanIds(list(src.follows)),         // a guest's follows live on the phone (5.2)
  };
}

/** Adds the follower id and, for a signed-in shopper, her saved choices when the phone sent none. */
async function resolveWho(who) {
  if (!who.userId) return who;
  const { rows } = await db.query(`SELECT id, city_id, shop_for, style_tag_ids FROM followers WHERE user_id = $1`, [who.userId]);
  const f = rows[0];
  if (!f) return who;
  return {
    ...who,
    followerId: f.id,
    cityId: who.cityId || f.city_id || null,
    shopFor: who.shopFor.length ? who.shopFor : (f.shop_for || []),
    styleIds: who.styleIds.length ? who.styleIds : (f.style_tag_ids || []),
  };
}

/** Where she is: the phone's location, else her city's centre. */
async function pointOf(who) {
  if (who.lat != null && who.lng != null) return { lat: who.lat, lng: who.lng, from: 'location' };
  if (!who.cityId) return null;
  const { rows } = await db.query(`SELECT lat, lng FROM ref_cities WHERE id = $1 AND lat IS NOT NULL`, [who.cityId]);
  return rows[0] ? { lat: Number(rows[0].lat), lng: Number(rows[0].lng), from: 'city' } : null;
}

function km(a, b) {
  if (!a || !b) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/* ───────────────────────────────────────────── the live pool */

/**
 * Live posts with what the feed needs to order them. Filters: videos only (Play), one creator, one
 * brand, one offer, one category leaf, or a list of ids.
 *
 * `segments` (her Women / Men / Kids) is a PREFERENCE, never a filter (founder, 1 Oct 2026; rules
 * v1.16 §5.12): no post is hidden for it. Each post comes back with `preferred` — true when she
 * chose nothing, when the post has no category, or when one of its categories is one she shops for
 * (Unisex always is) — and the feed puts the preferred ones first.
 */
async function livePool({ segments = [], videosOnly = false, influencerId = null, brandId = null, offerId = null,
  leafId = null, ids = null, limit = 1500, today = todayInIndia() } = {}) {
  const params = [today];
  const where = [];
  const add = (v) => { params.push(v); return `$${params.length}`; };
  const preferred = segments.length
    ? `(cardinality(cp.category_node_ids) = 0 OR EXISTS (SELECT 1 FROM category_nodes n
       WHERE n.id = ANY(cp.category_node_ids) AND n.segment = ANY(${add([...segments.map((s) => SEGMENTS[s]), 'Unisex'])}::text[])))`
    : 'true';
  if (videosOnly) where.push(`cp.media_kind = 'video'`);
  if (influencerId) where.push(`cp.influencer_id = ${add(influencerId)}`);
  if (brandId) where.push(`cp.brand_id = ${add(brandId)}`);
  if (offerId) where.push(`cp.offer_id = ${add(offerId)}`);
  if (leafId) where.push(`${add(leafId)}::uuid = ANY(cp.category_node_ids)`);
  if (ids) where.push(`cp.id = ANY(${add(cleanIds(ids))}::uuid[])`);
  // features/posting-date-last-day (rules v1.15 §4.1, §5.12): a post is in the shop from the moment
  // INFLX approves it. An offer post is visible only while its offer is active, so it also waits for
  // the offer's start. The set's posting date is the last day to go live and is not asked here.
  const liveDay = `CASE WHEN cp.post_kind = 'offer' THEN o.starts_on END`;
  const { rows } = await db.query(
    `SELECT cp.id, cp.influencer_id, cp.brand_id, cp.post_kind, cp.offer_id, o.offer_type, cp.media_kind,
            cp.category_node_ids, cp.theme_tag_ids, cp.price_band_id, ${preferred} AS preferred,
            GREATEST(COALESCE(((${liveDay})::timestamp AT TIME ZONE 'Asia/Kolkata'), cp.approved_at), cp.approved_at) AS live_at
       FROM creator_posts cp
       JOIN campaign_influencers ci ON ci.id = cp.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       LEFT JOIN brand_offers o ON o.id = cp.offer_id
      WHERE cp.v2 AND cp.status = 'approved' AND cp.approved_at IS NOT NULL AND cp.post_code IS NOT NULL
        AND ((${liveDay}) IS NULL OR (${liveDay}) <= $1::date)
        AND (cp.post_kind <> 'offer' OR (o.status = 'published' AND o.ends_on >= $1::date))
        -- Gifts run out → the offer can't keep its promise → its posts leave the shop (4.9, 6.4).
        AND (o.offer_type IS DISTINCT FROM 'free_gift' OR EXISTS (
              SELECT 1 FROM offer_pool_items gp LEFT JOIN gift_items gi ON gi.id = gp.gift_item_id
               WHERE gp.offer_id = o.id AND gp.pool = 'gift' AND gp.removed_at IS NULL
                 AND (gp.gift_item_id IS NULL OR gi.stock > 0)
                 AND (gp.gift_limit IS NULL OR gp.gifts_given < gp.gift_limit)))
        AND EXISTS (SELECT 1 FROM post_products pp JOIN brand_products bp ON bp.id = pp.product_id
                     WHERE pp.post_id = cp.id AND bp.is_active AND bp.pushed_to_store AND (bp.stock IS NULL OR bp.stock > 0))
        ${where.length ? `AND ${where.join(' AND ')}` : ''}
      ORDER BY live_at DESC, cp.id
      LIMIT ${Math.min(5000, Math.max(1, Number(limit) || 1500))}`, params);
  return rows.map((r) => ({ ...r, live_at: new Date(r.live_at) }));
}

async function isLive(postId) {
  if (!UUID.test(String(postId || ''))) return false;
  return (await livePool({ ids: [postId], limit: 1 })).length === 1;
}

/** Each creator's city centre and each brand's store branches, for "near" (5.3). */
async function placesOf(pool) {
  const infl = [...new Set(pool.map((p) => p.influencer_id))];
  const brands = [...new Set(pool.map((p) => p.brand_id))];
  const creatorAt = new Map();
  const brandAt = new Map();
  if (infl.length) {
    const { rows } = await db.query(
      `SELECT i.id, rc.lat, rc.lng FROM influencers i JOIN ref_cities rc ON rc.id = i.city_id
        WHERE i.id = ANY($1::uuid[]) AND rc.lat IS NOT NULL`, [infl]);
    for (const r of rows) creatorAt.set(r.id, { lat: Number(r.lat), lng: Number(r.lng) });
  }
  if (brands.length) {
    const { rows } = await db.query(
      `SELECT bb.brand_id, COALESCE(bb.lat, rc.lat) AS lat, COALESCE(bb.lng, rc.lng) AS lng
         FROM brand_branches bb LEFT JOIN ref_cities rc ON rc.id = bb.city_id
        WHERE bb.brand_id = ANY($1::uuid[])`, [brands]);
    for (const r of rows) {
      if (r.lat == null || r.lng == null) continue;
      const list = brandAt.get(r.brand_id) || [];
      list.push({ lat: Number(r.lat), lng: Number(r.lng) });
      brandAt.set(r.brand_id, list);
    }
  }
  return { creatorAt, brandAt };
}

/** The distance from her to a post: the nearer of its creator's city and its brand's stores. */
function distanceOf(p, point, places) {
  if (!point) return null;
  const ds = [];
  const c = places.creatorAt.get(p.influencer_id);
  if (c) ds.push(km(point, c));
  for (const b of places.brandAt.get(p.brand_id) || []) ds.push(km(point, b));
  return ds.length ? Math.min(...ds) : null;
}

/* ───────────────────────────────────────────── what a post looks like to a shopper */

/** The short label on a post (F2): "20% OFF", "ANY 2 FOR ₹2,999", "BUY 2 → 30%". */
function badgeOf(offer) {
  if (!offer) return null;
  const c = rules.normaliseConfig(offer.sub_type, offer.offer_config_json || {});
  const pct = (v) => `${Number(v) % 1 === 0 ? Number(v) : Number(v).toFixed(1)}%`;
  switch (offer.sub_type) {
    case 'percentage': return c.pct != null ? `${pct(c.pct)} OFF` : null;
    case 'flat': return c.amount != null ? `${inr(c.amount)} OFF` : null;
    case 'bogo': return 'BUY 1 GET 1';
    case 'quantity':
    case 'value': {
      const t = (c.tiers || []).find((x) => x.at != null && x.value != null);
      if (!t) return null;
      const r = c.reward === 'amount' ? `${inr(t.value)} OFF` : pct(t.value);
      return offer.sub_type === 'quantity' ? `BUY ${t.at} → ${r}` : `SPEND ${inr(t.at)} → ${r}`;
    }
    case 'pick_any':
    case 'mix_match': return c.pick != null && c.price != null ? `ANY ${c.pick} FOR ${inr(c.price)}` : null;
    case 'fixed': return c.price != null ? `SET FOR ${inr(c.price)}` : null;
    case 'spend':
    case 'buy_x': return 'FREE GIFT';
    default: return null;
  }
}

/** The line at the top of Shop this post (F3): "20% off applied", "Any 2 for ₹2,999". */
function appliedLine(offer) {
  if (!offer) return null;
  const c = rules.normaliseConfig(offer.sub_type, offer.offer_config_json || {});
  if (offer.sub_type === 'percentage' && c.pct != null) return `${Number(c.pct) % 1 === 0 ? Number(c.pct) : Number(c.pct).toFixed(1)}% off applied`;
  if (offer.sub_type === 'flat' && c.amount != null) return `${inr(c.amount)} off applied`;
  return rules.dealLine(offer) || offer.name || null;
}

async function creatorsById(ids) {
  const clean = cleanIds(ids);
  if (!clean.length) return new Map();
  const { rows } = await db.query(
    `SELECT i.id, COALESCE(i.full_name, u.name) AS name, lower(regexp_replace(COALESCE(i.instagram_handle, ''), '^@', '')) AS handle,
            i.profile_image_url AS avatar, rc.name AS city
       FROM influencers i JOIN users u ON u.id = i.user_id LEFT JOIN ref_cities rc ON rc.id = i.city_id
      WHERE i.id = ANY($1::uuid[])`, [clean]);
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name || 'Creator', handle: r.handle || null, avatar: r.avatar || null, city: r.city || null }]));
}

async function brandsById(ids) {
  const clean = cleanIds(ids);
  if (!clean.length) return new Map();
  const { rows } = await db.query(
    `SELECT b.id, b.business_name AS name, b.logo_url AS logo,
            COALESCE((SELECT rc.name FROM brand_branches bb JOIN ref_cities rc ON rc.id = bb.city_id
                       WHERE bb.brand_id = b.id ORDER BY bb.is_main DESC, bb.created_at LIMIT 1), u.city) AS city
       FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = ANY($1::uuid[])`, [clean]);
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name || 'Brand', logo: r.logo || null, city: r.city || null }]));
}

async function countsOf(ids) {
  const out = new Map(ids.map((id) => [id, { likes: 0, comments: 0, shares: 0, saves: 0 }]));
  if (!ids.length) return out;
  const { rows } = await db.query(
    `SELECT p.id,
            (SELECT count(*)::int FROM post_likes l WHERE l.post_id = p.id) AS likes,
            (SELECT count(*)::int FROM post_comments c WHERE c.post_id = p.id AND c.status = 'visible') AS comments,
            (SELECT count(*)::int FROM post_events e WHERE e.post_id = p.id AND e.event_type = 'share') AS shares,
            (SELECT count(*)::int FROM post_saves s WHERE s.post_id = p.id) AS saves
       FROM unnest($1::uuid[]) AS p(id)`, [ids]);
  for (const r of rows) out.set(r.id, { likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves });
  return out;
}

async function mineOf(ids, followerId) {
  const out = new Map(ids.map((id) => [id, { liked: false, saved: false, saved_products: [] }]));
  if (!ids.length || !followerId) return out;
  const [l, s, w] = await Promise.all([
    db.query(`SELECT post_id FROM post_likes WHERE follower_id = $1 AND post_id = ANY($2::uuid[])`, [followerId, ids]),
    db.query(`SELECT post_id FROM post_saves WHERE follower_id = $1 AND post_id = ANY($2::uuid[])`, [followerId, ids]),
    db.query(`SELECT post_id, product_id FROM follower_wishlist_items WHERE follower_id = $1 AND post_id = ANY($2::uuid[])`, [followerId, ids]),
  ]);
  for (const r of l.rows) out.get(r.post_id).liked = true;
  for (const r of s.rows) out.get(r.post_id).saved = true;
  for (const r of w.rows) out.get(r.post_id).saved_products.push(r.product_id);
  return out;
}

/** One post as every shopper screen reads it (F2–F5, F7–F12). Never who bought. */
function card(p, { creator, brand, counts, mine, liveAt }) {
  const shaped = p.offer_id ? offerRowOf(p) : null;
  const products = p.products.filter((x) => x.on_sale !== false).map((x) => {
    const pays = posts.shopperPrice(shaped, x.price);
    return {
      id: x.id, name: x.name, image_url: x.image_url, price: x.price,
      shopper_price: pays, struck: pays < x.price,
      in_stock: x.available !== undefined ? x.available : (x.stock == null || x.stock > 0),   // F6: its sizes decide
      pin: x.pin,
    };
  });
  return {
    id: p.id, code: p.code, title: p.shopper_title || p.title, caption: p.caption,   // N7: never an internal title
    share_url: `https://${linkHost()}/p/${p.code}`,
    creator, brand,
    media_kind: p.media_kind, media_layout: p.media_layout, tag_style: p.tag_style,
    // shopper-walk-fixes (W15): cover_url is a picture taken from a video (null for a photo, and for
    // a video uploaded before the creator's phone made one).
    media: p.media.map((m) => ({ id: m.id, url: m.url, mime: m.mime, width: m.width, height: m.height, duration_s: m.duration_s, cover_url: m.cover_url || null })),
    offer: shaped ? {
      // `type` is the offer type's display name ("Discount", "BOGO"…) and always was; `kind` is the
      // type itself (discount | bogo | volume | bundle | free_gift), for anything that must decide.
      id: p.offer_id, type: p.offer ? p.offer.type : null, kind: shaped.offer_type || null, sub_type: shaped.sub_type,
      badge: badgeOf(shaped), line: appliedLine(shaped), deal: p.offer ? p.offer.deal : null,
      ends_on: p.offer ? p.offer.ends_on : null,
      // Said to the SHOPPER (board table T). The creator's own sentence is rules.shopperHow.
      how: rules.shopperSays(shaped, { buy: products }),
    } : null,
    // shopper-walk-fixes (O1): whether this post opens a deal page — decided HERE, once. A plain
    // discount or a price post never does. (The phone used to guess from `offer.type`, which is a
    // display name, so every discount post flashed "Build your deal" until the deal data arrived.)
    deal_page: !!shaped && !!shaped.offer_type && shaped.offer_type !== 'discount',
    gift_line: null,
    products,
    counts, mine,
    live_since: liveAt ? liveAt.toISOString() : null,
    facets: { price_band: p.facets.price_band, theme: p.facets.theme, category: p.facets.category },
  };
}

/** The offer fields shoppablePosts' shape keeps, rebuilt for the price and badge helpers. */
function offerRowOf(p) {
  return { offer_type: p._offer_type, sub_type: p._sub_type, offer_config_json: p._offer_config || {}, name: p.offer ? p.offer.name : null };
}

/** Full cards for a list of post ids, in the same order. Only live posts come back. */
async function cards(ids, who = {}, { liveOnly = true } = {}) {
  const clean = cleanIds(ids);
  if (!clean.length) return [];
  const live = liveOnly ? await livePool({ ids: clean, limit: clean.length }) : null;
  const liveAt = new Map((live || []).map((r) => [r.id, r.live_at]));
  const keep = liveOnly ? clean.filter((id) => liveAt.has(id)) : clean;
  if (!keep.length) return [];
  const full = await posts.getMany(keep);
  const { rows: extra } = await db.query(
    `SELECT cp.id, o.offer_type, o.sub_type, o.offer_config_json FROM creator_posts cp LEFT JOIN brand_offers o ON o.id = cp.offer_id
      WHERE cp.id = ANY($1::uuid[])`, [keep]);
  const offerById = new Map(extra.map((r) => [r.id, r]));
  const [creators, brands, counts, mine] = await Promise.all([
    creatorsById(full.map((p) => p.influencer_id)),
    brandsById(full.map((p) => p.collaboration.brand_id)),
    countsOf(keep),
    mineOf(keep, who.followerId),
  ]);
  const gifts = await giftLines(full.filter((p) => offerById.get(p.id) && offerById.get(p.id).offer_type === 'free_gift'));
  return full.map((p) => {
    const o = offerById.get(p.id) || {};
    const withOffer = { ...p, _offer_type: o.offer_type, _sub_type: o.sub_type, _offer_config: o.offer_config_json };
    const c = card(withOffer, {
      creator: creators.get(p.influencer_id) || { id: p.influencer_id, name: 'Creator' },
      brand: brands.get(p.collaboration.brand_id) || { id: p.collaboration.brand_id, name: p.collaboration.brand_name },
      counts: counts.get(p.id), mine: mine.get(p.id), liveAt: liveAt.get(p.id) || null,
    });
    c.gift_line = gifts.get(p.id) || null;
    return c;
  });
}

/** "Free with this: silver coin" — the gift shows automatically on a free-gift post (4.3). */
async function giftLines(list) {
  const out = new Map();
  for (const p of list) {
    try {
      const frozen = await require('./offerPool.service').frozenPool(p.offer_id);
      const names = (frozen.gift || []).map((g) => g.name).filter(Boolean);
      if (names.length) out.set(p.id, `Free with this: ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`}`);
    } catch (e) {
      // A gift list that can't be read never hides the post.
    }
  }
  return out;
}

async function one(postId, who) {
  const [c] = await cards([postId], who);
  if (!c) throw notFound(MSG.GONE);
  return c;
}

/* ───────────────────────────────────────────── a code, and search (F12) */

/**
 * A post code typed in search: exactly that post, counted as a "Post code" visit (4.14). A post
 * link opened inside the app passes its channel ending instead (ig, yt, wa, fb, o).
 */
async function byCode(raw, who, visitor = {}, channel = 'code') {
  const code = String(raw || '').trim().toUpperCase();
  if (!CODE_RE.test(code)) return { state: 'unknown', message: MSG.NO_CODE };
  const { rows } = await db.query(
    `SELECT cp.id, cp.influencer_id, cs.go_live_date FROM creator_posts cp
       JOIN campaign_influencers ci ON ci.id = cp.campaign_influencer_id JOIN campaign_sets cs ON cs.id = ci.set_id
      WHERE cp.post_code = $1 AND cp.v2`, [code]);
  const hit = rows[0];
  if (!hit) return { state: 'unknown', message: MSG.NO_CODE };
  await require('./postLinks.service').recordVisit({ kind: 'post', channel, influencerId: hit.influencer_id, postId: hit.id,
    visitor: { ua: visitor.ua || null, deviceId: who.deviceId } });
  const creator = (await creatorsById([hit.influencer_id])).get(hit.influencer_id) || null;
  const [c] = await cards([hit.id], who);
  if (c) return { state: 'live', post: c };
  const p = await posts.getAny(hit.id);
  if (p && p.state === 'approved') return { state: 'upcoming', message: MSG.UPCOMING(rules.dayMonth(p.goes_live_on || calendarDay(hit.go_live_date))), creator, title: p.title };
  return { state: 'gone', message: MSG.GONE, creator, title: p ? p.title : null };
}

/** F12 — a code opens exactly that post; anything else searches creators, brands and posts. */
async function search(q, who, visitor = {}) {
  const text = String(q || '').trim().slice(0, 60);
  if (!text) return { code_match: null, creators: [], brands: [], posts: [] };
  const asCode = text.toUpperCase();
  const codeMatch = CODE_RE.test(asCode) ? await byCode(asCode, who, visitor) : null;
  const like = `%${text.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const pool = await livePool({ limit: 2000 });
  const ids = pool.map((p) => p.id);
  const creatorsWithPosts = [...new Set(pool.map((p) => p.influencer_id))];
  const brandsWithPosts = [...new Set(pool.map((p) => p.brand_id))];
  const [cr, br, po] = await Promise.all([
    creatorsWithPosts.length ? db.query(
      `SELECT i.id FROM influencers i JOIN users u ON u.id = i.user_id
        WHERE i.id = ANY($1::uuid[]) AND (COALESCE(i.full_name, u.name) ILIKE $2 OR i.instagram_handle ILIKE $2)
        ORDER BY COALESCE(i.full_name, u.name) LIMIT 10`, [creatorsWithPosts, like]) : { rows: [] },
    brandsWithPosts.length ? db.query(
      `SELECT id FROM brands WHERE id = ANY($1::uuid[]) AND business_name ILIKE $2 ORDER BY business_name LIMIT 10`, [brandsWithPosts, like]) : { rows: [] },
    ids.length ? db.query(
      `SELECT DISTINCT cp.id, cp.approved_at FROM creator_posts cp JOIN brands b ON b.id = cp.brand_id
         LEFT JOIN post_products pp ON pp.post_id = cp.id LEFT JOIN brand_products bp ON bp.id = pp.product_id
        WHERE cp.id = ANY($1::uuid[]) AND (cp.caption ILIKE $2 OR b.business_name ILIKE $2 OR bp.name ILIKE $2)
        ORDER BY cp.approved_at DESC LIMIT 20`, [ids, like]) : { rows: [] },
  ]);
  const creators = await creatorsById(cr.rows.map((r) => r.id));
  const brands = await brandsById(br.rows.map((r) => r.id));
  const liveCount = (key, id) => pool.filter((p) => p[key] === id).length;
  return {
    code_match: codeMatch,
    creators: cr.rows.map((r) => ({ ...creators.get(r.id), live_posts: liveCount('influencer_id', r.id) })),
    brands: br.rows.map((r) => ({ ...brands.get(r.id), live_posts: liveCount('brand_id', r.id) })),
    posts: await cards(po.rows.map((r) => r.id), who),
  };
}

/* ───────────────────────────────────────────── opening a post (F4) */

/**
 * A photo opened: that creator's posts, newest first, then similar posts (same brand or
 * category), then everything else, so it never dead-ends (5.6).
 */
async function more(postId, who, { served = [], size = 12 } = {}) {
  const [base] = await livePool({ ids: [postId], limit: 1 });
  if (!base) throw notFound(MSG.GONE);
  const skip = new Set([postId, ...cleanIds(served)]);
  const pool = (await livePool({ segments: who.shopFor })).filter((p) => !skip.has(p.id));
  const leaves = new Set(base.category_node_ids || []);
  const tier = (p) => (p.influencer_id === base.influencer_id ? 0
    : (p.brand_id === base.brand_id || (p.category_node_ids || []).some((l) => leaves.has(l))) ? 1 : 2);
  // Within a tier, what she shops for comes first; nothing is left out for it (rules v1.16 §5.12).
  const ordered = pool.sort((a, b) => tier(a) - tier(b) || (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0) || b.live_at - a.live_at);
  const page = ordered.slice(0, size);
  const list = await cards(page.map((p) => p.id), who);
  const tierOf = new Map(page.map((p) => [p.id, tier(p)]));
  return {
    posts: list.map((c) => ({ ...c, from: ['creator', 'similar', 'more'][tierOf.get(c.id)] })),
    more: ordered.length > size,
  };
}

module.exports = {
  SEGMENTS, CODE_RE, whoOf, resolveWho, pointOf, km, livePool, isLive, placesOf, distanceOf,
  badgeOf, appliedLine, creatorsById, brandsById, cards, one, byCode, search, more, cleanIds,
};
