'use strict';

/**
 * brandOffers.adapter.js — D0 Workstream B (contract: features/listing-section-d0-seams).
 *
 * THE PROBLEM THIS SOLVES
 *   Every section offer shelf (sectionRules.service.js, ~10 rules) reads ONLY the
 *   legacy `campaign_offers` table. The Offer Engine's model of record —
 *   `brand_offers` (mig 084) with its 3 distribution channels — is never read, so
 *   Offer-Engine offers never surface on the follower app. This adapter is the
 *   single seam that yields ONE normalized offer shape over BOTH sources, so the
 *   section rules can consume one list regardless of where an offer originated.
 *
 * THE THREE brand_offers CHANNELS (mig 084-086)
 *   · conversion  — campaign_influencers.brand_offer_id  (commissioned; tracked,
 *                   creator-attributed → full 4-ID chain).
 *   · engagement  — campaign_influencers.promoted_brand_offer_ids[] (promotional;
 *                   awareness only — NO commission, NO tracking link by design;
 *                   creator is shown but tracking is null).
 *   · store       — brand_offers.published_to_store=true (brand-direct; NO creator
 *                   → iid null by design).
 *   Plus the legacy `campaign_offers` canonical live chain (unchanged).
 *
 * NORMALIZED SHAPE (one row, source-agnostic)
 *   {
 *     id, source:'brand_offer'|'campaign_offer', channel:'conversion'|'engagement'|'store'|'campaign',
 *     brand: { id, name, category, city },
 *     name, offer_type,            // offer_type normalized to the LEGACY display vocab
 *     discount: { kind, value, label },   // structured; kind ∈ pct|flat|volume|bogo|bundle|free_gift|prebook|null
 *     discount_value,              // numeric for biggest_discounts ordering + badge (mirrors legacy column)
 *     availing_modes, prebook_advance, end_date, offer_expires_at,
 *     via_creator: { id, handle, name, avatar } | null,
 *     tracking: { cid, sid, oid, iid, url } | null,   // null for engagement + store (no attributable link)
 *   }
 *
 * DESIGN NOTES
 *   - The PURE normalization helpers (normalizeBrandOfferRow, extractDiscount,
 *     mapBrandOfferType) carry the bug-prone logic and are unit-tested directly
 *     (tests/brandOffers.adapter.test.js) — no DB required.
 *   - `toFeedItem()` emits the exact shape sectionRules' mapOfferItem produces, so
 *     a rule can swap its row source with zero downstream/mobile change.
 *   - GATED: fetchOffers() returns campaign_offers only unless SECTION_ENGINE_OFFERS
 *     is on. With the flag OFF (prod default today) the adapter is byte-identical to
 *     the legacy source → safe to ship dormant. The flag flip + rule-wiring is the
 *     separate 'OR / section-offer-repoint' contract, validated with real prod data.
 *   - The channel SQL below is written per the locked design but is exercised only
 *     when the flag is ON; it is validated at OR-time against real brand_offers rows
 *     (none are reachable in the build sandbox) — see lock.json SANDBOX CONSTRAINT.
 */

const db = require('../config/db');
const env = require('../config/env');
const { buildTracking } = require('../utils/tracking');

// ── flag ──────────────────────────────────────────────────────────────────────
// env.js exposes SECTION_ENGINE_OFFERS (default false). Re-read process.env too so
// tests can toggle without reloading the env module.
function offersV2Enabled() {
  if (process.env.SECTION_ENGINE_OFFERS != null) {
    return process.env.SECTION_ENGINE_OFFERS === 'true';
  }
  return env.SECTION_ENGINE_OFFERS === true;
}

// ── PURE: offer_type vocab bridge ───────────────────────────────────────────────
// brand_offers vocab: discount|volume|bogo|bundle|free_gift  (offerConfig.validator)
// legacy display vocab: flat|percentage|bogo|bundle|volume|prebook (what mobile cards
// already interpret). Map brand_offers → the display vocab the cards expect.
function mapBrandOfferType(offerType, cfg) {
  switch (offerType) {
    case 'discount':
      return (cfg && cfg.sub_type === 'flat') ? 'flat' : 'percentage';
    case 'volume':    return 'volume';
    case 'bogo':      return 'bogo';
    case 'bundle':    return 'bundle';
    case 'free_gift': return 'free_gift';
    default:          return offerType || null;
  }
}

