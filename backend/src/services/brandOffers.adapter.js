'use strict';

/**
 * brandOffers.adapter.js — D0 Workstream B (contract: features/listing-section-d0-seams).
 *
 * THE PROBLEM (re-diagnosed after code review, 2026-06-09)
 *   The section offer shelves INNER-JOIN `campaign_offers` — a table the modern
 *   offer flow no longer populates (campaign.controller.js marks the writer
 *   "legacy — kept for backward compat"). The REAL offers live on the creator's
 *   assignment row, `campaign_influencers`:
 *     · offer_type + offer_config_json   = the per-creator SNAPSHOT taken at attach
 *       time (library is authoritative AT attach; later library edits never mutate a
 *       live attachment → we must read the SNAPSHOT, not the library master).
 *     · allocation                       = 'commissioned' (conversion → tracked,
 *       creator earns) | 'promotional' (engagement → showcase only, no commission).
 *     · brand_offer_id                   = provenance to the Offer-Zone library
 *       (single attach); used only for the offer NAME / availing_modes enrichment.
 *     · promoted_brand_offer_ids[]       = engagement multi-select showcase (library
 *       refs, no per-item snapshot → read the library config for these).
 *   Separately, brand-direct deals live on `brand_offers.published_to_store` (no
 *   creator). The old follower feed already reads the assignment correctly (LEFT
 *   JOIN campaign_offers + ci-snapshot fallback) — this adapter mirrors that proven
 *   read for the section engine.
 *
 * NORMALIZED SHAPE (one row, source-agnostic)
 *   {
 *     id, source:'assignment'|'showcase'|'store', channel:'conversion'|'engagement'|'store',
 *     brand: { id, name, category, city },
 *     name, offer_type,                 // offer_type normalized to the LEGACY display vocab
 *     discount: { kind, value, label }, // structured; kind ∈ pct|flat|volume|bogo|bundle|free_gift|prebook|null
 *     discount_value,                   // numeric for biggest_discounts ordering + badge
 *     availing_modes, offer_expires_at,
 *     via_creator: { id, handle, name, avatar } | null,
 *     tracking: { cid, sid, oid, iid, url } | null,  // present ONLY for conversion
 *   }
 *
 * GATING: the rules consume this only when SECTION_ENGINE_OFFERS is ON (the OR
 *   contract flips it). With it OFF, rules keep their current SQL → shelves behave
 *   exactly as today. This adapter is additive + currently UNCONSUMED → deploy-inert.
 *
 * The PURE normalizers below carry the bug-prone logic and are unit-tested with no
 * DB. The channel SQL is validated at OR-time against real prod data.
 */

const db = require('../config/db');
const env = require('../config/env');
const { buildTracking } = require('../utils/tracking');

// Two offer-type vocabularies coexist on campaign_influencers.offer_type:
//   library vocab (snapshotted from brand_offers): discount|volume|bogo|bundle|free_gift
//   legacy inline vocab (campaign wizard):          flat|percentage|bogo|bundle|volume|prebook
const LIBRARY_TYPES = new Set(['discount', 'volume', 'bogo', 'bundle', 'free_gift']);
const LEGACY_TYPES = new Set(['flat', 'percentage', 'bogo', 'bundle', 'volume', 'prebook']);

// ── flag ──────────────────────────────────────────────────────────────────────
function offersV2Enabled() {
  if (process.env.SECTION_ENGINE_OFFERS != null) return process.env.SECTION_ENGINE_OFFERS === 'true';
  return env.SECTION_ENGINE_OFFERS === true;
}

// ── PURE: library offer_type → legacy display vocab the mobile cards interpret ────
function mapBrandOfferType(offerType, cfg) {
  switch (offerType) {
    case 'discount':  return (cfg && cfg.sub_type === 'flat') ? 'flat' : 'percentage';
    case 'volume':    return 'volume';
    case 'bogo':      return 'bogo';
    case 'bundle':    return 'bundle';
    case 'free_gift': return 'free_gift';
    default:          return offerType || null;
  }
}

