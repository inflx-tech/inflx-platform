'use strict';

/**
 * sectionRules.service.js — the ranking rule library behind every shelf.
 *
 * Each rule is `async (ctx) => Item[]`. The engine (sectionEngine.service)
 * picks the rule by the section_config.rule key, passes a context, and gets
 * back ranked items already carrying their 4-ID tracking block.
 *
 * ctx fields:
 *   city        follower city (soft boost, mirrors existing feed behavior)
 *   followerId  uuid or null
 *   followedIds Set<uuid> of influencers the follower follows
 *   categoryKey vertical key (dining/shopping/...) for category rails
 *   influencer  resolved { id, instagram_handle, ... } for creator screens
 *   limit       item count
 *   windowDays  lookback for engagement/conversion/new rules (default 7)
 *
 * BACKEND-FIRST (verified 2026-06-02):
 *   - "live offer" = the canonical chain (co.is_active + ci.status + c.status).
 *   - city = users.city via brand→users (no offer.city column).
 *   - offer expiry = campaign_influencers.offer_expires_at (NOT on campaign_offers).
 *   - brand-level conversions = follower_transactions.brand_id (direct).
 *   - product-level sales (top_by_sales) is NOT attributable yet
 *     (follower_transactions has offer_id, not product_id) → returns [] and the
 *     product rails are seeded enabled=false. No fabricated data.
 */

const db = require('../config/db');
const { buildTracking } = require('../utils/tracking');
const offerAdapter = require('./brandOffers.adapter');

// OR cutover (contract: listing-section-d0-seams / section-offer-repoint): when
// SECTION_ENGINE_OFFERS is ON, offer shelves read the brandOffers.adapter (offers
// from the creator assignment + engagement showcase + store-direct) instead of the
// legacy campaign_offers SQL below. OFF (default) = unchanged legacy behaviour.
async function offersViaAdapter(ruleKey, ctx) {
  const items = await offerAdapter.fetchOffers({ limit: 200 });
  return offerAdapter.rankForRule(ruleKey, items, {
    categoryKeys: categoryFilter(ctx.categoryKey),
    followedIds: ctx.followedIds,
    influencerId: ctx.influencer && ctx.influencer.id,
    limit: ctx.limit || 8,
  });
}

// Category → brand.category schema keys (mirrors follower.service CATEGORY_MAP).
const CATEGORY_MAP = {
  dining:   ['restaurant', 'bakery'],
  shopping: ['fashion_walkin', 'fashion_online', 'florist', 'packaged_food'],
  groom:    ['salon'],
  booking:  ['salon', 'car_rental', 'function_hall', 'wedding_planner'],
  travel:   ['car_rental'],
  events:   ['function_hall', 'wedding_planner'],
};

// One row per live (campaign_influencer × offer). Only rows with a real offer.
const OFFER_COLS = `
    co.id                 AS offer_id,
    co.offer_type::text   AS offer_type,
    co.discount_value     AS discount_value,
    co.availing_modes     AS availing_modes,
    co.prebook_advance    AS prebook_advance,
    cs.id                 AS set_id,
    cs.campaign_id        AS campaign_id,
    c.end_date            AS end_date,
    ci.id                 AS campaign_influencer_id,
    ci.influencer_id      AS influencer_id,
    ci.offer_expires_at   AS offer_expires_at,
    ci.created_at         AS ci_created_at,
    b.id                  AS brand_id,
    b.business_name       AS brand_name,
    b.category            AS brand_category,
    u_b.city              AS brand_city,
    i.instagram_handle    AS handle,
    i.followers_count     AS followers_count,
    i.profile_image_url   AS profile_pic_url,
    u_i.name              AS influencer_name`;

const OFFER_FROM = `
  FROM campaign_influencers ci
  JOIN campaign_sets cs  ON cs.id = ci.set_id
  JOIN campaigns c       ON c.id  = cs.campaign_id
  JOIN brands b          ON b.id  = c.brand_id
  JOIN users  u_b        ON u_b.id = b.user_id
  JOIN influencers i     ON i.id  = ci.influencer_id
  JOIN users  u_i        ON u_i.id = i.user_id
  JOIN campaign_offers co ON co.set_id = cs.id AND co.is_active = true
  WHERE ci.status IN ('contracted','active','completed')
    AND c.status  IN ('published','active','live')
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)`;

