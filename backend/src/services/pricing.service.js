'use strict';

/**
 * pricing.service.js
 *
 * Central pricing engine for the 3-layer revenue model.
 *
 *   Layer 1 — SaaS subscription tiers            (computeL1Renewal — Phase A3)
 *   Layer 2 — Campaign Protection (escrow) fee   (resolve/lock/getLocked — M037, Phase B1)
 *   Layer 3 — Marketplace fee per category × path (computeL3OnFollowerTxn — Phase A3)
 *
 * All fee math goes through this service so that admin-edited rates flow
 * everywhere consistently and there is exactly one place to audit when a
 * fee value looks wrong.
 *
 * Caches escrow_fee_tiers + categories in memory for 60s; admin updates
 * bust the cache. classifyPath is DB-bound (reads attribution_clicks)
 * but does not cache — its result is per-(follower,brand,now).
 */

const db = require('../config/db');
const paymentConfigSvc = require('./paymentConfig.service');
const influencerStore = require('./influencerStore.service');

let _tierCache     = null;
let _tierCacheTime = 0;
let _categoriesCache     = null;
let _categoriesCacheTime = 0;
const CACHE_TTL_MS = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 — Campaign Protection Fee
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all escrow_fee_tiers ordered by min_amount_inr ascending.
 * Cached 60s.
 */
async function _loadTiers() {
  const now = Date.now();
  if (_tierCache && (now - _tierCacheTime) < CACHE_TTL_MS) return _tierCache;

  const { rows } = await db.query(
    `SELECT tier_key, min_amount_inr, max_amount_inr, fee_pct
       FROM escrow_fee_tiers
       ORDER BY min_amount_inr ASC`
  );
  _tierCache     = rows.map(r => ({
    tier_key:       r.tier_key,
    min_amount_inr: parseFloat(r.min_amount_inr),
    max_amount_inr: r.max_amount_inr == null ? null : parseFloat(r.max_amount_inr),
    fee_pct:        parseFloat(r.fee_pct),
  }));
  _tierCacheTime = now;
  return _tierCache;
}

function bustEscrowTierCache() {
  _tierCache     = null;
  _tierCacheTime = 0;
}

/**
 * Find the escrow fee tier whose [min, max] band contains the given amount.
 * Returns null if no tier matches (defensive — should never happen with
 * properly configured tiers covering [0, ∞)).
 */
async function lookupEscrowFeeTier(amount) {
  const tiers = await _loadTiers();
  const a = parseFloat(amount) || 0;
  for (const t of tiers) {
    const minOk = a >= t.min_amount_inr;
    const maxOk = t.max_amount_inr == null || a <= t.max_amount_inr;
    if (minOk && maxOk) return t;
  }
  return null;
}

/**
 * Resolve the L2 fee rate for a campaign at publish time.
 *
 * Precedence:
 *   1. Per-brand override (brands.escrow_fee_override_pct), if set.
 *   2. Tier lookup based on the engagement+hybrid base amount.
 *   3. Null on total failure (caller must fall back / error).
 *
 * @param {object} args
 * @param {number} args.baseAmountInr        — sum of engagement+hybrid set_budgets
 * @param {number|null} args.brandOverridePct — brands.escrow_fee_override_pct (nullable)
 * @returns {{ fee_pct: number, tier_key: string|null, source: 'brand_override'|'tier_lookup' }}
 */
async function resolveEscrowFeePct({ baseAmountInr, brandOverridePct }) {
  if (brandOverridePct != null && !Number.isNaN(parseFloat(brandOverridePct))) {
    return {
      fee_pct:  parseFloat(brandOverridePct),
      tier_key: null,
      source:   'brand_override',
    };
  }
  const tier = await lookupEscrowFeeTier(baseAmountInr);
  if (!tier) return { fee_pct: 0, tier_key: null, source: 'tier_lookup' };
  return {
    fee_pct:  tier.fee_pct,
    tier_key: tier.tier_key,
    source:   'tier_lookup',
  };
}

/**
 * Compute the L2 base for a campaign — sum of set_budget across engagement
 * and hybrid sets only. Pure conversion sets contribute nothing.
 *
 * @param {object} client    — pg client (transaction-bound or pool)
 * @param {string} campaignId
 * @returns {number} base amount in rupees
 */