// ── PURE: discount headline from a LIBRARY-vocab offer_config_json ────────────────
function extractDiscount(offerType, cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  switch (offerType) {
    case 'discount': {
      const value = c.value != null && Number.isFinite(Number(c.value)) ? Number(c.value) : null;
      if (c.sub_type === 'flat') return { kind: 'flat', value, label: value != null ? `₹${value} off` : 'Flat off' };
      return { kind: 'pct', value, label: value != null ? `${value}% off` : '% off' };
    }
    case 'volume': {
      const tiers = Array.isArray(c.tiers) ? c.tiers : [];
      const top = tiers.reduce((m, t) => {
        const p = t && Number.isFinite(Number(t.pct_off)) ? Number(t.pct_off) : 0;
        return p > m ? p : m;
      }, 0);
      const value = top > 0 ? top : null;
      return { kind: 'volume', value, label: value != null ? `Up to ${value}% off` : 'Volume deal' };
    }
    case 'bundle': {
      const bp = c.bundle_price != null && Number.isFinite(Number(c.bundle_price)) ? Number(c.bundle_price) : null;
      return { kind: 'bundle', value: null, label: bp != null ? `Bundle ₹${bp}` : 'Bundle' };
    }
    case 'bogo':      return { kind: 'bogo', value: null, label: 'Buy 1 Get 1' };
    case 'free_gift': return { kind: 'free_gift', value: null, label: 'Free gift' };
    default:          return { kind: offerType || null, value: null, label: null };
  }
}

// ── PURE: discount headline from a LEGACY-vocab inline offer ──────────────────────
// Legacy inline offers carry the magnitude in offer_config_json.value (and the old
// feed also falls back to discount_value / commission). `dvCol` = a discount_value
// already resolved by SQL COALESCE (offer_config_json->>'value', commission_pct).
function extractLegacyDiscount(offerType, cfg, dvCol) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const fromCfg = c.value != null && Number.isFinite(Number(c.value)) ? Number(c.value) : null;
  const value = fromCfg != null ? fromCfg
    : (dvCol != null && Number.isFinite(Number(dvCol)) ? Number(dvCol) : null);
  switch (offerType) {
    case 'percentage': return { kind: 'pct', value, label: value != null ? `${value}% off` : '% off' };
    case 'flat':       return { kind: 'flat', value, label: value != null ? `₹${value} off` : 'Flat off' };
    case 'volume':     return { kind: 'volume', value, label: value != null ? `Up to ${value}% off` : 'Volume deal' };
    case 'bundle':     return { kind: 'bundle', value: null, label: 'Bundle' };
    case 'bogo':       return { kind: 'bogo', value: null, label: 'Buy 1 Get 1' };
    case 'prebook':    return { kind: 'prebook', value, label: 'Pre-book' };
    default:           return { kind: offerType || null, value, label: null };
  }
}

// ── PURE: follower-safe product ref + offer config for the product-page OfferBlock ──
// The client needs the raw mechanic shape (tiers / buy-get / bundle products / gift
// pairs) to render the type-specific block and to compose the cart. We pass only a
// sanitized subset of offer_config_json — never internal fields. Additive: clients
// that ignore `config` are unaffected; pricing stays authoritative server-side.
function pickProductRef(p) {
  if (!p) return null;
  if (typeof p === 'string') return { id: p };
  const id = p.id || p.product_id;
  if (!id) return null;
  const ref = { id };
  if (p.name != null) ref.name = p.name;
  if (p.price != null && Number.isFinite(Number(p.price))) ref.price = Number(p.price);
  return ref;
}
function extractConfig(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const out = {};
  if (c.sub_type != null) out.sub_type = c.sub_type;
  if (c.value != null && Number.isFinite(Number(c.value))) out.value = Number(c.value);
  if (c.scope != null) out.scope = c.scope;
  if (c.category != null) out.category = c.category;
  if (Array.isArray(c.tiers)) {
    out.tiers = c.tiers
      .map(t => ({ min_spend: Number(t.min_spend) || 0, pct_off: Number(t.pct_off) || 0 }))
      .sort((a, b) => a.min_spend - b.min_spend);
  }
  if (c.buy_product) out.buy_product = pickProductRef(c.buy_product);
  if (c.get_product) out.get_product = pickProductRef(c.get_product);
  if (Array.isArray(c.products)) out.products = c.products.map(pickProductRef).filter(Boolean);
  if (c.bundle_price != null && Number.isFinite(Number(c.bundle_price))) out.bundle_price = Number(c.bundle_price);
  if (Array.isArray(c.offers)) {
    out.offers = c.offers
      .map(o => ({ main: pickProductRef(o && o.main), gift: pickProductRef(o && o.gift) }))
      .filter(o => o.main && o.gift);
  }
  return Object.keys(out).length ? out : null;
}

