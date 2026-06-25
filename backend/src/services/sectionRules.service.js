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
const categoryTaxonomy = require('./categoryTaxonomy.service');
const sectionLibrary = require('./sectionLibrary.service');

// OR cutover (contract: listing-section-d0-seams / section-offer-repoint): when
// SECTION_ENGINE_OFFERS is ON, offer shelves read the brandOffers.adapter (offers
// from the creator assignment + engagement showcase + store-direct) instead of the
// legacy campaign_offers SQL below. OFF (default) = unchanged legacy behaviour.
async function offersViaAdapter(ruleKey, ctx) {
  const items = await offerAdapter.fetchOffers({ limit: 200 });
  return offerAdapter.rankForRule(ruleKey, items, {
    categoryKeys: categoryFilter(ctx),
    followedIds: ctx.followedIds,
    influencerId: ctx.influencer && ctx.influencer.id,
    limit: ctx.limit || 8,
  });
}

// Category → brand.category linkage now lives in ONE place: categoryTaxonomy.service
// (backed by the admin follower_categories table). The old hardcoded CATEGORY_MAP here
// was one of five conflicting sources — removed in contract 2.5a. See categoryFilter.

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

// Resolve a category key → the list of brand.category values it covers, from the
// SINGLE source (categoryTaxonomy.service / the admin follower_categories table).
// The engine pre-resolves and injects ctx.categoryCats; if that's absent we read the
// taxonomy's warm in-memory cache synchronously (the engine warms it before any rule
// runs). null → no category filter. The old hardcoded CATEGORY_MAP fallback is gone:
// it was keyed (dining/shopping/...) inconsistently with the table (eat/shop/...), so
// unmatched keys silently became "no filter" and every business leaked into a tile.
function categoryFilter(ctx) {
  const fromDb = ctx && Array.isArray(ctx.categoryCats) ? ctx.categoryCats : null;
  if (fromDb && fromDb.length) return fromDb;
  const key = ctx && ctx.categoryKey;
  const sync = key ? categoryTaxonomy.membersForSync(key) : null;
  return sync && sync.length ? sync : null;
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
  const cats = categoryFilter(ctx);
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
  const cats = categoryFilter(ctx);
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
  const cats = categoryFilter(ctx);
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
  const cats = categoryFilter(ctx);
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
  const cats = categoryFilter(ctx);
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
  const cats = categoryFilter(ctx);
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
  const cats = categoryFilter(ctx);
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
  const cats = categoryFilter(ctx);
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

// Food World 3C-1 — delivery ETA is DISTANCE-derived, not restaurant-set
// (founder 2026-06-22). ~10 min prep + 2 min/km, rounded to a 5-min low with a
// +5 window (e.g. 2.0 km → 20-25, 3.4 km → 25-30). km null → no ETA. Tunable.
function etaFromDistanceKm(km) {
  const n = Number(km);
  if (km == null || !Number.isFinite(n)) return { min: null, max: null };
  const PREP = 10, PER_KM = 2, WINDOW = 5;
  const min = Math.max(5, Math.round((PREP + n * PER_KM) / 5) * 5);
  return { min, max: min + WINDOW };
}

function mapListedProductItem(r) {
  const eta = etaFromDistanceKm(r.dist_km);
  return {
    entity_type: 'product',
    id: r.id,
    name: r.name,
    price: r.price != null ? parseFloat(r.price) : null,
    // Food World 3C-1 — per-dish MRP for the struck "was" price (mig 118). Card
    // shows MRP→price only when mrp > price. Display-only (never order pricing).
    mrp: r.mrp != null ? parseFloat(r.mrp) : null,
    image_url: r.image_url,
    section: r.section,
    veg_flag: r.veg_flag,
    description: r.description,
    discount_value: null,           // no offer in listing-driven mode
    // Food World P1 — dish-card enrichment. rating/review_count are BRAND-level
    // (restaurant_reviews has no product_id); the card shows the restaurant's
    // score. badge is owner-set. has_addons tells the card whether ＋ opens the
    // customise popup vs a flat add.
    rating: r.rating != null ? Number(r.rating) : null,
    review_count: r.review_count != null ? Number(r.review_count) : 0,
    badge: r.badge || null,
    has_addons: r.has_addons === true,
    distance_km: r.dist_km != null ? Math.round(Number(r.dist_km) * 10) / 10 : null,
    // ETA computed from distance (3C-1); null when no geo.
    eta_min: eta.min,
    eta_max: eta.max,
    brand: { id: r.brand_id, name: r.brand_name, category: r.brand_category, city: r.brand_city },
    via_creator: null,
    tracking: null,
  };
}

// Approved brands in a category that have a live menu. No offer required.
async function businessesInCategory(ctx) {
  const { city, limit = 8, categoryKey } = ctx;
  const geo = hasCoords(ctx);
  const cats = categoryFilter(ctx);
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
       AND EXISTS (SELECT 1 FROM brand_products bp WHERE bp.brand_id = b.id AND bp.is_active = true AND bp.pushed_to_store = true)
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
  const cats = categoryFilter(ctx);
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
    SELECT bp.id, bp.name, bp.price, bp.mrp, bp.image_url, bp.section, bp.veg_flag, bp.description,
           bp.created_at, bp.badge,
           b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
           u_b.city AS brand_city,
           rev.rating, rev.review_count,
           EXISTS (SELECT 1 FROM product_addon_groups g WHERE g.product_id = bp.id) AS has_addons,
           ${distExpr} AS dist_km
      FROM brand_products bp
      JOIN brands b   ON b.id = bp.brand_id
      JOIN users u_b  ON u_b.id = b.user_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(rr.rating)::numeric, 1) AS rating, COUNT(*)::int AS review_count
          FROM restaurant_reviews rr
         WHERE rr.brand_id = b.id AND rr.status = 'published'
      ) rev ON true
     WHERE u_b.status = 'approved' AND bp.is_active = true AND bp.pushed_to_store = true
       ${cats ? `AND b.category = ANY($${catIdx})` : ''}
     ORDER BY ${orderBy}
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapListedProductItem);
}