// ── mappers ─────────────────────────────────────────────────────────────────

function mapOfferItem(r) {
  return {
    entity_type: 'offer',
    id: r.offer_id,
    offer_type: r.offer_type,
    discount_value: r.discount_value != null ? parseFloat(r.discount_value) : null,
    availing_modes: r.availing_modes || [],
    prebook_advance: r.prebook_advance != null ? parseFloat(r.prebook_advance) : null,
    end_date: r.end_date,
    offer_expires_at: r.offer_expires_at,
    brand: { id: r.brand_id, name: r.brand_name, category: r.brand_category, city: r.brand_city },
    via_creator: r.handle
      ? { id: r.influencer_id, handle: r.handle, name: r.influencer_name, avatar: r.profile_pic_url }
      : null,
    tracking: buildTracking({
      handle: r.handle, cid: r.campaign_id, sid: r.set_id, oid: r.offer_id, iid: r.influencer_id,
    }),
  };
}

function mapBrandItem(r) {
  return {
    entity_type: 'brand',
    id: r.brand_id,
    name: r.brand_name,
    category: r.brand_category,
    city: r.brand_city,
    distance_km: r.dist_km != null ? Math.round(Number(r.dist_km) * 10) / 10 : undefined,
    score: r.score != null ? Number(r.score) : undefined,
    // A brand tile attributes to the creator who surfaced it when reached via one.
    tracking: r.handle
      ? buildTracking({ handle: r.handle, cid: r.campaign_id, sid: r.set_id, iid: r.influencer_id })
      : null,
  };
}

function mapCreatorItem(r) {
  return {
    entity_type: 'creator',
    id: r.influencer_id || r.id,
    handle: r.handle || r.instagram_handle,
    name: r.influencer_name || r.name,
    avatar: r.profile_pic_url || r.profile_image_url,
    followers_count: r.followers_count,
    has_live_deal: r.has_live_deal === true || r.live_deals > 0 || undefined,
  };
}

// city is a soft boost (LOWER(u_b.city)=LOWER($city) sorts first), matching the
// existing getHomeFeed/getDealsByCategory behavior — never a hard filter, so
// shelves stay populated when a city has thin inventory.
function cityBoost(city, paramIdx) {
  return city
    ? `CASE WHEN LOWER(u_b.city) = LOWER($${paramIdx}) THEN 0 ELSE 1 END,`
    : '';
}

function categoryFilter(categoryKey) {
  const cats = categoryKey && CATEGORY_MAP[categoryKey];
  return cats && cats.length ? cats : null;
}

// Haversine great-circle distance in km from ($latIdx,$lngIdx) to (latCol,lngCol).
// No PostGIS — pure SQL; LEAST/GREATEST clamp guards acos domain errors.
function haversineKm(latIdx, lngIdx, latCol = 'b.lat', lngCol = 'b.lng') {
  return `(6371 * acos(LEAST(1, GREATEST(-1, ` +
    `cos(radians($${latIdx})) * cos(radians(${latCol})) * cos(radians(${lngCol}) - radians($${lngIdx})) + ` +
    `sin(radians($${latIdx})) * sin(radians(${latCol}))))))`;
}
const hasCoords = (ctx) => Number.isFinite(ctx?.lat) && Number.isFinite(ctx?.lng);

// ── OFFER rules ─────────────────────────────────────────────────────────────