// ── PURE: classify a creator assignment's offer ───────────────────────────────────
// Engagement (showcase) iff allocation='promotional'. Everything else with an offer
// is conversion (commissioned/tracked) — incl. legacy rows where allocation is null
// but the assignment carries an offer + commission.
function channelOfAllocation(allocation) {
  return allocation === 'promotional' ? 'engagement' : 'conversion';
}

// ── PURE: normalize a creator-assignment row (the primary offer source) ───────────
// row carries ci.* (offer_type, offer_config_json, allocation, commission_pct,
// brand_offer_id, offer_expires_at, influencer_id, id) + brand + creator + bo_name.
function normalizeAssignment(row) {
  // offer_type on campaign_influencers is stored free-form and case varies in real
  // data (e.g. 'Discount' as well as 'volume') — normalize case for classification.
  const typeKey = row.offer_type ? String(row.offer_type).toLowerCase() : null;
  const cfg = row.offer_config_json && typeof row.offer_config_json === 'object' ? row.offer_config_json : {};
  const isLibraryVocab = typeKey ? LIBRARY_TYPES.has(typeKey) : false;
  const isLegacyVocab = typeKey ? LEGACY_TYPES.has(typeKey) : false;

  // discount/free_gift are library-only; flat/percentage/prebook are legacy-only;
  // bogo/bundle/volume exist in BOTH — for those the config shape decides.
  const useLibrary = typeKey === 'discount' || typeKey === 'free_gift'
    || (isLibraryVocab && !isLegacyVocab)
    || (isLibraryVocab && (cfg.sub_type != null || Array.isArray(cfg.tiers) || cfg.buy_product != null || cfg.offers != null));

  const displayType = useLibrary ? mapBrandOfferType(typeKey, cfg) : typeKey;
  const discount = useLibrary
    ? extractDiscount(typeKey, cfg)
    : extractLegacyDiscount(typeKey, cfg, row.discount_value);

  const channel = channelOfAllocation(row.allocation);
  const tracked = channel === 'conversion' && !!row.handle;

  return {
    id: row.campaign_influencer_id || row.id,
    source: 'assignment',
    channel,
    brand: { id: row.brand_id, name: row.brand_name, category: row.brand_category, city: row.brand_city },
    name: row.bo_name || null,           // from the library when this was a library attach; else null (inline)
    offer_type: displayType,
    discount,
    discount_value: discount.value,
    config: extractConfig(cfg),               // mechanic shape for the product-page OfferBlock
    availing_modes: row.availing_modes || [], // from the library row when present; inline offers carry none
    offer_expires_at: row.offer_expires_at || null,
    via_creator: row.handle
      ? { id: row.influencer_id, handle: row.handle, name: row.influencer_name, avatar: row.profile_pic_url }
      : null,
    // Only conversion is an attributable, commissioned link. Engagement = showcase only.
    tracking: tracked
      ? buildTracking({
          handle: row.handle, cid: row.campaign_id, sid: row.set_id,
          oid: row.brand_offer_id || row.offer_id || null, iid: row.influencer_id,
        })
      : null,
  };
}