// ── PURE: discount extraction from offer_config_json (per brand_offers type) ──────
// Returns { kind, value, label }. `value` is the numeric used for ranking/badges
// (percentage points, or rupee amount, or top volume tier %); null when the mechanic
// has no single headline number (bogo/free_gift).
function extractDiscount(offerType, cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  switch (offerType) {
    case 'discount': {
      const value = c.value != null && Number.isFinite(Number(c.value)) ? Number(c.value) : null;
      if (c.sub_type === 'flat') {
        return { kind: 'flat', value, label: value != null ? `₹${value} off` : 'Flat off' };
      }
      return { kind: 'pct', value, label: value != null ? `${value}% off` : '% off' };
    }
    case 'volume': {
      // headline = the biggest tier discount on offer
      const tiers = Array.isArray(c.tiers) ? c.tiers : [];
      const top = tiers.reduce((m, t) => {
        const p = t && Number.isFinite(Number(t.pct_off)) ? Number(t.pct_off) : 0;
        return p > m ? p : m;
      }, 0);
      const value = top > 0 ? top : null;
      return { kind: 'volume', value, label: value != null ? `Up to ${value}% off` : 'Volume deal' };
    }
    case 'bundle': {
      const value = c.bundle_price != null && Number.isFinite(Number(c.bundle_price))
        ? Number(c.bundle_price) : null;
      // bundle_price is a price, NOT a discount magnitude → not used for discount ranking
      return { kind: 'bundle', value: null, label: value != null ? `Bundle ₹${value}` : 'Bundle' };
    }
    case 'bogo':
      return { kind: 'bogo', value: null, label: 'Buy 1 Get 1' };
    case 'free_gift':
      return { kind: 'free_gift', value: null, label: 'Free gift' };
    default:
      return { kind: offerType || null, value: null, label: null };
  }
}

// ── PURE: normalize a legacy campaign_offers row (as selected by OFFER_COLS) ──────
function normalizeCampaignOfferRow(r) {
  const dv = r.discount_value != null ? parseFloat(r.discount_value) : null;
  const otype = r.offer_type || null;
  let discount;
  if (otype === 'percentage') discount = { kind: 'pct', value: dv, label: dv != null ? `${dv}% off` : '% off' };
  else if (otype === 'flat')  discount = { kind: 'flat', value: dv, label: dv != null ? `₹${dv} off` : 'Flat off' };
  else                        discount = { kind: otype, value: dv, label: null };
  return {
    id: r.offer_id,
    source: 'campaign_offer',
    channel: 'campaign',
    brand: { id: r.brand_id, name: r.brand_name, category: r.brand_category, city: r.brand_city },
    name: r.offer_name || null,
    offer_type: otype,
    discount,
    discount_value: dv,
    availing_modes: r.availing_modes || [],
    prebook_advance: r.prebook_advance != null ? parseFloat(r.prebook_advance) : null,
    end_date: r.end_date || null,
    offer_expires_at: r.offer_expires_at || null,
    via_creator: r.handle
      ? { id: r.influencer_id, handle: r.handle, name: r.influencer_name, avatar: r.profile_pic_url }
      : null,
    tracking: r.handle
      ? buildTracking({ handle: r.handle, cid: r.campaign_id, sid: r.set_id, oid: r.offer_id, iid: r.influencer_id })
      : null,
  };
}

// ── PURE: normalize a brand_offers row for a given channel ────────────────────────
// `row` carries bo.* plus (for conversion/engagement) the ci/cs/c/brand/creator cols.
// channel ∈ 'conversion'|'engagement'|'store'. Attribution rules:
//   conversion → full 4-ID tracking (commissioned, creator-attributed).
//   engagement → creator shown, tracking NULL (promotional/awareness, no commission).
//   store      → no creator, tracking NULL (iid null by design).
function normalizeBrandOfferRow(row, channel) {
  const cfg = row.offer_config_json && typeof row.offer_config_json === 'object'
    ? row.offer_config_json : {};
  const offerType = mapBrandOfferType(row.offer_type, cfg);
  const discount = extractDiscount(row.offer_type, cfg);
  const hasCreator = channel !== 'store' && !!row.handle;

  return {
    id: row.id,
    source: 'brand_offer',
    channel,
    brand: { id: row.brand_id, name: row.brand_name, category: row.brand_category, city: row.brand_city },
    name: row.name || null,
    offer_type: offerType,
    discount,
    discount_value: discount.value,
    availing_modes: row.availing_modes || [],
    prebook_advance: null, // brand_offers carries no prebook_advance column; CTA derives from availing_modes
    end_date: null,
    offer_expires_at: row.store_ends_at || null,
    via_creator: hasCreator
      ? { id: row.influencer_id, handle: row.handle, name: row.influencer_name, avatar: row.profile_pic_url }
      : null,
    // Only the conversion channel produces an attributable tracked link.
    tracking: (channel === 'conversion' && row.handle)
      ? buildTracking({ handle: row.handle, cid: row.campaign_id, sid: row.set_id, oid: row.id, iid: row.influencer_id })
      : null,
  };
}