// Engagement = recent clicks (link_clicks) + recent conversions (txns) on the offer.
async function topByEngagementOffers(ctx) {
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('top_by_engagement', ctx);
  const { city, limit = 8, windowDays = 7, categoryKey } = ctx;
  const params = [];
  let p = 0;
  const cats = categoryFilter(categoryKey);
  const catClause = cats ? `AND b.category = ANY($${++p})` : '';
  if (cats) params.push(cats);
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const winIdx = ++p; params.push(windowDays);
  const limIdx = ++p; params.push(limit);

  // Engagement = recent clicks + recent conversions, via correlated scalar
  // subqueries (kept in SELECT so they compose with OFFER_FROM's WHERE).
  const sql = `
    SELECT ${OFFER_COLS},
      ( (SELECT count(*) FROM link_clicks lc
          WHERE lc.offer_id = co.id
            AND lc.clicked_at >= now() - ($${winIdx} || ' days')::interval)
      + (SELECT count(*) FROM follower_transactions ft
          WHERE ft.offer_id = co.id
            AND ft.created_at >= now() - ($${winIdx} || ' days')::interval) ) AS score
    ${OFFER_FROM}
    ${catClause}
    ORDER BY ${city ? cityBoost(city, cityIdx) : ''} score DESC,
             i.followers_count DESC NULLS LAST
    LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapOfferItem);
}

async function topByConversionsOffers(ctx) {
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('top_by_conversions', ctx);
  const { city, limit = 8, windowDays = 30, categoryKey } = ctx;
  const params = [];
  let p = 0;
  const cats = categoryFilter(categoryKey);
  const catClause = cats ? `AND b.category = ANY($${++p})` : '';
  if (cats) params.push(cats);
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const winIdx = ++p; params.push(windowDays);
  const limIdx = ++p; params.push(limit);

  const sql = `
    SELECT ${OFFER_COLS},
      (SELECT count(*) FROM follower_transactions ft
        WHERE ft.offer_id = co.id
          AND ft.created_at >= now() - ($${winIdx} || ' days')::interval) AS score
    ${OFFER_FROM}
    ${catClause}
    ORDER BY ${city ? cityBoost(city, cityIdx) : ''} score DESC,
             i.followers_count DESC NULLS LAST
    LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapOfferItem);
}

// Most-bought + most-saved this week (offer-level — mixed shelf).
async function topPicks(ctx) {
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('top_picks', ctx);
  const { city, limit = 8, windowDays = 7 } = ctx;
  const params = [];
  let p = 0;
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const winIdx = ++p; params.push(windowDays);
  const limIdx = ++p; params.push(limit);

  const sql = `
    SELECT ${OFFER_COLS},
      ( (SELECT count(*) FROM follower_transactions ft
          WHERE ft.offer_id = co.id
            AND ft.created_at >= now() - ($${winIdx} || ' days')::interval)
      + (SELECT count(*) FROM follower_saved_offers so
          WHERE so.offer_id = co.id
            AND so.saved_at >= now() - ($${winIdx} || ' days')::interval) ) AS score
    ${OFFER_FROM}
    ORDER BY ${city ? cityBoost(city, cityIdx) : ''} score DESC,
             i.followers_count DESC NULLS LAST
    LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapOfferItem);
}

async function newest(ctx) {
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('newest', ctx);
  const { city, limit = 8, windowDays = 7 } = ctx;
  const params = [];
  let p = 0;
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const limIdx = ++p; params.push(limit);
  // Anchor on campaign_influencer creation (campaign_offers has no created_at).
  const sql = `
    SELECT ${OFFER_COLS}
    ${OFFER_FROM}
    ORDER BY ${city ? cityBoost(city, cityIdx) : ''} ci.created_at DESC
    LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapOfferItem);
}

async function followGraph(ctx) {
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('follow_graph', ctx);
  const { followedIds, limit = 8 } = ctx;
  const ids = followedIds && followedIds.size ? Array.from(followedIds) : null;
  if (!ids) return []; // anonymous / follows nobody → empty (honest, not faked)
  const sql = `
    SELECT ${OFFER_COLS}
    ${OFFER_FROM}
      AND ci.influencer_id = ANY($1)
    ORDER BY ci.created_at DESC
    LIMIT $2`;
  const { rows } = await db.query(sql, [ids, limit]);
  return rows.map(mapOfferItem);
}