// ── PURE: normalize a LIBRARY offer row (store-direct + engagement showcase multi) ─
// These read the library config directly (no per-creator snapshot exists for them).
// channel 'store' → no creator, no tracking. channel 'engagement' (showcase) →
// creator shown, NO tracking (promotional/awareness, no commission).
function normalizeLibraryOffer(row, channel) {
  const cfg = row.offer_config_json && typeof row.offer_config_json === 'object' ? row.offer_config_json : {};
  const displayType = mapBrandOfferType(row.offer_type, cfg);
  const discount = extractDiscount(row.offer_type, cfg);
  const hasCreator = channel !== 'store' && !!row.handle;
  return {
    id: row.id,
    source: channel === 'store' ? 'store' : 'showcase',
    channel,
    brand: { id: row.brand_id, name: row.brand_name, category: row.brand_category, city: row.brand_city },
    name: row.name || null,
    offer_type: displayType,
    discount,
    discount_value: discount.value,
    config: extractConfig(cfg),
    availing_modes: row.availing_modes || [],
    offer_expires_at: row.store_ends_at || null,
    via_creator: hasCreator
      ? { id: row.influencer_id, handle: row.handle, name: row.influencer_name, avatar: row.profile_pic_url }
      : null,
    tracking: null, // store-direct (iid null by design) + engagement showcase (no commission)
  };
}

// ── PURE: rank a normalized offer list for a given shelf rule → feed items ────────
// Ordering/scope per rule. ctx: { categoryKeys?:string[], followedIds?:Set|array,
// influencerId?:uuid, brandId?:uuid, minDiscountPct?:number, limit?:number }. Count-based rules (engagement/conversions/
// picks) DEGRADE to discount-then-recency here — the adapter does not yet compute
// per-offer click/txn counts for assignment-sourced offers (documented; refined later).
function rankForRule(ruleKey, items, ctx = {}) {
  const limit = ctx.limit || 8;
  const followed = ctx.followedIds instanceof Set
    ? ctx.followedIds
    : new Set(Array.isArray(ctx.followedIds) ? ctx.followedIds : []);
  let list = Array.isArray(items) ? items.slice() : [];

  // category scope (brand.category ∈ categoryKeys)
  if (Array.isArray(ctx.categoryKeys) && ctx.categoryKeys.length) {
    const cats = new Set(ctx.categoryKeys);
    list = list.filter(n => n.brand && cats.has(n.brand.category));
  }

  // business-page scope — a brand's own page shows only that brand's offers
  if (ctx.brandId) {
    list = list.filter(n => n.brand && n.brand.id === ctx.brandId);
  }

  // per-section "Minimum discount %" knob (config_json.min_discount_pct)
  const minDisc = Number(ctx.minDiscountPct);
  if (Number.isFinite(minDisc) && minDisc > 0) {
    list = list.filter(n => Number(n.discount_value) >= minDisc);
  }

  const byDiscountDesc = (a, b) => (b.discount_value ?? -Infinity) - (a.discount_value ?? -Infinity);

  switch (ruleKey) {
    case 'follow_graph':
      list = list.filter(n => n.via_creator && followed.has(n.via_creator.id));
      break;
    case 'creator_promotes':
    case 'creator_top_picks':
      list = list.filter(n => n.via_creator && n.via_creator.id === ctx.influencerId);
      if (ruleKey === 'creator_top_picks') list.sort(byDiscountDesc);
      break;
    case 'biggest_discounts':
      list.sort(byDiscountDesc);
      break;
    case 'ending_soon':
      list = list.filter(n => n.offer_expires_at)
        .sort((a, b) => new Date(a.offer_expires_at) - new Date(b.offer_expires_at));
      break;
    case 'top_by_engagement':
    case 'top_by_conversions':
    case 'top_picks':
      list.sort(byDiscountDesc); // degraded proxy until per-offer counts are wired
      break;
    case 'newest':
    case 'all_offers':
    default:
      break; // input order = recency from SQL
  }
  return list.slice(0, limit).map(toFeedItem);
}

