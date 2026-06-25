'use strict';

/**
 * adminSections.controller.js — Admin Section Manager (Creator Vibe, Phase B).
 *
 * Curate the follower section engine: list / save (publish) / delete the shelves
 * in section_config (Phase A). Publish is instant — saving busts the engine's
 * in-process cache on the handling instance (others converge within the TTL).
 *
 * Contract: features/admin-section-manager/. Admin-only (requireAnyAdminRole).
 */

const db = require('../config/db');
const cache = require('../utils/ttlCache');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const SCREENS = ['home', 'category', 'offers', 'creator_store', 'creator_category', 'business'];
const SCOPE_TYPES = ['global', 'city', 'vertical'];
const SHELF_TYPES = ['creators', 'nav_tiles', 'offers', 'products', 'brands', 'mixed', 'controls', 'tiles', 'category_rail', 'restaurant_list'];
const ITEM_TYPES = ['brands', 'products', 'offers'];

function assertScreen(screen) {
  if (!SCREENS.includes(screen)) throw new AppError('NOT_FOUND', `Unknown screen '${screen}'`, 404);
}

// GET /v1/admin/sections/:screen?scope_type=&scope_value=
const listSections = asyncHandler(async (req, res) => {
  const { screen } = req.params;
  assertScreen(screen);
  const scopeType = req.query.scope_type || 'global';
  if (!SCOPE_TYPES.includes(scopeType)) throw new AppError('VALIDATION_ERROR', 'bad scope_type', 422, 'scope_type');
  const scopeValue = req.query.scope_value || null;

  const { rows } = await db.query(
    `SELECT id, screen, scope_type, scope_value, shelf_key, title, shelf_type,
            rule, item_type, category_key, item_limit, position, enabled,
            pinned_ref, config_json, created_at, updated_at
       FROM section_config
      WHERE screen = $1 AND scope_type = $2
        AND ($3::text IS NULL OR scope_value = $3)
      ORDER BY position ASC, created_at ASC`,
    [screen, scopeType, scopeValue]
  );
  return success(res, { shelves: rows });
});

function validateShelf(s) {
  if (!s || typeof s !== 'object') throw new AppError('VALIDATION_ERROR', 'shelf must be an object', 422);
  if (!s.shelf_key) throw new AppError('VALIDATION_ERROR', 'shelf_key required', 422, 'shelf_key');
  if (!s.title) throw new AppError('VALIDATION_ERROR', 'title required', 422, 'title');
  if (!SHELF_TYPES.includes(s.shelf_type)) throw new AppError('VALIDATION_ERROR', `bad shelf_type '${s.shelf_type}'`, 422, 'shelf_type');
  if (!s.rule) throw new AppError('VALIDATION_ERROR', 'rule required', 422, 'rule');
  if (s.item_type != null && !ITEM_TYPES.includes(s.item_type)) throw new AppError('VALIDATION_ERROR', `bad item_type '${s.item_type}'`, 422, 'item_type');
  const lim = Number(s.item_limit);
  if (!Number.isInteger(lim) || lim < 0 || lim > 50) throw new AppError('VALIDATION_ERROR', 'item_limit must be 0–50', 422, 'item_limit');
  const pos = Number(s.position);
  if (!Number.isInteger(pos) || pos < 0) throw new AppError('VALIDATION_ERROR', 'position must be ≥ 0', 422, 'position');
}

// PUT /v1/admin/sections/:screen — upsert/publish the shelves for a scope.
// Body: { scope_type, scope_value, shelves:[…] }. Upsert-only (never implicit
// delete); removal is the explicit DELETE. Transactional (all-or-nothing).
const saveSections = asyncHandler(async (req, res) => {
  const { screen } = req.params;
  assertScreen(screen);
  const scopeType = req.body.scope_type || 'global';
  if (!SCOPE_TYPES.includes(scopeType)) throw new AppError('VALIDATION_ERROR', 'bad scope_type', 422, 'scope_type');
  const scopeValue = req.body.scope_value || null;
  const shelves = Array.isArray(req.body.shelves) ? req.body.shelves : null;
  if (!shelves) throw new AppError('VALIDATION_ERROR', 'shelves[] required', 422, 'shelves');
  shelves.forEach(validateShelf);

  const saved = await db.withTransaction(async (tx) => {
    const out = [];
    for (const s of shelves) {
      const cfg = s.config_json != null ? JSON.stringify(s.config_json) : null;
      if (s.id) {
        // Update an existing shelf by id (scope-pinned to prevent cross-scope edits).
        const { rows } = await tx.query(
          `UPDATE section_config SET
             title=$2, shelf_type=$3, rule=$4, item_type=$5, category_key=$6,
             item_limit=$7, position=$8, enabled=$9, pinned_ref=$10,
             config_json=COALESCE($11::jsonb, config_json), updated_at=now()
           WHERE id=$1 AND screen=$12 AND scope_type=$13
           RETURNING id`,
          [s.id, s.title, s.shelf_type, s.rule, s.item_type || null, s.category_key || null,
           Number(s.item_limit), Number(s.position), s.enabled !== false, s.pinned_ref || null,
           cfg, screen, scopeType]
        );
        if (!rows[0]) throw new AppError('NOT_FOUND', `shelf ${s.id} not found in this scope`, 404);
        out.push(rows[0].id);
      } else {
        // Insert, or update the existing instance (uniq_section_instance).
        const { rows } = await tx.query(
          `INSERT INTO section_config
             (screen, scope_type, scope_value, shelf_key, title, shelf_type, rule,
              item_type, category_key, item_limit, position, enabled, pinned_ref, config_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (screen, scope_type, COALESCE(scope_value,''), shelf_key,
                        COALESCE(category_key,''), COALESCE(item_type,''))
           DO UPDATE SET title=EXCLUDED.title, shelf_type=EXCLUDED.shelf_type,
             rule=EXCLUDED.rule, item_limit=EXCLUDED.item_limit,
             position=EXCLUDED.position, enabled=EXCLUDED.enabled,
             pinned_ref=EXCLUDED.pinned_ref, config_json=EXCLUDED.config_json,
             updated_at=now()
           RETURNING id`,
          [screen, scopeType, scopeValue, s.shelf_key, s.title, s.shelf_type, s.rule,
           s.item_type || null, s.category_key || null, Number(s.item_limit),
           Number(s.position), s.enabled !== false, s.pinned_ref || null, cfg]
        );
        out.push(rows[0].id);
      }
    }
    return out;
  });

  cache.clear(); // publish = instant on this instance (others converge ≤ TTL)

  const { rows } = await db.query(
    `SELECT id, screen, scope_type, scope_value, shelf_key, title, shelf_type,
            rule, item_type, category_key, item_limit, position, enabled,
            pinned_ref, config_json, updated_at
       FROM section_config
      WHERE screen=$1 AND scope_type=$2 AND ($3::text IS NULL OR scope_value=$3)
      ORDER BY position ASC, created_at ASC`,
    [screen, scopeType, scopeValue]
  );
  return success(res, { shelves: rows, saved_count: saved.length });
});

// DELETE /v1/admin/sections/:id
const deleteSection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await db.query(`DELETE FROM section_config WHERE id=$1 RETURNING id`, [id]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'section not found', 404);
  cache.clear();
  return success(res, { deleted: rows[0].id });
});

module.exports = { listSections, saveSections, deleteSection };