async function biggestDiscounts(ctx) {
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('biggest_discounts', ctx);
  const { city, limit = 8 } = ctx;
  const params = [];
  let p = 0;
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const limIdx = ++p; params.push(limit);
  const sql = `
    SELECT ${OFFER_COLS}
    ${OFFER_FROM}
      AND co.discount_value IS NOT NULL
    ORDER BY ${city ? cityBoost(city, cityIdx) : ''} co.discount_value DESC
    LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapOfferItem);
}

async function endingSoon(ctx) {
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('ending_soon', ctx);
  const { city, limit = 8 } = ctx;
  const params = [];
  let p = 0;
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const limIdx = ++p; params.push(limit);
  // Expiry lives on campaign_influencers.offer_expires_at; only future ones.
  const sql = `
    SELECT ${OFFER_COLS}
    ${OFFER_FROM}
      AND ci.offer_expires_at IS NOT NULL
      AND ci.offer_expires_at >= now()
    ORDER BY ${city ? cityBoost(city, cityIdx) : ''} ci.offer_expires_at ASC
    LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapOfferItem);
}

async function allOffers(ctx) {
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('all_offers', ctx);
  const { city, limit = 30, categoryKey } = ctx;
  const params = [];
  let p = 0;
  const cats = categoryFilter(categoryKey);
  const catClause = cats ? `AND b.category = ANY($${++p})` : '';
  if (cats) params.push(cats);
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const limIdx = ++p; params.push(limit);
  const sql = `
    SELECT ${OFFER_COLS}
    ${OFFER_FROM}
    ${catClause}
    ORDER BY ${city ? cityBoost(city, cityIdx) : ''} ci.created_at DESC
    LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapOfferItem);
}

// ── CREATOR-scoped offer rules ──────────────────────────────────────────────

async function creatorPromotes(ctx) {
  const { influencer, limit = 8, categoryKey } = ctx;
  if (!influencer) return [];
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('creator_promotes', ctx);
  const params = [influencer.id];
  let p = 1;
  const cats = categoryFilter(categoryKey);
  const catClause = cats ? `AND b.category = ANY($${++p})` : '';
  if (cats) params.push(cats);
  const limIdx = ++p; params.push(limit);
  const sql = `
    SELECT ${OFFER_COLS}
    ${OFFER_FROM}
      AND ci.influencer_id = $1
    ${catClause}
    ORDER BY ci.created_at DESC
    LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapOfferItem);
}

async function creatorTopPicks(ctx) {
  const { influencer, limit = 8, categoryKey, windowDays = 30 } = ctx;
  if (!influencer) return [];
  if (offerAdapter.offersV2Enabled()) return offersViaAdapter('creator_top_picks', ctx);
  const params = [influencer.id];
  let p = 1;
  const cats = categoryFilter(categoryKey);
  const catClause = cats ? `AND b.category = ANY($${++p})` : '';
  if (cats) params.push(cats);
  const winIdx = ++p; params.push(windowDays);
  const limIdx = ++p; params.push(limit);
  const sql = `
    SELECT ${OFFER_COLS},
      (SELECT count(*) FROM follower_transactions ft
        WHERE ft.offer_id = co.id
          AND ft.created_at >= now() - ($${winIdx} || ' days')::interval) AS score
    ${OFFER_FROM}
      AND ci.influencer_id = $1
    ${catClause}
    ORDER BY score DESC, ci.created_at DESC
    LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapOfferItem);
}

// ── BRAND rules ─────────────────────────────────────────────────────────────

// Brands ranked by engagement = recent clicks (via offer→brand) + conversions
// (follower_transactions.brand_id direct), among brands with a live offer.
async function topByEngagementBrands(ctx) {
  const { city, limit = 8, windowDays = 30, categoryKey } = ctx;
  const params = [];
  let p = 0;
  const cats = categoryFilter(categoryKey);
  const catIdx = cats ? ++p : null;
  if (cats) params.push(cats);
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const winIdx = ++p; params.push(windowDays);
  const limIdx = ++p; params.push(limit);

  const sql = `
    SELECT b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
           u_b.city AS brand_city,
           (COALESCE(clk.n,0) + COALESCE(cnv.n,0)) AS score
      FROM brands b
      JOIN users u_b ON u_b.id = b.user_id
      LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM link_clicks lc
         JOIN campaign_offers co2 ON co2.id = lc.offer_id
         JOIN campaign_sets   cs2 ON cs2.id = co2.set_id
         JOIN campaigns       c2  ON c2.id  = cs2.campaign_id
         WHERE c2.brand_id = b.id
           AND lc.clicked_at >= now() - ($${winIdx} || ' days')::interval
      ) clk ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM follower_transactions ft
         WHERE ft.brand_id = b.id
           AND ft.created_at >= now() - ($${winIdx} || ' days')::interval
      ) cnv ON true
     WHERE ${liveOfferExists('b.id')}
       ${cats ? `AND b.category = ANY($${catIdx})` : ''}
     ORDER BY ${city ? `CASE WHEN LOWER(u_b.city)=LOWER($${cityIdx}) THEN 0 ELSE 1 END,` : ''}
              (COALESCE(clk.n,0) + COALESCE(cnv.n,0)) DESC, b.business_name ASC
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapBrandItem);
}