// ── PURE: normalized offer → the feed-item shape sectionRules.mapOfferItem emits ──
function toFeedItem(n) {
  return {
    entity_type: 'offer',
    id: n.id,
    offer_type: n.offer_type,
    discount_value: n.discount_value,
    discount: n.discount,
    config: n.config || null,
    availing_modes: n.availing_modes || [],
    offer_expires_at: n.offer_expires_at,
    brand: n.brand,
    via_creator: n.via_creator,
    source: n.source,
    channel: n.channel,
    tracking: n.tracking,
  };
}

// ── PURE: dedup ───────────────────────────────────────────────────────────────────
// Identity: assignment rows are unique per assignment (id). Library rows (store +
// showcase) can repeat the same brand_offer across creators → key on (id, creator).
// If the same brand_offer appears both as an assignment and a showcase for the same
// creator, the assignment (snapshot/commissioned) wins.
const CHANNEL_RANK = { conversion: 0, engagement: 1, store: 2 };
function dedupe(list) {
  const best = new Map();
  for (const n of list) {
    const creator = n.via_creator ? n.via_creator.id : '';
    const key = `${n.source}:${n.id}:${creator}`;
    const cur = best.get(key);
    if (!cur || CHANNEL_RANK[n.channel] < CHANNEL_RANK[cur.channel]) best.set(key, n);
  }
  return Array.from(best.values());
}

// ── SQL ─────────────────────────────────────────────────────────────────────────
// Live-chain predicate shared by the assignment + showcase sources.
const LIVE_CI = `
    ci.status IN ('contracted','active','completed')
    AND c.status  IN ('published','active','live')
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)`;

// Source 1 — creator assignments carrying an offer (inline OR single library attach;
// conversion OR single promotional). Mirrors follower.service: LEFT JOIN the legacy
// campaign_offers for an offer_id/availing_modes fallback, fall back to the ci snapshot.
async function fetchAssignmentOffers(ctx = {}) {
  const { limit = 50 } = ctx;
  const sql = `
    SELECT
      ci.id                 AS campaign_influencer_id,
      ci.offer_type::text   AS offer_type,
      ci.offer_config_json  AS offer_config_json,
      ci.allocation         AS allocation,
      ci.commission_pct     AS commission_pct,
      ci.brand_offer_id     AS brand_offer_id,
      ci.offer_expires_at   AS offer_expires_at,
      ci.influencer_id      AS influencer_id,
      cs.id                 AS set_id,
      cs.campaign_id        AS campaign_id,
      co.id                 AS offer_id,
      -- collab-part1-corrections §1.2 — ci.commission_pct dropped as the final
      -- COALESCE leg. Commission is the brand's cost, not a customer discount.
      COALESCE(co.discount_value, NULLIF(ci.offer_config_json->>'value','')::numeric) AS discount_value,
      COALESCE(co.availing_modes, bo.availing_modes) AS availing_modes,
      bo.name               AS bo_name,
      b.id                  AS brand_id,
      b.business_name       AS brand_name,
      b.category            AS brand_category,
      u_b.city              AS brand_city,
      i.instagram_handle    AS handle,
      i.followers_count     AS followers_count,
      i.profile_image_url   AS profile_pic_url,
      u_i.name              AS influencer_name
    FROM campaign_influencers ci
    JOIN campaign_sets cs  ON cs.id = ci.set_id
    JOIN campaigns c       ON c.id  = cs.campaign_id
    JOIN brands b          ON b.id  = c.brand_id
    JOIN users  u_b        ON u_b.id = b.user_id
    JOIN influencers i     ON i.id  = ci.influencer_id
    JOIN users  u_i        ON u_i.id = i.user_id
    LEFT JOIN campaign_offers co ON co.set_id = cs.id AND co.is_active = true
    LEFT JOIN brand_offers   bo ON bo.id = ci.brand_offer_id
    WHERE ${LIVE_CI}
      -- collab-part4 §4.2 — deliberately NOT widened to allocation-only. This
      -- source exists to surface assignments that CARRY AN OFFER; a creator
      -- selling at full price has no offer to list here, and returning them would
      -- put offer-less rows in an offers feed. Their products still reach
      -- followers through the storefront and section paths.
      AND ci.offer_type IS NOT NULL
    ORDER BY ci.created_at DESC
    LIMIT $1`;
  const { rows } = await db.query(sql, [limit]);
  return rows.map(normalizeAssignment);
}