async function computeEscrowFeeBase(client, campaignId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(
       CASE WHEN goal IN ('engagement', 'hybrid')
            THEN COALESCE(set_budget, 0)
            ELSE 0 END
     ), 0) AS base
       FROM campaign_sets
       WHERE campaign_id = $1`,
    [campaignId]
  );
  return parseFloat(rows[0].base) || 0;
}

/**
 * Lock the L2 fee on a campaign at publish time. Idempotent: if already
 * locked, returns existing values without overwriting.
 *
 * Sets campaigns.escrow_fee_pct_locked, escrow_fee_base_inr, escrow_fee_locked_at.
 *
 * @param {object} client    — pg client (must be inside transaction)
 * @param {string} campaignId
 * @param {string} brandId
 * @returns {{ fee_pct: number, base_inr: number, tier_key: string|null, source: string, already_locked: boolean }}
 */
async function lockEscrowFeeAtPublish(client, campaignId, brandId) {
  const { rows: existing } = await client.query(
    `SELECT escrow_fee_pct_locked, escrow_fee_base_inr
       FROM campaigns WHERE id = $1`,
    [campaignId]
  );
  if (existing[0]?.escrow_fee_pct_locked != null) {
    return {
      fee_pct:        parseFloat(existing[0].escrow_fee_pct_locked),
      base_inr:       parseFloat(existing[0].escrow_fee_base_inr),
      tier_key:       null,
      source:         'already_locked',
      already_locked: true,
    };
  }

  const baseInr = await computeEscrowFeeBase(client, campaignId);

  const { rows: brandRows } = await client.query(
    `SELECT escrow_fee_override_pct FROM brands WHERE id = $1`,
    [brandId]
  );
  const brandOverridePct = brandRows[0]?.escrow_fee_override_pct;

  const resolved = await resolveEscrowFeePct({
    baseAmountInr:    baseInr,
    brandOverridePct,
  });

  await client.query(
    `UPDATE campaigns
        SET escrow_fee_pct_locked = $1,
            escrow_fee_base_inr   = $2,
            escrow_fee_locked_at  = now()
      WHERE id = $3`,
    [resolved.fee_pct, baseInr, campaignId]
  );

  return {
    fee_pct:        resolved.fee_pct,
    base_inr:       baseInr,
    tier_key:       resolved.tier_key,
    source:         resolved.source,
    already_locked: false,
  };
}

/**
 * Read the locked L2 fee % for a campaign. Returns null if the campaign was
 * published before M037 (legacy path) — caller should fall back to
 * payment_config.platform_fee_pct in that case.
 */
async function getLockedEscrowFeePct(client, campaignId) {
  const { rows } = await client.query(
    `SELECT escrow_fee_pct_locked FROM campaigns WHERE id = $1`,
    [campaignId]
  );
  if (!rows[0] || rows[0].escrow_fee_pct_locked == null) return null;
  return parseFloat(rows[0].escrow_fee_pct_locked);
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 — SaaS subscription
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the next-cycle monthly charge for a brand's active subscription.
 *
 * Returns:
 *   { amount_inr: number, tier_key: string, source: string }
 *
 * source = 'active_subscription' (found a brand_subscriptions row, status='active')
 *        | 'no_subscription'     (no row yet — lazy 'free' default in Phase A4 quota check)
 *
 * Does NOT add GST; the subscription billing layer (Phase A6) applies that.
 */
async function computeL1Renewal(brandId) {
  const { rows } = await db.query(
    `SELECT t.monthly_price_inr, t.tier_key
       FROM brand_subscriptions bs
       JOIN subscription_tiers  t ON t.id = bs.tier_id
      WHERE bs.brand_id = $1
        AND bs.status   = 'active'
      LIMIT 1`,
    [brandId]
  );
  if (!rows[0]) {
    return { amount_inr: 0, tier_key: 'free', source: 'no_subscription' };
  }
  return {
    amount_inr: parseFloat(rows[0].monthly_price_inr),
    tier_key:   rows[0].tier_key,
    source:     'active_subscription',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3 — Marketplace fee per category × path
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapping from brands.category (free-text registration value) to
 * categories.category_key (admin catalog row).
 *
 * Hardcoded for Phase A3; admin UI for editing the alias map is a
 * follow-up (Phase A7+). Pass-through if no alias hits — caller may
 * still match a category_key directly (e.g. 'restaurant' → 'restaurant').
 */
const CATEGORY_ALIASES = {
  salon:           'salon_beauty',
  salon_beauty:    'salon_beauty',
  beauty:          'salon_beauty',
  spa:             'salon_beauty',
  restaurant:      'restaurant',
  restaurants:     'restaurant',
  fashion:         'fashion',
  fashion_walkin:  'fashion',
  fashion_online:  'fashion',
  apparel:         'fashion',
  car_rental:      'car_rental',
  rental:          'car_rental',
  packaged_food:   'packaged_food',
  food:            'packaged_food',
  florist:         'florist',
  flowers:         'florist',
  wedding_planner: 'wedding_planner',
  wedding:         'wedding_planner',
  function_hall:   'function_hall',
  banquet:         'function_hall',
  gym:             'gym_fitness',
  gym_fitness:     'gym_fitness',
  fitness:         'gym_fitness',
  travel:          'travel_hotel',
  travel_hotel:    'travel_hotel',
  hotel:           'travel_hotel',
  hotels:          'travel_hotel',
  electronics:     'electronics',
  jewellery:       'jewellery',
  jewelry:         'jewellery',
  footwear:        'footwear',
  shoes:           'footwear',
  furniture:       'furniture',
  optical:         'optical',
  eyewear:         'optical',
  home_services:   'home_services',
  cleaning:        'home_services',
  plumber:         'home_services',
};

function _normalizeCategoryKey(rawCategory) {
  if (!rawCategory) return null;
  const k = String(rawCategory).trim().toLowerCase();
  return CATEGORY_ALIASES[k] || k;  // pass-through allows direct category_key matches
}

async function _loadCategories() {
  const now = Date.now();
  if (_categoriesCache && (now - _categoriesCacheTime) < CACHE_TTL_MS) return _categoriesCache;
  const { rows } = await db.query(
    `SELECT category_key, path_a_pct, path_b_pct, path_c_pct, active
       FROM categories`
  );
  _categoriesCache = new Map(
    rows.map(r => [r.category_key, {
      path_a_pct: parseFloat(r.path_a_pct),
      path_b_pct: parseFloat(r.path_b_pct),
      path_c_pct: parseFloat(r.path_c_pct),
      active:     r.active,
    }])
  );
  _categoriesCacheTime = now;
  return _categoriesCache;
}

function bustCategoryCache() {
  _categoriesCache     = null;
  _categoriesCacheTime = 0;
}

/**
 * Classify the path of a follower→brand transaction.
 *
 * Returns:
 *   { path: 'direct'|'influencer_direct'|'influencer_attributed',
 *     influencer_id: uuid|null }
 *
 *   - 'influencer_direct'     — the transaction carries an active
 *     campaign_influencer_id (the follower came in via the inflx.in/s/...
 *     redirect chain). influencer_id is resolved from the CI row.
 *   - 'influencer_attributed' — no CI on this txn, but an unexpired
 *     attribution_clicks row exists for (follower, this brand). Returns
 *     the most-recent unexpired row's influencer_id.
 *   - 'direct'                — neither — pure walk-in / direct buy.
 *
 * @param {object} client   pg client (transaction-bound or pool)
 * @param {object} args
 * @param {string} args.followerId
 * @param {string} args.brandId
 * @param {string|null} args.campaignInfluencerId
 */
async function classifyPath(client, { followerId, brandId, campaignInfluencerId, storeInfluencerId, productId }) {
  // 1. STORE CONTEXT (highest priority — "store beats window"). Hijack-proof:
  //    resolveStoreContext only returns the influencer when the product is
  //    ACTIVELY stocked by them AND they're still contracted with the brand.
  //    Maps to the strongest influencer fee tier (influencer_direct = path_b).
  //    DORMANT until a purchase path threads storeInfluencerId through.
  if (storeInfluencerId && productId) {
    const inf = await influencerStore.resolveStoreContext(
      { influencerId: storeInfluencerId, productId, brandId }, client
    );
    if (inf) return { path: 'influencer_direct', influencer_id: inf, store_context: true };
  }
  // 2. LIVE LINK — this transaction carries an active campaign_influencer_id.
  if (campaignInfluencerId) {
    const { rows } = await client.query(
      `SELECT influencer_id FROM campaign_influencers WHERE id = $1`,
      [campaignInfluencerId]
    );
    return { path: 'influencer_direct', influencer_id: rows[0]?.influencer_id || null };
  }
  const { rows } = await client.query(
    `SELECT influencer_id
       FROM attribution_clicks
      WHERE follower_id = $1
        AND brand_id    = $2
        AND expires_at  > now()
      ORDER BY expires_at DESC
      LIMIT 1`,
    [followerId, brandId]
  );
  if (rows[0]) return { path: 'influencer_attributed', influencer_id: rows[0].influencer_id };
  return { path: 'direct', influencer_id: null };
}

/**
 * Compute the L3 marketplace fee for a single follower transaction.
 *
 * @param {object} args
 * @param {object} args.client                pg client (transaction-bound or pool)
 * @param {string} args.brandId
 * @param {string} args.followerId
 * @param {string|null} args.campaignInfluencerId
 * @param {string|null} args.brandCategory    brands.category (varchar)
 * @param {number} args.netAmount             rupees
 *
 * Returns: {
 *   fee_amount,   // rupees, 2-decimal
 *   fee_pct,      // applied percentage
 *   path,         // 'direct'|'influencer_direct'|'influencer_attributed'
 *   category_key, // normalized key actually used (null if fell back)
 *   source,       // 'category_lookup' | 'brand_legacy_fallback'
 *   influencer_id // uuid|null — for attribution-commission downstream
 * }
 */
async function computeL3OnFollowerTxn(args) {
  const { client, brandId, followerId, campaignInfluencerId, brandCategory, netAmount,
          storeInfluencerId = null, productId = null } = args;
  const amt = parseFloat(netAmount) || 0;
  const { path, influencer_id } = await classifyPath(client, {
    followerId, brandId, campaignInfluencerId, storeInfluencerId, productId,
  });

  const categoryKey = _normalizeCategoryKey(brandCategory);
  const categories  = await _loadCategories();
  const cat         = categoryKey ? categories.get(categoryKey) : null;

  // Wave 1 — per-brand commerce-commission override.
  // If brand has a value in commerce_commission_override_pct, that wins
  // over the category × path lookup. Lets ops grant special rates to
  // strategic brands without editing the category table. Defensive: if
  // the column doesn't exist (pre-M073) the read returns undefined →
  // falls through to category lookup.
  const { rows: brandRows } = await client.query(
    `SELECT COALESCE(platform_fee_pct, 8.00) AS legacy_pct,
            commerce_commission_override_pct AS override_pct
       FROM brands WHERE id = $1`,
    [brandId]
  );
  const brandOverridePct = brandRows[0]?.override_pct;

  let fee_pct, source, used_category_key;
  if (brandOverridePct != null) {
    fee_pct            = parseFloat(brandOverridePct);
    source             = 'brand_override';
    used_category_key  = categoryKey;
  } else if (cat && cat.active) {
    fee_pct =
      path === 'direct'            ? cat.path_a_pct :
      path === 'influencer_direct' ? cat.path_b_pct :
      /* influencer_attributed */    cat.path_c_pct;
    source             = 'category_lookup';
    used_category_key  = categoryKey;
  } else {
    // Fallback: legacy brands.platform_fee_pct (defaults to 8%)
    fee_pct            = parseFloat(brandRows[0]?.legacy_pct || 8.00);
    source             = 'brand_legacy_fallback';
    used_category_key  = null;
  }

  const fee_amount = parseFloat((amt * fee_pct / 100).toFixed(2));
  return {
    fee_amount,
    fee_pct,
    path,
    category_key:  used_category_key,
    source,
    influencer_id,
  };
}

/**
 * Wave 1 — per-category commerce-commission return window.
 *
 * Returns the number of days the platform should hold an influencer's
 * commerce commission before releasing it to their wallet (Wave 3
 * cron will read this). Defaults to the global
 * payment_config.return_window_days (which itself defaults to 30) if
 * the category isn't found or the per-category column is null.
 *
 * @param {string} categoryKey  e.g. 'restaurant', 'fashion'
 * @param {pg.Client} [client]  optional db client
 * @returns {Promise<number>}   days to hold (positive integer)
 */
async function getReturnWindowForCategory(categoryKey, client = db) {
  if (categoryKey) {
    try {
      const { rows } = await client.query(
        `SELECT return_window_days FROM categories
          WHERE category_key = $1 AND active = true
          LIMIT 1`,
        [_normalizeCategoryKey(categoryKey)]
      );
      const days = rows[0]?.return_window_days;
      if (days != null) return parseInt(days, 10);
    } catch (err) {
      // pre-M073: column doesn't exist → fall through to global
    }
  }
  const cfg = await paymentConfigSvc.getConfig();
  return parseInt(cfg.returnWindowDays ?? 30, 10);
}

module.exports = {
  // L1 — SaaS subscription
  computeL1Renewal,
  // L2 — escrow / Campaign Protection Fee
  lookupEscrowFeeTier,
  resolveEscrowFeePct,
  computeEscrowFeeBase,
  lockEscrowFeeAtPublish,
  getLockedEscrowFeePct,
  // L3 helpers
  getReturnWindowForCategory,
  bustEscrowTierCache,
  // L3 — marketplace fee per category × path
  classifyPath,
  computeL3OnFollowerTxn,
  bustCategoryCache,
  // Exposed for tests
  _normalizeCategoryKey,
  CATEGORY_ALIASES,
};