// Build a correlated EXISTS that a brand has at least one live offer.
function liveOfferExists(brandRef) {
  return `EXISTS (
        SELECT 1
          FROM campaign_influencers ci
          JOIN campaign_sets cs    ON cs.id = ci.set_id
          JOIN campaigns c         ON c.id  = cs.campaign_id
          JOIN campaign_offers co  ON co.set_id = cs.id AND co.is_active = true
         WHERE c.brand_id = ${brandRef}
           AND ci.status IN ('contracted','active','completed')
           AND c.status  IN ('published','active','live')
           AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
     )`;
}

// Distinct brands a creator partners with (optionally within a category).
async function creatorBrands(ctx) {
  const { influencer, limit = 8, categoryKey } = ctx;
  if (!influencer) return [];
  const params = [influencer.id];
  let p = 1;
  const cats = categoryFilter(categoryKey);
  const catClause = cats ? `AND b.category = ANY($${++p})` : '';
  if (cats) params.push(cats);
  const limIdx = ++p; params.push(limit);
  const sql = `
    SELECT DISTINCT b.id AS brand_id, b.business_name AS brand_name,
           b.category AS brand_category, u_b.city AS brand_city
      FROM campaign_influencers ci
      JOIN campaign_sets cs ON cs.id = ci.set_id
      JOIN campaigns c      ON c.id  = cs.campaign_id
      JOIN brands b         ON b.id  = c.brand_id
      JOIN users  u_b       ON u_b.id = b.user_id
     WHERE ci.influencer_id = $1
       AND ci.status IN ('contracted','active','completed')
       AND c.status  IN ('published','active','live')
       ${catClause}
     ORDER BY b.business_name ASC
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapBrandItem);
}

// ── CREATOR rules ───────────────────────────────────────────────────────────

// Stories = followed creators + active creators near (city), with a live-deal ring.
async function stories(ctx) {
  const { city, followedIds, limit = 12 } = ctx;
  const params = [];
  let p = 0;
  const followArr = followedIds && followedIds.size ? Array.from(followedIds) : [];
  const followIdx = ++p; params.push(followArr);
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const limIdx = ++p; params.push(limit);
  const sql = `
    SELECT i.id AS influencer_id, i.instagram_handle AS handle,
           i.followers_count, i.profile_image_url AS profile_pic_url,
           u_i.name AS influencer_name,
           (i.id = ANY($${followIdx})) AS is_followed,
           EXISTS (${liveOfferExistsForInfluencer('i.id')}) AS has_live_deal
      FROM influencers i
      JOIN users u_i ON u_i.id = i.user_id
     WHERE i.id = ANY($${followIdx})
        OR EXISTS (${liveOfferExistsForInfluencer('i.id')})
     ORDER BY (i.id = ANY($${followIdx})) DESC,
              ${city ? `CASE WHEN LOWER(u_i.city)=LOWER($${cityIdx}) THEN 0 ELSE 1 END,` : ''}
              i.followers_count DESC NULLS LAST
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(r => ({ ...mapCreatorItem(r), is_followed: r.is_followed === true, has_live_deal: r.has_live_deal === true }));
}

