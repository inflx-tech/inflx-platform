'use strict';

/**
 * entitlements.service.js — Phase A10 + A14
 *
 * Resolves a brand's effective entitlements (what features they have,
 * what quotas, what config). Three-layer resolution:
 *
 *   1. brand → active subscription → tier_id
 *   2. tier_features (tier_id, feature_id) for every catalog feature
 *   3. brand_feature_overrides (brand_id, feature_id) — A14 override
 *      layer. Presence of a row supersedes the tier_features row
 *      entirely (full replacement, not field-level merge). Admin
 *      edits these from /admin/brands/[id] → Feature Overrides card.
 *   Final fall back: features.default_quota / included=false if no row
 *   in any of the above.
 *
 * The override fetch is defensive against pre-M069 deploys: if the
 * brand_feature_overrides table doesn't exist yet (pg error 42P01),
 * the call silently returns an empty array and brand entitlements
 * fall through to tier defaults. Once M069 applies, overrides are
 * picked up transparently.
 */

const db = require('../config/db');

const CACHE_TTL_MS = 60_000;
let _catalogCache    = null;
let _catalogCacheT   = 0;

async function _loadCatalog(client = db) {
  const now = Date.now();
  if (_catalogCache && (now - _catalogCacheT) < CACHE_TTL_MS) return _catalogCache;
  const { rows } = await client.query(
    `SELECT id, feature_key, label, category, feature_type, unit,
            default_quota, is_enforced, active, sort_order, description
       FROM features
      WHERE active = true
      ORDER BY sort_order`
  );
  _catalogCache = {
    byId:  new Map(rows.map(r => [r.id, r])),
    byKey: new Map(rows.map(r => [r.feature_key, r])),
    list:  rows,
  };
  _catalogCacheT = now;
  return _catalogCache;
}

function bustCatalogCache() {
  _catalogCache  = null;
  _catalogCacheT = 0;
}

/**
 * Look up a brand's active subscription tier_id.
 * Returns null if the brand has no active subscription (caller should
 * treat as Free tier — lazy create handled by quotaCheck middleware).
 */
async function getActiveTierId(client, brandId) {
  const { rows } = await client.query(
    `SELECT tier_id FROM brand_subscriptions
      WHERE brand_id = $1 AND status = 'active'
      LIMIT 1`,
    [brandId]
  );
  if (rows[0]) return rows[0].tier_id;
  // Fall back to free tier
  const { rows: free } = await client.query(
    `SELECT id FROM subscription_tiers WHERE tier_key = 'free' LIMIT 1`
  );
  return free[0]?.id || null;
}

/**
 * Effective entitlements for a brand.
 *
 * Returns:
 *   {
 *     tier_id,
 *     tier_key,
 *     entitlements: Map<feature_key, {
 *       included, quota_value, config, feature_type,
 *       is_enforced, category, label
 *     }>
 *   }
 */
async function getEntitlements(client, brandId) {
  const c = client || db;
  const catalog = await _loadCatalog(c);

  const tierId = await getActiveTierId(c, brandId);
  if (!tierId) {
    // No tier resolved — return all features as not-included with catalog defaults
    const ents = new Map();
    for (const f of catalog.list) {
      ents.set(f.feature_key, {
        included:     false,
        quota_value:  f.default_quota,
        config:       {},
        feature_type: f.feature_type,
        is_enforced:  f.is_enforced,
        category:     f.category,
        label:        f.label,
      });
    }
    return { tier_id: null, tier_key: 'free', entitlements: ents };
  }

  const { rows: tierRows } = await c.query(
    `SELECT tier_key FROM subscription_tiers WHERE id = $1 LIMIT 1`,
    [tierId]
  );
  const tierKey = tierRows[0]?.tier_key || 'free';

  const { rows: tfRows } = await c.query(
    `SELECT tf.feature_id, tf.included, tf.quota_value, tf.config
       FROM tier_features tf
      WHERE tf.tier_id = $1`,
    [tierId]
  );
  const tfByFid = new Map(tfRows.map(r => [r.feature_id, r]));

  // A14 — third layer: per-brand overrides supersede tier defaults
  // entirely when present. Defensive against pre-M069 (table missing).
  const overrideRows = await _getBrandOverrides(c, brandId);
  const ovByFid = new Map(overrideRows.map(r => [r.feature_id, r]));

  const ents = new Map();
  for (const f of catalog.list) {
    const ov = ovByFid.get(f.id);
    const tf = tfByFid.get(f.id);
    // Override wins entirely if present; else tier_features; else catalog default.
    const src = ov || tf;
    ents.set(f.feature_key, {
      included:     src ? src.included : false,
      quota_value:  src && src.quota_value != null ? parseFloat(src.quota_value) : f.default_quota,
      config:       src ? (src.config || {}) : {},
      feature_type: f.feature_type,
      is_enforced:  f.is_enforced,
      category:     f.category,
      label:        f.label,
      // A14 — surface override provenance so admin GET /overrides
      // can render the "Overridden" badge without a second query.
      _is_overridden: !!ov,
    });
  }

  return { tier_id: tierId, tier_key: tierKey, entitlements: ents };
}