// Source 2 — engagement multi-select showcase: library offers a creator promotes
// (ci.promoted_brand_offer_ids[]). No per-item snapshot → read the library config.
async function fetchShowcaseOffers(ctx = {}) {
  const { limit = 50 } = ctx;
  const sql = `
    SELECT
      bo.id, bo.name, bo.offer_type::text AS offer_type, bo.offer_config_json,
      bo.availing_modes, bo.store_ends_at,
      b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
      u_b.city AS brand_city,
      i.id AS influencer_id, i.instagram_handle AS handle,
      u_i.name AS influencer_name, i.profile_image_url AS profile_pic_url
    FROM campaign_influencers ci
    JOIN brand_offers bo ON bo.id = ANY(ci.promoted_brand_offer_ids) AND bo.status <> 'archived'
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c      ON c.id  = cs.campaign_id
    JOIN brands b         ON b.id  = bo.brand_id
    JOIN users u_b        ON u_b.id = b.user_id
    JOIN influencers i    ON i.id  = ci.influencer_id
    JOIN users u_i        ON u_i.id = i.user_id
    WHERE ${LIVE_CI}
    ORDER BY ci.created_at DESC
    LIMIT $1`;
  const { rows } = await db.query(sql, [limit]);
  return rows.map(r => normalizeLibraryOffer(r, 'engagement'));
}

// Source 3 — store-direct: brand-published deals, no creator.
async function fetchStoreOffers(ctx = {}) {
  const { limit = 50 } = ctx;
  const sql = `
    SELECT
      bo.id, bo.name, bo.offer_type::text AS offer_type, bo.offer_config_json,
      bo.availing_modes, bo.store_ends_at,
      b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
      u_b.city AS brand_city,
      NULL::uuid AS influencer_id, NULL::text AS handle,
      NULL::text AS influencer_name, NULL::text AS profile_pic_url
    FROM brand_offers bo
    JOIN brands b  ON b.id = bo.brand_id
    JOIN users u_b ON u_b.id = b.user_id
    WHERE bo.published_to_store = true AND bo.status = 'active'
      AND (bo.store_starts_at IS NULL OR bo.store_starts_at <= now())
      AND (bo.store_ends_at   IS NULL OR bo.store_ends_at   >= now())
    ORDER BY bo.created_at DESC
    LIMIT $1`;
  const { rows } = await db.query(sql, [limit]);
  return rows.map(r => normalizeLibraryOffer(r, 'store'));
}

/**
 * fetchOffers(ctx) — the unified offer source a section rule calls. Unions the three
 * real sources (creator assignments + engagement showcase + store-direct), deduped.
 * Rules apply their own rank/limit over the normalized list (via toFeedItem).
 * Consumption is gated by SECTION_ENGINE_OFFERS in the rules (OR contract).
 */
async function fetchOffers(ctx = {}) {
  const [assignments, showcase, store] = await Promise.all([
    fetchAssignmentOffers(ctx),
    fetchShowcaseOffers(ctx),
    fetchStoreOffers(ctx),
  ]);
  return dedupe([...assignments, ...showcase, ...store]);
}

module.exports = {
  // entry points
  fetchOffers,
  fetchAssignmentOffers,
  fetchShowcaseOffers,
  fetchStoreOffers,
  toFeedItem,
  offersV2Enabled,
  rankForRule,
  // pure helpers (unit-tested)
  mapBrandOfferType,
  extractDiscount,
  extractConfig,
  extractLegacyDiscount,
  channelOfAllocation,
  normalizeAssignment,
  normalizeLibraryOffer,
  dedupe,
  LIBRARY_TYPES,
  LEGACY_TYPES,
};