function liveOfferExistsForInfluencer(infRef) {
  return `SELECT 1
            FROM campaign_influencers ci
            JOIN campaign_sets cs   ON cs.id = ci.set_id
            JOIN campaigns c        ON c.id  = cs.campaign_id
            JOIN campaign_offers co ON co.set_id = cs.id AND co.is_active = true
           WHERE ci.influencer_id = ${infRef}
             AND ci.status IN ('contracted','active','completed')
             AND c.status  IN ('published','active','live')
             AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)`;
}

// Creators active in a vertical+city, ranked by reach.
async function creatorsInCategory(ctx) {
  const { city, limit = 8, categoryKey } = ctx;
  const cats = categoryFilter(categoryKey);
  const params = [];
  let p = 0;
  const catIdx = cats ? ++p : null;
  if (cats) params.push(cats);
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const limIdx = ++p; params.push(limit);
  const sql = `
    SELECT DISTINCT i.id AS influencer_id, i.instagram_handle AS handle,
           i.followers_count, i.profile_image_url AS profile_pic_url,
           u_i.name AS influencer_name
      FROM influencers i
      JOIN users u_i ON u_i.id = i.user_id
      JOIN campaign_influencers ci ON ci.influencer_id = i.id
      JOIN campaign_sets cs ON cs.id = ci.set_id
      JOIN campaigns c      ON c.id  = cs.campaign_id
      JOIN brands b         ON b.id  = c.brand_id
      JOIN campaign_offers co ON co.set_id = cs.id AND co.is_active = true
     WHERE ci.status IN ('contracted','active','completed')
       AND c.status  IN ('published','active','live')
       ${cats ? `AND b.category = ANY($${catIdx})` : ''}
     ORDER BY i.followers_count DESC NULLS LAST
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapCreatorItem);
}

// ── LISTING-DRIVEN discovery (offer-independent) ─────────────────────────────
// "What you list is what you see": an approved business + its products + the
// creators who picked them are discoverable BY CATEGORY without any campaign or
// offer. Offers remain an overlay (deals shelves, discount badges), not a gate.

function mapListedProductItem(r) {
  return {
    entity_type: 'product',
    id: r.id,
    name: r.name,
    price: r.price != null ? parseFloat(r.price) : null,
    image_url: r.image_url,
    section: r.section,
    veg_flag: r.veg_flag,
    description: r.description,
    discount_value: null,           // no offer in listing-driven mode
    distance_km: r.dist_km != null ? Math.round(Number(r.dist_km) * 10) / 10 : null,
    brand: { id: r.brand_id, name: r.brand_name, category: r.brand_category, city: r.brand_city },
    via_creator: null,
    tracking: null,
  };
}

// Approved brands in a category that have a live menu. No offer required.
async function businessesInCategory(ctx) {
  const { city, limit = 8, categoryKey } = ctx;
  const geo = hasCoords(ctx);
  const cats = categoryFilter(categoryKey);
  const params = [];
  let p = 0;
  const catIdx = cats ? ++p : null;
  if (cats) params.push(cats);
  // city soft-boost only when NOT distance-ranking
  const cityIdx = (city && !geo) ? ++p : null;
  if (city && !geo) params.push(city);
  let latIdx, lngIdx;
  if (geo) { latIdx = ++p; params.push(ctx.lat); lngIdx = ++p; params.push(ctx.lng); }
  const limIdx = ++p; params.push(limit);

  const distExpr = geo
    ? `CASE WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN ${haversineKm(latIdx, lngIdx)} END`
    : `NULL::numeric`;
  const orderBy = geo
    ? `dist_km ASC NULLS LAST, score DESC, b.business_name ASC`
    : `${cityBoost(city, cityIdx)} score DESC, b.business_name ASC`;

  const sql = `
    SELECT b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
           u_b.city AS brand_city,
           ${distExpr} AS dist_km,
           (SELECT COUNT(*) FROM follower_transactions ft
              WHERE ft.brand_id = b.id AND ft.created_at >= now() - interval '30 days')::int AS score
      FROM brands b
      JOIN users u_b ON u_b.id = b.user_id
     WHERE u_b.status = 'approved'
       AND EXISTS (SELECT 1 FROM brand_products bp WHERE bp.brand_id = b.id AND bp.is_active = true)
       ${cats ? `AND b.category = ANY($${catIdx})` : ''}
     ORDER BY ${orderBy}
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapBrandItem);
}

