'use strict';

/**
 * features.controller.js — Phase A10 admin endpoints.
 *
 * Catalog CRUD + per-tier mapping (tier_features) upsert/list +
 * subscription_prices CRUD. All admin-gated; mutations require
 * superadmin (these change platform-wide behavior).
 *
 * Routes wired in src/routes/admin.routes.js:
 *
 *   GET    /v1/admin/features                    listFeatures
 *   POST   /v1/admin/features                    createFeature
 *   PATCH  /v1/admin/features/:feature_key       updateFeature
 *   DELETE /v1/admin/features/:feature_key       softDeleteFeature
 *
 *   GET    /v1/admin/tiers/:tier_key/features    listTierFeatures
 *   PUT    /v1/admin/tiers/:tier_key/features    upsertTierFeatures (bulk)
 *
 *   GET    /v1/admin/tiers/:tier_key/prices      listTierPrices
 *   POST   /v1/admin/tiers/:tier_key/prices      createPrice
 *   PATCH  /v1/admin/prices/:price_id            updatePrice
 *   DELETE /v1/admin/prices/:price_id            softDeletePrice
 *
 *   GET    /v1/admin/brands/:id/overrides        listBrandOverrides (A14)
 *   PUT    /v1/admin/brands/:id/overrides        upsertBrandOverrides (A14 bulk)
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const entitlementsService = require('../services/entitlements.service');

// ── features catalog ────────────────────────────────────────────────────────

const listFeatures = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, feature_key, label, category, feature_type, unit,
            default_quota, is_enforced, active, sort_order, description,
            updated_at
       FROM features
       ORDER BY sort_order, label`
  );
  return success(res, { features: rows });
});

const createFeature = asyncHandler(async (req, res) => {
  const { feature_key, label, category, feature_type, unit, default_quota,
          sort_order, description, is_enforced } = req.body;
  if (!feature_key || !label || !category || !feature_type) {
    throw new AppError('VALIDATION_ERROR', 'feature_key, label, category, feature_type are required', 422);
  }
  if (!/^[a-z0-9_]+$/.test(feature_key)) {
    throw new AppError('VALIDATION_ERROR', 'feature_key must be lowercase a-z, 0-9, _', 422, 'feature_key');
  }
  const { rows } = await db.query(
    `INSERT INTO features
       (feature_key, label, category, feature_type, unit, default_quota,
        is_enforced, sort_order, description, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [feature_key, label, category, feature_type, unit || null,
     default_quota || null, !!is_enforced, sort_order || 0, description || null,
     req.user?.sub || null]
  );
  entitlementsService.bustCatalogCache();
  return success(res, { feature: rows[0] }, 201);
});

const updateFeature = asyncHandler(async (req, res) => {
  const { feature_key } = req.params;
  const allowed = ['label','category','feature_type','unit','default_quota',
                   'is_enforced','sort_order','description','active'];
  const sets = [];
  const params = [];
  let i = 1;
  for (const k of allowed) {
    if (k in req.body) {
      sets.push(`${k} = $${i++}`);
      params.push(req.body[k]);
    }
  }
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'no editable fields', 422);
  params.push(req.user?.sub || null);
  sets.push(`updated_by = $${i++}`);
  params.push(feature_key);
  const { rows } = await db.query(
    `UPDATE features SET ${sets.join(', ')} WHERE feature_key = $${i} RETURNING *`,
    params
  );
  if (!rows.length) throw new AppError('NOT_FOUND', `feature ${feature_key} not found`, 404);
  entitlementsService.bustCatalogCache();
  return success(res, { feature: rows[0] });
});

const softDeleteFeature = asyncHandler(async (req, res) => {
  const { feature_key } = req.params;
  const { rows } = await db.query(
    `UPDATE features SET active = false, updated_by = $1
      WHERE feature_key = $2 RETURNING feature_key`,
    [req.user?.sub || null, feature_key]
  );
  if (!rows.length) throw new AppError('NOT_FOUND', `feature ${feature_key} not found`, 404);
  entitlementsService.bustCatalogCache();
  return success(res, { feature_key, active: false });
});

// ── tier_features ───────────────────────────────────────────────────────────

const listTierFeatures = asyncHandler(async (req, res) => {
  const { tier_key } = req.params;
  const { rows: tierRows } = await db.query(
    `SELECT id FROM subscription_tiers WHERE tier_key = $1`, [tier_key]
  );
  if (!tierRows.length) throw new AppError('NOT_FOUND', `tier ${tier_key} not found`, 404);
  const tierId = tierRows[0].id;

  const { rows } = await db.query(
    `SELECT f.feature_key, f.label, f.category, f.feature_type, f.unit, f.default_quota,
            f.is_enforced, f.sort_order, f.description,
            COALESCE(tf.included, false)         AS included,
            tf.quota_value,
            COALESCE(tf.config, '{}'::jsonb)     AS config,
            tf.notes
       FROM features f
       LEFT JOIN tier_features tf ON tf.feature_id = f.id AND tf.tier_id = $1
      WHERE f.active = true
      ORDER BY f.sort_order, f.label`,
    [tierId]
  );
  return success(res, { tier_key, features: rows });
});

const upsertTierFeatures = asyncHandler(async (req, res) => {
  const { tier_key } = req.params;
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items) throw new AppError('VALIDATION_ERROR', 'items[] required', 422);

  const { rows: tierRows } = await db.query(
    `SELECT id FROM subscription_tiers WHERE tier_key = $1`, [tier_key]
  );
  if (!tierRows.length) throw new AppError('NOT_FOUND', `tier ${tier_key} not found`, 404);
  const tierId = tierRows[0].id;

  await db.query('BEGIN');
  try {
    for (const item of items) {
      if (!item.feature_key) continue;
      const { rows: fRows } = await db.query(
        `SELECT id, feature_type FROM features WHERE feature_key = $1`,
        [item.feature_key]
      );
      if (!fRows.length) continue;
      const fId   = fRows[0].id;
      const fType = fRows[0].feature_type;

      // Sanitize: quota_value only for quota-type; config only for config-type
      const quotaValue = fType === 'quota'  && item.quota_value != null ? parseFloat(item.quota_value) : null;
      const config     = fType === 'config' && item.config              ? item.config                    : {};

      await db.query(
        `INSERT INTO tier_features (tier_id, feature_id, included, quota_value, config, notes, updated_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (tier_id, feature_id) DO UPDATE
           SET included    = EXCLUDED.included,
               quota_value = EXCLUDED.quota_value,
               config      = EXCLUDED.config,
               notes       = EXCLUDED.notes,
               updated_by  = EXCLUDED.updated_by`,
        [tierId, fId, !!item.included, quotaValue, JSON.stringify(config), item.notes || null, req.user?.sub || null]
      );
    }
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }

  entitlementsService.bustCatalogCache();
  return success(res, { tier_key, updated: items.length });
});

// ── subscription_prices ─────────────────────────────────────────────────────

const listTierPrices = asyncHandler(async (req, res) => {
  const { tier_key } = req.params;
  const { rows: tierRows } = await db.query(
    `SELECT id FROM subscription_tiers WHERE tier_key = $1`, [tier_key]
  );
  if (!tierRows.length) throw new AppError('NOT_FOUND', `tier ${tier_key} not found`, 404);
  const { rows } = await db.query(
    `SELECT id, billing_period, price_inr, active, sort_order, updated_at
       FROM subscription_prices
      WHERE tier_id = $1
      ORDER BY billing_period`,
    [tierRows[0].id]
  );
  return success(res, { tier_key, prices: rows });
});

const createPrice = asyncHandler(async (req, res) => {
  const { tier_key } = req.params;
  const { billing_period, price_inr, active, sort_order } = req.body;
  if (!billing_period || price_inr == null) {
    throw new AppError('VALIDATION_ERROR', 'billing_period + price_inr required', 422);
  }
  if (!['monthly','yearly'].includes(billing_period)) {
    throw new AppError('VALIDATION_ERROR', 'billing_period must be monthly|yearly', 422, 'billing_period');
  }
  const amt = parseFloat(price_inr);
  if (!isFinite(amt) || amt < 0) {
    throw new AppError('VALIDATION_ERROR', 'price_inr must be >= 0', 422, 'price_inr');
  }
  const { rows: tierRows } = await db.query(
    `SELECT id FROM subscription_tiers WHERE tier_key = $1`, [tier_key]
  );
  if (!tierRows.length) throw new AppError('NOT_FOUND', `tier ${tier_key} not found`, 404);

  const { rows } = await db.query(
    `INSERT INTO subscription_prices (tier_id, billing_period, price_inr, active, sort_order, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tier_id, billing_period) DO UPDATE
       SET price_inr  = EXCLUDED.price_inr,
           active     = EXCLUDED.active,
           sort_order = EXCLUDED.sort_order,
           updated_by = EXCLUDED.updated_by
     RETURNING *`,
    [tierRows[0].id, billing_period, amt, active !== false, sort_order || 0, req.user?.sub || null]
  );
  return success(res, { price: rows[0] }, 201);
});

const updatePrice = asyncHandler(async (req, res) => {
  const { price_id } = req.params;
  const allowed = ['price_inr','active','sort_order'];
  const sets = [];
  const params = [];
  let i = 1;
  for (const k of allowed) {
    if (k in req.body) {
      sets.push(`${k} = $${i++}`);
      params.push(req.body[k]);
    }
  }
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'no editable fields', 422);
  params.push(req.user?.sub || null); sets.push(`updated_by = $${i++}`);
  params.push(price_id);
  const { rows } = await db.query(
    `UPDATE subscription_prices SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  if (!rows.length) throw new AppError('NOT_FOUND', `price ${price_id} not found`, 404);
  return success(res, { price: rows[0] });
});

const softDeletePrice = asyncHandler(async (req, res) => {
  const { price_id } = req.params;
  const { rows } = await db.query(
    `UPDATE subscription_prices SET active = false, updated_by = $1
      WHERE id = $2 RETURNING id`,
    [req.user?.sub || null, price_id]
  );
  if (!rows.length) throw new AppError('NOT_FOUND', `price ${price_id} not found`, 404);
  return success(res, { id: price_id, active: false });
});

// ── brand_feature_overrides (A14) ───────────────────────────────────────────

const listBrandOverrides = asyncHandler(async (req, res) => {
  const { id: brandId } = req.params;

  // Resolve brand + its active tier (or fall back to free) so the UI can
  // show tier defaults alongside any override rows.
  const { rows: brandRows } = await db.query(
    `SELECT id FROM brands WHERE id = $1`, [brandId]
  );
  if (!brandRows.length) throw new AppError('NOT_FOUND', `brand ${brandId} not found`, 404);

  const tierId = await entitlementsService.getActiveTierId(db, brandId);
  const { rows: tierRows } = await db.query(
    `SELECT tier_key FROM subscription_tiers WHERE id = $1 LIMIT 1`, [tierId]
  );
  const tierKey = tierRows[0]?.tier_key || 'free';

  // Catalog + tier defaults + per-brand override in one query.
  const { rows } = await db.query(
    `SELECT f.id AS feature_id, f.feature_key, f.label, f.category,
            f.feature_type, f.unit, f.default_quota, f.is_enforced,
            f.sort_order, f.description,
            COALESCE(tf.included, false)        AS tier_included,
            tf.quota_value                       AS tier_quota_value,
            COALESCE(tf.config, '{}'::jsonb)    AS tier_config,
            bo.included                          AS override_included,
            bo.quota_value                       AS override_quota_value,
            bo.config                            AS override_config,
            bo.notes                             AS override_notes,
            bo.updated_at                        AS override_updated_at
       FROM features f
       LEFT JOIN tier_features tf
              ON tf.feature_id = f.id AND tf.tier_id = $1
       LEFT JOIN brand_feature_overrides bo
              ON bo.feature_id = f.id AND bo.brand_id = $2
      WHERE f.active = true
      ORDER BY f.sort_order, f.label`,
    [tierId, brandId]
  );

  const features = rows.map(r => ({
    feature_key:  r.feature_key,
    label:        r.label,
    category:     r.category,
    feature_type: r.feature_type,
    unit:         r.unit,
    description:  r.description,
    is_enforced:  r.is_enforced,
    tier_default: {
      included:    r.tier_included,
      quota_value: r.tier_quota_value != null ? parseFloat(r.tier_quota_value) : r.default_quota,
      config:      r.tier_config || {},
    },
    override: r.override_included == null ? null : {
      included:    r.override_included,
      quota_value: r.override_quota_value != null ? parseFloat(r.override_quota_value) : null,
      config:      r.override_config || {},
      notes:       r.override_notes,
      updated_at:  r.override_updated_at,
    },
  }));

  return success(res, { brand_id: brandId, tier_id: tierId, tier_key: tierKey, features });
});

const upsertBrandOverrides = asyncHandler(async (req, res) => {
  const { id: brandId } = req.params;
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items) throw new AppError('VALIDATION_ERROR', 'items[] required', 422);

  // Validate brand exists.
  const { rows: brandRows } = await db.query(
    `SELECT id FROM brands WHERE id = $1`, [brandId]
  );
  if (!brandRows.length) throw new AppError('NOT_FOUND', `brand ${brandId} not found`, 404);

  let upserted = 0;
  let deleted  = 0;

  await db.query('BEGIN');
  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || !item.feature_key) continue;

      const { rows: fRows } = await db.query(
        `SELECT id, feature_type FROM features WHERE feature_key = $1`,
        [item.feature_key]
      );
      if (!fRows.length) {
        throw new AppError('VALIDATION_ERROR', `Unknown feature_key: ${item.feature_key}`, 422, `items[${i}].feature_key`);
      }
      const fId   = fRows[0].id;
      const fType = fRows[0].feature_type;

      if (item.override === null) {
        // Revert to tier default — delete the override row if present.
        const { rowCount } = await db.query(
          `DELETE FROM brand_feature_overrides WHERE brand_id = $1 AND feature_id = $2`,
          [brandId, fId]
        );
        if (rowCount) deleted += 1;
        continue;
      }

      const o = item.override || {};
      const quotaValue = fType === 'quota'  && o.quota_value != null ? parseFloat(o.quota_value) : null;
      const config     = fType === 'config' && o.config              ? o.config                    : {};

      await db.query(
        `INSERT INTO brand_feature_overrides
           (brand_id, feature_id, included, quota_value, config, notes, updated_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (brand_id, feature_id) DO UPDATE
           SET included    = EXCLUDED.included,
               quota_value = EXCLUDED.quota_value,
               config      = EXCLUDED.config,
               notes       = EXCLUDED.notes,
               updated_by  = EXCLUDED.updated_by,
               updated_at  = now()`,
        [brandId, fId, !!o.included, quotaValue, JSON.stringify(config), o.notes || null, req.user?.sub || null]
      );
      upserted += 1;
    }
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }

  entitlementsService.bustCatalogCache();
  return success(res, { brand_id: brandId, upserted, deleted });
});

module.exports = {
  listFeatures,
  createFeature,
  updateFeature,
  softDeleteFeature,
  listTierFeatures,
  upsertTierFeatures,
  listTierPrices,
  createPrice,
  updatePrice,
  softDeletePrice,
  listBrandOverrides,
  upsertBrandOverrides,
};
