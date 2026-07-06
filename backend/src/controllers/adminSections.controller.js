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

const SCREENS = ['home', 'category', 'offers', 'creator_store', 'creator_category', 'business', 'page'];
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
            pinned_ref, config_json, starts_at, ends_at, created_at, updated_at
       FROM section_config
      WHERE screen = $1 AND scope_type = $2
        AND ($3::text IS NULL OR scope_value = $3)
      ORDER BY position ASC, created_at ASC`,
    [screen, scopeType, scopeValue]
  );
  return success(res, { shelves: rows });
});

// ── Scheduling + config_json shape validation (mig 124, features/section-scheduling/) ──

const TILE_STYLES = ['carousel', 'featured', 'grid', 'banner', 'mosaic', 'themed_rail', 'hero_slider', 'strip', 'split', 'fullbleed'];
const TAP_TYPES = ['grid', 'category', 'page'];
const PRESENTATION_TYPES = ['banner', 'hero_tiles'];
const CONFIG_MAX_BYTES = 20000;

function bad(msg, field) { throw new AppError('VALIDATION_ERROR', msg, 422, field); }

// Accepts ISO-8601 (or anything Date can parse unambiguously); null/undefined = unbounded.
function parseTs(value, field) {
  if (value == null || value === '') return null;
  const t = new Date(value);
  if (!Number.isFinite(t.getTime())) bad(`${field} must be a valid ISO-8601 timestamp`, field);
  return t;
}

function validateTapDestination(td, field) {
  if (td == null) return;
  if (typeof td !== 'object' || Array.isArray(td)) bad(`${field} must be an object`, field);
  if (!TAP_TYPES.includes(td.type)) bad(`${field}.type must be one of ${TAP_TYPES.join('|')}`, `${field}.type`);
  if (td.type === 'category' && !td.category_node_id) bad(`${field}.category_node_id required for type=category`, `${field}.category_node_id`);
  if (td.type === 'page' && !td.page_key) bad(`${field}.page_key required for type=page`, `${field}.page_key`);
}

// Tolerant by design: validates KNOWN keys only, unknown keys pass through —
// the App Builder's raw-JSON editor and legacy shapes must keep saving.
// Rejects only values that would already fail silently on device today.
function validateConfigJson(cfg) {
  if (cfg == null) return;
  if (typeof cfg !== 'object' || Array.isArray(cfg)) bad('config_json must be an object', 'config_json');
  if (JSON.stringify(cfg).length > CONFIG_MAX_BYTES) bad(`config_json exceeds ${CONFIG_MAX_BYTES} bytes`, 'config_json');

  if (cfg.style != null && !TILE_STYLES.includes(cfg.style)) {
    bad(`config_json.style must be one of ${TILE_STYLES.join('|')}`, 'config_json.style');
  }
  if (cfg.presentation_type != null && !PRESENTATION_TYPES.includes(cfg.presentation_type)) {
    bad(`config_json.presentation_type must be one of ${PRESENTATION_TYPES.join('|')}`, 'config_json.presentation_type');
  }
  if (cfg.timer != null) {
    if (typeof cfg.timer !== 'object' || Array.isArray(cfg.timer)) bad('config_json.timer must be an object', 'config_json.timer');
    if (cfg.timer.ends_at != null) parseTs(cfg.timer.ends_at, 'config_json.timer.ends_at');
    if (cfg.timer.label != null && typeof cfg.timer.label !== 'string') bad('config_json.timer.label must be a string', 'config_json.timer.label');
  }
  validateTapDestination(cfg.tap_destination, 'config_json.tap_destination');
  // Phase 4a — per-section world-rules override (only the 3 location keys).
  if (cfg.world_rules_override != null) {
    const o = cfg.world_rules_override;
    const f = 'config_json.world_rules_override';
    if (typeof o !== 'object' || Array.isArray(o)) bad(`${f} must be an object`, f);
    if (o.location_mode != null && !['boundary', 'rank_only', 'off'].includes(o.location_mode)) {
      bad(`${f}.location_mode must be boundary|rank_only|off`, `${f}.location_mode`);
    }
    if (o.radius_km != null && !(Number(o.radius_km) > 0)) bad(`${f}.radius_km must be > 0`, `${f}.radius_km`);
    if (o.empty_fallback != null && !['widen', 'show_nearest', 'show_empty'].includes(o.empty_fallback)) {
      bad(`${f}.empty_fallback must be widen|show_nearest|show_empty`, `${f}.empty_fallback`);
    }
  }
  if (cfg.tiles != null) {
    if (!Array.isArray(cfg.tiles)) bad('config_json.tiles must be an array', 'config_json.tiles');
    cfg.tiles.forEach((t, i) => {
      const f = `config_json.tiles[${i}]`;
      if (!t || typeof t !== 'object' || Array.isArray(t)) bad(`${f} must be an object`, f);
      for (const k of ['image_url', 'label', 'badge', 'library_section_id']) {
        if (t[k] != null && typeof t[k] !== 'string') bad(`${f}.${k} must be a string`, `${f}.${k}`);
      }
      if (t.size != null && !['large', 'small'].includes(t.size)) bad(`${f}.size must be large|small`, `${f}.size`);
      validateTapDestination(t.tap_destination, `${f}.tap_destination`);
    });
  }
  if (cfg.nodes != null) {
    if (!Array.isArray(cfg.nodes)) bad('config_json.nodes must be an array', 'config_json.nodes');
    cfg.nodes.forEach((n, i) => {
      if (!n || typeof n !== 'object' || Array.isArray(n)) bad(`config_json.nodes[${i}] must be an object`, `config_json.nodes[${i}]`);
    });
  }
}

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
  const startsAt = parseTs(s.starts_at, 'starts_at');
  const endsAt = parseTs(s.ends_at, 'ends_at');
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) bad('ends_at must be after starts_at', 'ends_at');
  validateConfigJson(s.config_json);
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
             config_json=COALESCE($11::jsonb, config_json),
             starts_at=$14, ends_at=$15, updated_at=now()
           WHERE id=$1 AND screen=$12 AND scope_type=$13
           RETURNING id`,
          [s.id, s.title, s.shelf_type, s.rule, s.item_type || null, s.category_key || null,
           Number(s.item_limit), Number(s.position), s.enabled !== false, s.pinned_ref || null,
           cfg, screen, scopeType, s.starts_at || null, s.ends_at || null]
        );
        if (!rows[0]) throw new AppError('NOT_FOUND', `shelf ${s.id} not found in this scope`, 404);
        out.push(rows[0].id);
      } else {
        // Insert, or update the existing instance (uniq_section_instance).
        const { rows } = await tx.query(
          `INSERT INTO section_config
             (screen, scope_type, scope_value, shelf_key, title, shelf_type, rule,
              item_type, category_key, item_limit, position, enabled, pinned_ref, config_json,
              starts_at, ends_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (screen, scope_type, COALESCE(scope_value,''), shelf_key,
                        COALESCE(category_key,''), COALESCE(item_type,''))
           DO UPDATE SET title=EXCLUDED.title, shelf_type=EXCLUDED.shelf_type,
             rule=EXCLUDED.rule, item_limit=EXCLUDED.item_limit,
             position=EXCLUDED.position, enabled=EXCLUDED.enabled,
             pinned_ref=EXCLUDED.pinned_ref, config_json=EXCLUDED.config_json,
             starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at,
             updated_at=now()
           RETURNING id`,
          [screen, scopeType, scopeValue, s.shelf_key, s.title, s.shelf_type, s.rule,
           s.item_type || null, s.category_key || null, Number(s.item_limit),
           Number(s.position), s.enabled !== false, s.pinned_ref || null, cfg,
           s.starts_at || null, s.ends_at || null]
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
            pinned_ref, config_json, starts_at, ends_at, updated_at
       FROM section_config
      WHERE screen=$1 AND scope_type=$2 AND ($3::text IS NULL OR scope_value=$3)
      ORDER BY position ASC, created_at ASC`,
    [screen, scopeType, scopeValue]
  );
  return success(res, { shelves: rows, saved_count: saved.length });
});

// GET /v1/admin/sections-analytics?days=7&screen=&scope_value=
// P5 (features/section-analytics-city/): per-section engagement from
// section_events — taps, see-alls, unique followers. Honest data only:
// sections with no recorded events simply aren't returned.
const sectionAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const screen = req.query.screen ? String(req.query.screen) : null;
  const scopeValue = req.query.scope_value ? String(req.query.scope_value) : null;
  const params = [String(days)];
  let where = `created_at >= now() - ($1 || ' days')::interval`;
  if (screen) { params.push(screen); where += ` AND screen = $${params.length}`; }
  if (scopeValue) { params.push(scopeValue); where += ` AND (scope_value = $${params.length} OR scope_value IS NULL)`; }
  const { rows } = await db.query(
    `SELECT section_key,
            COUNT(*) FILTER (WHERE event = 'tap')::int      AS taps,
            COUNT(*) FILTER (WHERE event = 'see_all')::int  AS see_alls,
            COUNT(DISTINCT follower_id) FILTER (WHERE follower_id IS NOT NULL)::int AS unique_followers
       FROM section_events
      WHERE ${where}
      GROUP BY section_key
      ORDER BY taps DESC, see_alls DESC
      LIMIT 100`,
    params
  );
  return success(res, { days, sections: rows });
});

// DELETE /v1/admin/sections/:id
const deleteSection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await db.query(`DELETE FROM section_config WHERE id=$1 RETURNING id`, [id]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'section not found', 404);
  cache.clear();
  return success(res, { deleted: rows[0].id });
});

module.exports = { listSections, saveSections, deleteSection, sectionAnalytics };