// Active products from approved brands in a category. No offer required.
async function productsInCategory(ctx) {
  const { city, limit = 8, categoryKey } = ctx;
  const geo = hasCoords(ctx);
  const cats = categoryFilter(categoryKey);
  const params = [];
  let p = 0;
  const catIdx = cats ? ++p : null;
  if (cats) params.push(cats);
  const cityIdx = (city && !geo) ? ++p : null;
  if (city && !geo) params.push(city);
  let latIdx, lngIdx;
  if (geo) { latIdx = ++p; params.push(ctx.lat); lngIdx = ++p; params.push(ctx.lng); }
  const limIdx = ++p; params.push(limit);

  const distExpr = geo
    ? `CASE WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN ${haversineKm(latIdx, lngIdx)} END`
    : `NULL::numeric`;
  const orderBy = geo
    ? `dist_km ASC NULLS LAST, bp.created_at DESC NULLS LAST`
    : `${cityBoost(city, cityIdx)} bp.created_at DESC NULLS LAST`;

  const sql = `
    SELECT bp.id, bp.name, bp.price, bp.image_url, bp.section, bp.veg_flag, bp.description,
           bp.created_at,
           b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
           u_b.city AS brand_city,
           ${distExpr} AS dist_km
      FROM brand_products bp
      JOIN brands b   ON b.id = bp.brand_id
      JOIN users u_b  ON u_b.id = b.user_id
     WHERE u_b.status = 'approved' AND bp.is_active = true
       ${cats ? `AND b.category = ANY($${catIdx})` : ''}
     ORDER BY ${orderBy}
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapListedProductItem);
}

// Creators who PICKED products (influencer_product_notes) in a category. No live
// offer required — picks express what a creator promotes regardless of campaigns.
async function creatorsInCategoryListing(ctx) {
  const { limit = 8, categoryKey } = ctx;
  const cats = categoryFilter(categoryKey);
  const params = [];
  let p = 0;
  const catIdx = cats ? ++p : null;
  if (cats) params.push(cats);
  const limIdx = ++p; params.push(limit);
  const sql = `
    SELECT DISTINCT i.id AS influencer_id, i.instagram_handle AS handle,
           i.followers_count, i.profile_image_url AS profile_pic_url, u_i.name AS influencer_name
      FROM influencers i
      JOIN users u_i ON u_i.id = i.user_id
      JOIN influencer_product_notes ipn ON ipn.influencer_id = i.id
      JOIN brand_products bp ON bp.id = ipn.product_id AND bp.is_active = true
      JOIN brands b  ON b.id = bp.brand_id
      JOIN users u_b ON u_b.id = b.user_id
     WHERE u_b.status = 'approved'
       ${cats ? `AND b.category = ANY($${catIdx})` : ''}
     ORDER BY i.followers_count DESC NULLS LAST
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapCreatorItem);
}