// ── PURE: normalized offer → the feed-item shape sectionRules.mapOfferItem emits ──
// Lets a rule swap its source with zero downstream/mobile change.
function toFeedItem(n) {
  return {
    entity_type: 'offer',
    id: n.id,
    offer_type: n.offer_type,
    discount_value: n.discount_value,
    discount: n.discount,            // structured extra (additive; legacy items omit it)
    availing_modes: n.availing_modes || [],
    prebook_advance: n.prebook_advance,
    end_date: n.end_date,
    offer_expires_at: n.offer_expires_at,
    brand: n.brand,
    via_creator: n.via_creator,
    source: n.source,
    channel: n.channel,
    tracking: n.tracking,
  };
}

// ── PURE: dedup a normalized list ─────────────────────────────────────────────────
// A brand_offer can appear via more than one channel (e.g. promoted by several
// creators). Keep the highest-priority instance: conversion > engagement > store >
// campaign (conversion is attributable/commissioned, so it wins).
const CHANNEL_RANK = { conversion: 0, engagement: 1, store: 2, campaign: 3 };
function dedupe(list) {
  const best = new Map();
  for (const n of list) {
    // dedup key = the underlying offer identity (source+id); a campaign_offer and a
    // brand_offer are distinct rows even if conceptually related — only collapse
    // exact (source,id) repeats and same brand_offer surfaced via multiple channels.
    const key = `${n.source}:${n.id}`;
    const cur = best.get(key);
    if (!cur || CHANNEL_RANK[n.channel] < CHANNEL_RANK[cur.channel]) best.set(key, n);
  }
  return Array.from(best.values());
}

// ── SQL column lists ──────────────────────────────────────────────────────────────
// Legacy campaign_offers — mirrors sectionRules.OFFER_COLS (+ co.name when present).
const CAMPAIGN_OFFER_COLS = `
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

const CAMPAIGN_OFFER_FROM = `
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

// brand_offers shared columns (bo + brand + users).
const BO_BASE_COLS = `
    bo.id, bo.name, bo.offer_type::text AS offer_type, bo.offer_config_json,
    bo.availing_modes, bo.store_ends_at,
    b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
    u_b.city AS brand_city`;

// ── DB fetchers (per channel) ─────────────────────────────────────────────────────
// NOTE: validated at OR-time with real prod data (no brand_offers rows in sandbox).

// store-direct: published, active, within window. No creator.
async function fetchStoreOffers(ctx) {
  const { limit = 50 } = ctx || {};
  const sql = `
    SELECT ${BO_BASE_COLS},
           NULL::uuid AS influencer_id, NULL::text AS handle,
           NULL::text AS influencer_name, NULL::text AS profile_pic_url,
           NULL::uuid AS campaign_id, NULL::uuid AS set_id
      FROM brand_offers bo
      JOIN brands b  ON b.id = bo.brand_id
      JOIN users u_b ON u_b.id = b.user_id
     WHERE bo.published_to_store = true AND bo.status = 'active'
       AND (bo.store_starts_at IS NULL OR bo.store_starts_at <= now())
       AND (bo.store_ends_at   IS NULL OR bo.store_ends_at   >= now())
     ORDER BY bo.created_at DESC
     LIMIT $1`;
  const { rows } = await db.query(sql, [limit]);
  return rows.map(r => normalizeBrandOfferRow(r, 'store'));
}