// ── DATA-DRIVEN section (Phase 3a) ───────────────────────────────────────────
// library_products = productsInCategory generalised with a rule definition
// (sub-category subtree + tags + price + sort), with SURFACE CONTEXT stacked
// (Layer 6): creator allocation, brand scope, category, city/geo. The rule def
// is injected by the engine as ctx.ruleDef (from the placed section's library row).
// Gate: pushed_to_store on platform/brand surfaces; LIVE ALLOCATION on a creator
// surface (matches 2a/2b/2c — allocation is the creator-store gate, not push).
async function libraryProducts(ctx) {
  const def = (ctx.ruleDef && typeof ctx.ruleDef === 'object') ? ctx.ruleDef : {};
  const { city, limit = 8 } = ctx;
  const geo = hasCoords(ctx);
  const cats = categoryFilter(ctx);                       // business → brand.category members
  const creatorScoped = !!(ctx.influencer && ctx.influencer.id);

  const params = [];
  let p = 0;
  const catIdx = cats ? ++p : null; if (cats) params.push(cats);

  let subIdx = null;
  if (def.subcategory_node_id) { subIdx = ++p; params.push(def.subcategory_node_id); }

  let tagsIdx = null;
  if (Array.isArray(def.tags) && def.tags.length) { tagsIdx = ++p; params.push(def.tags); }

  let minIdx = null, maxIdx = null;
  if (def.price_min != null) { minIdx = ++p; params.push(def.price_min); }
  if (def.price_max != null) { maxIdx = ++p; params.push(def.price_max); }

  // creator surface → intersect with this creator's LIVE-allocated products (2b)
  let allocIdx = null;
  if (creatorScoped) {
    const allocIds = await sectionLibrary.creatorAllocatedProductIds(ctx.influencer.id);
    if (!allocIds.length) return [];                      // creator promotes nothing live → empty
    allocIdx = ++p; params.push(allocIds);
  }

  // brand surface → constrain to that brand
  let brandIdx = null;
  if (ctx.brandId) { brandIdx = ++p; params.push(ctx.brandId); }

  // offer/discount filters (Phase 3d) — live published-to-store offers
  let minDiscIdx = null;
  if (def.min_discount_pct != null) { minDiscIdx = ++p; params.push(def.min_discount_pct); }

  const cityIdx = (city && !geo) ? ++p : null; if (city && !geo) params.push(city);
  let latIdx, lngIdx;
  if (geo) { latIdx = ++p; params.push(ctx.lat); lngIdx = ++p; params.push(ctx.lng); }
  const limIdx = ++p; params.push(limit);

  const distExpr = geo
    ? `CASE WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN ${haversineKm(latIdx, lngIdx)} END`
    : `NULL::numeric`;
  const sortKey = def.sort === 'price_asc' ? 'bp.price ASC NULLS LAST'
    : def.sort === 'price_desc' ? 'bp.price DESC NULLS LAST'
    : 'bp.created_at DESC NULLS LAST';
  const orderBy = geo
    ? `dist_km ASC NULLS LAST, ${sortKey}`
    : `${cityBoost(city, cityIdx)} ${sortKey}`;

  // sub-category match = the node OR any descendant (recursive walk of category_nodes).
  const subClause = subIdx ? `AND bp.category_node_id IN (
        WITH RECURSIVE sub AS (
          SELECT id FROM category_nodes WHERE id = $${subIdx}
          UNION ALL
          SELECT cn.id FROM category_nodes cn JOIN sub ON cn.parent_id = sub.id
        ) SELECT id FROM sub)` : '';

  // Offer/discount filters (Phase 3d): correlated EXISTS over live, published-to-store
  // brand_offers that APPLY to the product. Effective scope = config.scope, else
  // products-present ? 'products' : 'store'. store-wide & category offers apply broadly.
  const offerLiveGate = `bo.brand_id = b.id AND bo.status = 'active' AND bo.published_to_store = true
        AND (bo.store_starts_at IS NULL OR bo.store_starts_at <= now())
        AND (bo.store_ends_at IS NULL OR bo.store_ends_at >= now())`;
  const effScope = `COALESCE(bo.offer_config_json->>'scope',
        CASE WHEN jsonb_typeof(bo.offer_config_json->'products') = 'array'
               AND jsonb_array_length(bo.offer_config_json->'products') > 0 THEN 'products' ELSE 'store' END)`;
  const offerApplies = `(
        ${effScope} = 'store'
        OR (${effScope} = 'category' AND bp.section IS NOT DISTINCT FROM bo.offer_config_json->>'category')
        OR (${effScope} = 'products' AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(bo.offer_config_json->'products', '[]'::jsonb)) e
               WHERE e->>'id' = bp.id::text)))`;
  const numVal = `CASE WHEN bo.offer_config_json->>'value' ~ '^[0-9]+(\\.[0-9]+)?$'
        THEN (bo.offer_config_json->>'value')::numeric ELSE NULL END`;
  const discPct = `(CASE WHEN bo.offer_config_json->>'sub_type' = 'pct' THEN ${numVal}
        WHEN bo.offer_config_json->>'sub_type' = 'flat' AND bp.price > 0 THEN ${numVal} / bp.price * 100
        ELSE NULL END)`;
  const hasOfferClause = def.has_offer
    ? `AND EXISTS (SELECT 1 FROM brand_offers bo WHERE ${offerLiveGate} AND ${offerApplies})` : '';
  const minDiscClause = minDiscIdx
    ? `AND EXISTS (SELECT 1 FROM brand_offers bo WHERE ${offerLiveGate}
          AND bo.offer_type = 'discount' AND ${offerApplies} AND ${discPct} >= $${minDiscIdx})` : '';

  const sql = `
    SELECT bp.id, bp.name, bp.price, bp.mrp, bp.image_url, bp.section, bp.veg_flag, bp.description,
           bp.created_at, bp.badge,
           b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
           u_b.city AS brand_city,
           rev.rating, rev.review_count,
           EXISTS (SELECT 1 FROM product_addon_groups g WHERE g.product_id = bp.id) AS has_addons,
           ${distExpr} AS dist_km
      FROM brand_products bp
      JOIN brands b   ON b.id = bp.brand_id
      JOIN users u_b  ON u_b.id = b.user_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(rr.rating)::numeric, 1) AS rating, COUNT(*)::int AS review_count
          FROM restaurant_reviews rr
         WHERE rr.brand_id = b.id AND rr.status = 'published'
      ) rev ON true
     WHERE u_b.status = 'approved' AND bp.is_active = true
       ${creatorScoped ? '' : 'AND bp.pushed_to_store = true'}
       ${cats ? `AND b.category = ANY($${catIdx})` : ''}
       ${subClause}
       ${tagsIdx ? `AND bp.tags @> $${tagsIdx}` : ''}
       ${minIdx ? `AND bp.price >= $${minIdx}` : ''}
       ${maxIdx ? `AND bp.price <= $${maxIdx}` : ''}
       ${allocIdx ? `AND bp.id = ANY($${allocIdx})` : ''}
       ${brandIdx ? `AND b.id = $${brandIdx}` : ''}
       ${hasOfferClause}
       ${minDiscClause}
     ORDER BY ${orderBy}
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(mapListedProductItem);
}

// ── Type B (Food 3C-1): restaurant-list section ─────────────────────────────
// One item PER restaurant: a brand header (rating / distance-ETA / cuisine /
// free-delivery) + a NESTED `products` array of that restaurant's FEATURED
// dishes (is_featured by featured_sort; fallback = first N in-stock by recency).
// Restaurants with no displayable dish are omitted. Category-scoped (restaurant
// by default). The mobile renderer draws the header card + a nested dish rail.
async function restaurantsWithFeatured(ctx) {
  const { city, limit = 8 } = ctx;
  const geo = hasCoords(ctx);
  const cats = categoryFilter(ctx);
  const perRestaurant = Math.min(Math.max(parseInt(ctx.featuredPerRestaurant, 10) || 8, 1), 12);

  const params = [];
  let p = 0;
  const catIdx = cats ? ++p : null; if (cats) params.push(cats);
  const cityIdx = (city && !geo) ? ++p : null; if (city && !geo) params.push(city);
  let latIdx, lngIdx;
  if (geo) { latIdx = ++p; params.push(ctx.lat); lngIdx = ++p; params.push(ctx.lng); }
  const limIdx = ++p; params.push(limit);

  const distExpr = geo
    ? `CASE WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN ${haversineKm(latIdx, lngIdx)} END`
    : `NULL::numeric`;
  const orderBy = geo
    ? `dist_km ASC NULLS LAST, score DESC, b.business_name ASC`
    : `${cityBoost(city, cityIdx)} score DESC, b.business_name ASC`;

  const brandSql = `
    SELECT b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
           u_b.city AS brand_city, b.listing_data,
           ${distExpr} AS dist_km,
           rev.rating, rev.review_count,
           (SELECT COUNT(*) FROM follower_transactions ft
              WHERE ft.brand_id = b.id AND ft.created_at >= now() - interval '30 days')::int AS score
      FROM brands b
      JOIN users u_b ON u_b.id = b.user_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(rr.rating)::numeric, 1) AS rating, COUNT(*)::int AS review_count
          FROM restaurant_reviews rr
         WHERE rr.brand_id = b.id AND rr.status = 'published'
      ) rev ON true
     WHERE u_b.status = 'approved'
       AND ${cats ? `b.category = ANY($${catIdx})` : `b.category = 'restaurant'`}
       AND EXISTS (SELECT 1 FROM brand_products bp
                    WHERE bp.brand_id = b.id AND bp.is_active = true AND bp.pushed_to_store = true)
     ORDER BY ${orderBy}
     LIMIT $${limIdx}`;
  const { rows: brands } = await db.query(brandSql, params);
  if (!brands.length) return [];

  const brandIds = brands.map(b => b.brand_id);
  // Featured dishes per brand, windowed to perRestaurant: is_featured first
  // (by featured_sort), then newest as the fallback fill.
  const { rows: prods } = await db.query(
    `SELECT id, name, price, mrp, image_url, section, veg_flag, description, badge, brand_id, has_addons
       FROM (
        SELECT bp.id, bp.name, bp.price, bp.mrp, bp.image_url, bp.section, bp.veg_flag,
               bp.description, bp.badge, bp.brand_id,
               EXISTS (SELECT 1 FROM product_addon_groups g WHERE g.product_id = bp.id) AS has_addons,
               ROW_NUMBER() OVER (
                 PARTITION BY bp.brand_id
                 ORDER BY bp.is_featured DESC, bp.featured_sort ASC, bp.created_at DESC
               ) AS rn
          FROM brand_products bp
         WHERE bp.brand_id = ANY($1::uuid[]) AND bp.is_active = true AND bp.pushed_to_store = true
       ) q WHERE q.rn <= $2`,
    [brandIds, perRestaurant]
  );

  const byBrand = {};
  for (const r of prods) {
    (byBrand[r.brand_id] = byBrand[r.brand_id] || []).push({
      entity_type: 'product',
      id: r.id,
      name: r.name,
      price: r.price != null ? parseFloat(r.price) : null,
      mrp: r.mrp != null ? parseFloat(r.mrp) : null,
      image_url: r.image_url,
      section: r.section,
      veg_flag: r.veg_flag,
      description: r.description,
      badge: r.badge || null,
      has_addons: r.has_addons === true,
      discount_value: null,
      via_creator: null,
      tracking: null,
    });
  }

  return brands.map((b) => {
    const products = byBrand[b.brand_id] || [];
    if (!products.length) return null;
    const ld = b.listing_data || {};
    const eta = etaFromDistanceKm(b.dist_km);
    const brandRef = { id: b.brand_id, name: b.brand_name, category: b.brand_category, city: b.brand_city };
    // Nested cards need the brand ref for nav + ETA mirrors the restaurant's.
    products.forEach((pr) => { pr.brand = brandRef; pr.eta_min = eta.min; pr.eta_max = eta.max; });
    return {
      entity_type: 'brand',
      id: b.brand_id,
      name: b.brand_name,
      category: b.brand_category,
      city: b.brand_city,
      rating: b.rating != null ? Number(b.rating) : null,
      review_count: b.review_count != null ? Number(b.review_count) : 0,
      distance_km: b.dist_km != null ? Math.round(Number(b.dist_km) * 10) / 10 : null,
      cuisines: Array.isArray(ld.cuisines) ? ld.cuisines : [],
      free_delivery: ld.free_delivery === true,
      eta_min: eta.min,
      eta_max: eta.max,
      products,
    };
  }).filter(Boolean);
}

// Creators who PICKED products (influencer_product_notes) in a category. No live
// offer required — picks express what a creator promotes regardless of campaigns.
async function creatorsInCategoryListing(ctx) {
  const { limit = 8, categoryKey } = ctx;
  const cats = categoryFilter(ctx);
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

// Smart creator carousel (App Builder Phase 3) — ONE context-aware creator rule.
//  • promotes THIS world: has product picks OR active collaborations with brands
//    in the placement's vertical (categoryFilter / ctx.vertical).
//  • near the VIEWER: nearest such business to ctx.lat/lng (creators have no own
//    geo — they ride their businesses' locations). Distance is a sort, not a gate.
//  • active: has a recent collaboration (campaign_influencers).
//  • famous: followers_count.   • followed: ctx.followedIds.
//  • BUSINESS scope (ctx.brandId set): ONLY creators collaborating with THAT brand.
// Order: followed first (personalization), then strong un-followed (near · active ·
// famous) — to nudge the follower to follow more creators → more deals.
async function creatorsSmart(ctx) {
  const { limit = 12, followedIds, lat, lng, brandId } = ctx;
  let cats = brandId ? null : categoryFilter(ctx);
  if (!cats && !brandId && ctx.vertical) {
    const m = categoryTaxonomy.membersForSync(ctx.vertical);
    cats = m && m.length ? m : null;
  }
  const params = [];
  let p = 0;
  const followArr = followedIds && followedIds.size ? Array.from(followedIds) : [];
  const followIdx = ++p; params.push(followArr);
  const catIdx = cats ? ++p : null; if (cats) params.push(cats);
  const brandIdx = brandId ? ++p : null; if (brandId) params.push(brandId);
  const hasGeo = lat != null && lng != null;
  let latIdx = null, lngIdx = null;
  if (hasGeo) { latIdx = ++p; params.push(lat); lngIdx = ++p; params.push(lng); }
  const limIdx = ++p; params.push(limit);

  const brandWhere = `ub.status = 'approved'`
    + (cats ? ` AND b.category = ANY($${catIdx})` : '')
    + (brandId ? ` AND b.id = $${brandIdx}` : '');
  const distSel = hasGeo
    ? `CASE WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN ${haversineKm(latIdx, lngIdx)} END`
    : 'NULL::numeric';

  const sql = `
    WITH rel AS (
      SELECT ci.influencer_id, ${distSel} AS dist, ci.created_at AS collab_at, true AS is_collab
        FROM campaign_influencers ci
        JOIN campaign_sets cs ON cs.id = ci.set_id
        JOIN campaigns c      ON c.id  = cs.campaign_id
        JOIN brands b         ON b.id  = c.brand_id
        JOIN users ub         ON ub.id = b.user_id
       WHERE ci.status IN ('contracted','active','completed') AND ${brandWhere}
      UNION ALL
      SELECT ipn.influencer_id, ${distSel} AS dist, NULL::timestamptz AS collab_at, false AS is_collab
        FROM influencer_product_notes ipn
        JOIN brand_products bp ON bp.id = ipn.product_id AND bp.is_active = true
        JOIN brands b          ON b.id  = bp.brand_id
        JOIN users ub          ON ub.id = b.user_id
       WHERE ${brandWhere}
    )
    SELECT i.id AS influencer_id, i.instagram_handle AS handle, i.followers_count,
           i.profile_image_url AS profile_pic_url, u_i.name AS influencer_name,
           (i.id = ANY($${followIdx})) AS is_followed,
           max(rel.collab_at) AS last_collab_at,
           min(rel.dist) AS dist_km
      FROM rel
      JOIN influencers i ON i.id = rel.influencer_id
      JOIN users u_i     ON u_i.id = i.user_id
     GROUP BY i.id, i.instagram_handle, i.followers_count, i.profile_image_url, u_i.name
     ORDER BY (i.id = ANY($${followIdx})) DESC,
              ${hasGeo ? 'min(rel.dist) ASC NULLS LAST,' : ''}
              (max(rel.collab_at) IS NOT NULL) DESC,
              i.followers_count DESC NULLS LAST
     LIMIT $${limIdx}`;
  const { rows } = await db.query(sql, params);
  return rows.map(r => ({
    ...mapCreatorItem(r),
    is_followed: r.is_followed === true,
    distance_km: r.dist_km != null ? Math.round(Number(r.dist_km) * 10) / 10 : undefined,
  }));
}

// ── nav / static / disabled ─────────────────────────────────────────────────

async function navVerticals(ctx) {
  // Home "Browse by Category" tiles. Prefer the admin-managed follower_categories
  // table (Phase 1b) so the tiles stay in sync with the Categories screen + admin
  // edits AND share the same keys (eat/shop/...) the category endpoint expects.
  // Fall back to the legacy config_json.verticals if the table is empty/unreachable.
  try {
    const { rows } = await db.query(
      `SELECT key, label, icon FROM follower_categories
        WHERE status = 'active' ORDER BY sort_order ASC, label ASC`
    );
    if (rows.length) {
      return rows.slice(0, ctx.limit || rows.length).map(v => ({
        entity_type: 'nav', key: v.key, label: v.label, icon: v.icon || null,
      }));
    }
  } catch (e) {
    console.error('[sections] navVerticals follower_categories read failed — config fallback:', e.message);
  }
  const verticals = ctx.config && Array.isArray(ctx.config.verticals) ? ctx.config.verticals : [];
  return verticals.slice(0, ctx.limit || verticals.length).map(v => ({
    entity_type: 'nav', key: v.key, label: v.label, icon: v.icon || null,
  }));
}

// Category rail (Food 3C / discovery) — the world's sub-category tiles
// (follower_vertical_categories, Home Builder). Lets admin PLACE the craving
// rail as a section in any world's stack (shelf_type 'category_rail'), and mark
// it sticky. ctx.categoryKey = the world (vertical) being viewed.
async function worldCategories(ctx) {
  const vk = ctx.categoryKey;
  if (!vk) return [];
  const { rows } = await db.query(
    `SELECT key, name, icon, image_url FROM follower_vertical_categories
      WHERE vertical_key = $1 AND enabled = true ORDER BY sort_order, name`,
    [vk]
  );
  return rows.map(r => ({
    entity_type: 'category', key: r.key, name: r.name, icon: r.icon || null, image_url: r.image_url || null,
  }));
}

// Controls/chips/headers/profile/bio carry their payload in config_json; the
// engine passes config through and these contribute no data items.
async function staticRule() { return []; }


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
  creators_smart: creatorsSmart,   // App Builder Phase 3 — context-aware creator carousel

  // listing-driven discovery (offer-independent)
  businesses_in_category: businessesInCategory,
  products_in_category: productsInCategory,
  library_products: libraryProducts,
  restaurants_with_featured: restaurantsWithFeatured,   // Food 3C-1 Type B
  creators_in_category_listing: creatorsInCategoryListing,
  // nav / static / disabled
  nav_verticals: navVerticals,
  world_categories: worldCategories,   // Food 3C — placeable category rail
  static: staticRule,
  // Deprecated: product-level sales isn't attributable; alias to the working
  // product rule so any legacy 'top_by_sales' row renders instead of empty.
  top_by_sales: productsInCategory,
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

module.exports = { runRule, RULES, buildTracking, etaFromDistanceKm };