// Home "Stories" — listing/activity-driven (offer-independent). A creator shows
// when: the follower follows them, OR they have a live offer, OR they have picks
// (influencer_product_notes) on active products of approved brands. has_live_deal
// drives the ● LIVE ring; followers_count shows otherwise. This is the offer-
// independent twin of `stories` (which was offer/follow-gated → empty when there
// are no campaign_offers, e.g. set-level offer intent not yet materialized).
async function creatorsListing(ctx) {
  const { city, followedIds, limit = 12 } = ctx;
  const params = [];
  let p = 0;
  const followArr = followedIds && followedIds.size ? Array.from(followedIds) : [];
  const followIdx = ++p; params.push(followArr);
  const cityIdx = city ? ++p : null;
  if (city) params.push(city);
  const limIdx = ++p; params.push(limit);
  const picksExists = `
    SELECT 1 FROM influencer_product_notes ipn
      JOIN brand_products bp ON bp.id = ipn.product_id AND bp.is_active = true
      JOIN brands b  ON b.id = bp.brand_id
      JOIN users ub  ON ub.id = b.user_id
     WHERE ipn.influencer_id = i.id AND ub.status = 'approved'`;
  const sql = `
    SELECT i.id AS influencer_id, i.instagram_handle AS handle,
           i.followers_count, i.profile_image_url AS profile_pic_url,
           u_i.name AS influencer_name,
           (i.id = ANY($${followIdx})) AS is_followed,
           EXISTS (${liveOfferExistsForInfluencer('i.id')}) AS has_live_deal
      FROM influencers i
      JOIN users u_i ON u_i.id = i.user_id
     WHERE i.id = ANY($${followIdx})
        OR EXISTS (${liveOfferExistsForInfluencer('i.id')})
        OR EXISTS (${picksExists})
     ORDER BY (i.id = ANY($${followIdx})) DESC,
              ${city ? `CASE WHEN LOWER(u_i.city)=LOWER($${cityIdx}) THEN 0 ELSE 1 END,` : ''}
              i.followers_count DESC NULLS LAST
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(r => ({ ...mapCreatorItem(r), is_followed: r.is_followed === true, has_live_deal: r.has_live_deal === true }));
}

// ── nav / static / disabled ─────────────────────────────────────────────────

async function navVerticals(ctx) {
  // Nav tiles are configuration, not queried data — sourced from config_json.
  const verticals = ctx.config && Array.isArray(ctx.config.verticals) ? ctx.config.verticals : [];
  return verticals.slice(0, ctx.limit || verticals.length).map(v => ({
    entity_type: 'nav', key: v.key, label: v.label, icon: v.icon || null,
  }));
}

// Controls/chips/headers/profile/bio carry their payload in config_json; the
// engine passes config through and these contribute no data items.
async function staticRule() { return []; }

// Product-level sales is not attributable in Phase A (see file header).
async function topBySales() { return []; }

// ── registry ────────────────────────────────────────────────────────────────

const RULES = {
  // offers
  top_by_engagement: (ctx) => ctx.itemType === 'brands' ? topByEngagementBrands(ctx) : topByEngagementOffers(ctx),
  top_by_conversions: topByConversionsOffers,
  top_picks: topPicks,
  newest,
  follow_graph: followGraph,
  biggest_discounts: biggestDiscounts,
  ending_soon: endingSoon,
  all_offers: allOffers,
  creator_promotes: creatorPromotes,
  creator_top_picks: creatorTopPicks,
  // brands
  creator_brands: creatorBrands,
  // creators
  stories,
  creators_listing: creatorsListing,
  creators_in_category: creatorsInCategory,
  // listing-driven discovery (offer-independent)
  businesses_in_category: businessesInCategory,
  products_in_category: productsInCategory,
  creators_in_category_listing: creatorsInCategoryListing,
  // nav / static / disabled
  nav_verticals: navVerticals,
  static: staticRule,
  top_by_sales: topBySales,
};

/**
 * Run a rule by key. Unknown rule → [] (graceful; logged) so a stray config row
 * never 500s a feed.
 */
async function runRule(ruleKey, ctx) {
  const fn = RULES[ruleKey];
  if (!fn) {
    console.warn(`[sectionRules] unknown rule '${ruleKey}' — returning empty`);
    return [];
  }
  return fn(ctx);
}

module.exports = { runRule, RULES, CATEGORY_MAP, buildTracking };