// conversion: brand_offer attached to a live campaign_influencer as commissioned.
async function fetchConversionOffers(ctx) {
  const { limit = 50 } = ctx || {};
  const sql = `
    SELECT ${BO_BASE_COLS},
           i.id AS influencer_id, i.instagram_handle AS handle,
           u_i.name AS influencer_name, i.profile_image_url AS profile_pic_url,
           c.id AS campaign_id, cs.id AS set_id
      FROM campaign_influencers ci
      JOIN brand_offers bo ON bo.id = ci.brand_offer_id
      JOIN campaign_sets cs ON cs.id = ci.set_id
      JOIN campaigns c      ON c.id  = cs.campaign_id
      JOIN brands b         ON b.id  = bo.brand_id
      JOIN users u_b        ON u_b.id = b.user_id
      JOIN influencers i    ON i.id  = ci.influencer_id
      JOIN users u_i        ON u_i.id = i.user_id
     WHERE ci.status IN ('contracted','active','completed')
       AND c.status  IN ('published','active','live')
       AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
       AND bo.status <> 'archived'
     ORDER BY ci.created_at DESC
     LIMIT $1`;
  const { rows } = await db.query(sql, [limit]);
  return rows.map(r => normalizeBrandOfferRow(r, 'conversion'));
}

// engagement: brand_offers promoted (multi) by a live campaign_influencer. Promotional.
async function fetchEngagementOffers(ctx) {
  const { limit = 50 } = ctx || {};
  const sql = `
    SELECT ${BO_BASE_COLS},
           i.id AS influencer_id, i.instagram_handle AS handle,
           u_i.name AS influencer_name, i.profile_image_url AS profile_pic_url,
           c.id AS campaign_id, cs.id AS set_id
      FROM campaign_influencers ci
      JOIN brand_offers bo ON bo.id = ANY(ci.promoted_brand_offer_ids)
      JOIN campaign_sets cs ON cs.id = ci.set_id
      JOIN campaigns c      ON c.id  = cs.campaign_id
      JOIN brands b         ON b.id  = bo.brand_id
      JOIN users u_b        ON u_b.id = b.user_id
      JOIN influencers i    ON i.id  = ci.influencer_id
      JOIN users u_i        ON u_i.id = i.user_id
     WHERE ci.status IN ('contracted','active','completed')
       AND c.status  IN ('published','active','live')
       AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
       AND bo.status <> 'archived'
     ORDER BY ci.created_at DESC
     LIMIT $1`;
  const { rows } = await db.query(sql, [limit]);
  return rows.map(r => normalizeBrandOfferRow(r, 'engagement'));
}

/**
 * fetchOffers(ctx) — the single entry point a section offer rule calls.
 *
 * GATED: with SECTION_ENGINE_OFFERS OFF (prod default), returns ONLY legacy
 * campaign_offers (byte-identical to today). With it ON, unions brand_offers'
 * 3 channels + campaign_offers, deduped. Returns NORMALIZED rows; the rule maps
 * to feed items via toFeedItem and applies its own rank/limit.
 *
 * Note: legacy campaign_offers fetch here is intentionally NOT used by the live
 * rules yet (they keep their own bespoke SQL until the OR contract rewires them);
 * fetchOffers is the forward path the OR contract switches the rules onto.
 */
async function fetchOffers(ctx = {}) {
  if (!offersV2Enabled()) {
    return fetchCampaignOffers(ctx);
  }
  const [campaign, store, conversion, engagement] = await Promise.all([
    fetchCampaignOffers(ctx),
    fetchStoreOffers(ctx),
    fetchConversionOffers(ctx),
    fetchEngagementOffers(ctx),
  ]);
  return dedupe([...conversion, ...engagement, ...store, ...campaign]);
}

// legacy campaign_offers as normalized rows (the always-on baseline).
async function fetchCampaignOffers(ctx) {
  const { limit = 50 } = ctx || {};
  const sql = `
    SELECT ${CAMPAIGN_OFFER_COLS}
    ${CAMPAIGN_OFFER_FROM}
    ORDER BY ci.created_at DESC
    LIMIT $1`;
  const { rows } = await db.query(sql, [limit]);
  return rows.map(normalizeCampaignOfferRow);
}

module.exports = {
  // entry points
  fetchOffers,
  fetchCampaignOffers,
  fetchStoreOffers,
  fetchConversionOffers,
  fetchEngagementOffers,
  toFeedItem,
  offersV2Enabled,
  // pure helpers (unit-tested)
  mapBrandOfferType,
  extractDiscount,
  normalizeBrandOfferRow,
  normalizeCampaignOfferRow,
  dedupe,
};