/**
 * Fetch per-brand override rows. Defensive: pre-M069 the table doesn't
 * exist (pg error code 42P01, "undefined table") — return [] silently
 * so the deploy is behaviour-inert until the migration applies.
 */
async function _getBrandOverrides(c, brandId) {
  try {
    const { rows } = await c.query(
      `SELECT feature_id, included, quota_value, config
         FROM brand_feature_overrides
        WHERE brand_id = $1`,
      [brandId]
    );
    return rows;
  } catch (e) {
    if (e && e.code === '42P01') return [];
    throw e;
  }
}

/**
 * Boolean check: does the brand's active tier grant this feature?
 * Returns true for non-enforced features (so flipping is_enforced=true
 * is the only switch needed to make a gate go live).
 */
async function hasFeature(client, brandId, featureKey) {
  const c = client || db;
  const catalog = await _loadCatalog(c);
  const f = catalog.byKey.get(featureKey);
  if (!f) return true;                  // unknown feature → ungated (defensive)
  if (!f.is_enforced) return true;      // not yet wired for enforcement
  const { entitlements } = await getEntitlements(c, brandId);
  const e = entitlements.get(featureKey);
  return !!(e && e.included);
}

/**
 * Throw-on-miss variant of hasFeature — reusable boolean gate for
 * controllers (Phase A12.4+). If the brand has the feature (or it's
 * not yet enforced), returns silently. Otherwise throws an AppError
 * with 'FEATURE_NOT_AVAILABLE' + structured upgrade_to payload.
 *
 * @param {object} client    pg client (or null for default pool)
 * @param {string} brandId
 * @param {string} featureKey
 * @param {object} [opts]    { label? }  human-readable label for the error message
 */
async function requireFeature(client, brandId, featureKey, opts = {}) {
  const AppError = require('../utils/AppError');
  const c = client || db;
  const allowed = await hasFeature(c, brandId, featureKey);
  if (allowed) return;

  // Resolve upgrade suggestion: tiers that DO grant this feature.
  const { rows: upgrades } = await c.query(
    `SELECT t.tier_key
       FROM subscription_tiers t
       JOIN tier_features tf ON tf.tier_id = t.id
       JOIN features f       ON f.id       = tf.feature_id
      WHERE t.active        = true
        AND f.feature_key   = $1
        AND tf.included     = true
      ORDER BY t.sort_order`,
    [featureKey]
  );

  const catalog = await _loadCatalog(c);
  const f = catalog.byKey.get(featureKey);
  const label = opts.label || (f && f.label) || featureKey;

  throw new AppError(
    'FEATURE_NOT_AVAILABLE',
    `${label} is not available on your current plan. Upgrade to use it.`,
    422,
    featureKey,
    {
      feature_key: featureKey,
      upgrade_to:  upgrades.map(r => r.tier_key),
    }
  );
}

/**
 * Quota lookup for a feature (returns the effective limit; -1 = unlimited).
 * For non-quota features returns null.
 */
async function quotaFor(client, brandId, featureKey) {
  const c = client || db;
  const { entitlements } = await getEntitlements(c, brandId);
  const e = entitlements.get(featureKey);
  return e ? e.quota_value : null;
}

/**
 * Config lookup for a config-type feature. Returns the jsonb blob from
 * tier_features.config, or {} if the feature is not enforced / unknown.
 *
 * Honours is_enforced so callers can defensively pass-through when the
 * feature hasn't been wired for real gating yet.
 */
async function configFor(client, brandId, featureKey) {
  const c = client || db;
  const catalog = await _loadCatalog(c);
  const f = catalog.byKey.get(featureKey);
  if (!f) return {};
  if (!f.is_enforced) return {};
  const { entitlements } = await getEntitlements(c, brandId);
  const e = entitlements.get(featureKey);
  return (e && e.config) ? e.config : {};
}

/**
 * Plain object form of getEntitlements — for JSON responses.
 */
async function getEntitlementsPlain(client, brandId) {
  const r = await getEntitlements(client || db, brandId);
  const ent = {};
  for (const [key, val] of r.entitlements.entries()) ent[key] = val;
  return { tier_id: r.tier_id, tier_key: r.tier_key, entitlements: ent };
}

module.exports = {
  getEntitlements,
  getEntitlementsPlain,
  hasFeature,
  requireFeature,
  quotaFor,
  configFor,
  getActiveTierId,
  bustCatalogCache,
};
