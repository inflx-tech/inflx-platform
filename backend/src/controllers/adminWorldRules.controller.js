'use strict';

/**
 * adminWorldRules.controller.js — Phase 3 (features/phase3-world-rules/, mig 126).
 *
 * Per-world section-engine behaviour: location mode (boundary/rank_only/off),
 * radius, empty-area fallback, freshness default. Absent row = legacy
 * rank_only. Saves upsert one row per world and bust this instance's cache;
 * other instances converge within the engine TTL (~60s), same as sections.
 */

const db = require('../config/db');
const cache = require('../utils/ttlCache');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const LOCATION_MODES = ['boundary', 'rank_only', 'off'];
const EMPTY_FALLBACKS = ['widen', 'show_nearest', 'show_empty'];

const bad = (msg, field) => { throw new AppError('VALIDATION_ERROR', msg, 422, field); };

// GET /v1/admin/world-rules — every saved row (worlds without a row = legacy).
const listWorldRules = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT world_key, location_mode, radius_km, empty_fallback,
            window_days_default, item_limit_default, updated_at
       FROM world_rule_settings ORDER BY world_key`
  );
  return success(res, { world_rules: rows });
});

// PUT /v1/admin/world-rules/:world_key — upsert one world's settings.
const saveWorldRules = asyncHandler(async (req, res) => {
  const worldKey = String(req.params.world_key || '').trim().toLowerCase();
  if (!worldKey) bad('world_key required', 'world_key');

  const b = req.body || {};
  const mode = b.location_mode == null ? 'rank_only' : String(b.location_mode);
  if (!LOCATION_MODES.includes(mode)) bad(`location_mode must be one of ${LOCATION_MODES.join('|')}`, 'location_mode');

  const fallback = b.empty_fallback == null ? 'show_nearest' : String(b.empty_fallback);
  if (!EMPTY_FALLBACKS.includes(fallback)) bad(`empty_fallback must be one of ${EMPTY_FALLBACKS.join('|')}`, 'empty_fallback');

  let radius = null;
  if (b.radius_km != null && b.radius_km !== '') {
    radius = Number(b.radius_km);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 5000) bad('radius_km must be a number in (0, 5000]', 'radius_km');
  }
  if (mode === 'boundary' && radius == null) bad('radius_km required when location_mode=boundary', 'radius_km');

  let windowDays = null;
  if (b.window_days_default != null && b.window_days_default !== '') {
    windowDays = Number(b.window_days_default);
    if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 90) bad('window_days_default must be an integer 1–90', 'window_days_default');
  }

  const { rows } = await db.query(
    `INSERT INTO world_rule_settings (world_key, location_mode, radius_km, empty_fallback, window_days_default, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (world_key) DO UPDATE
       SET location_mode = $2, radius_km = $3, empty_fallback = $4,
           window_days_default = $5, updated_at = now()
     RETURNING world_key, location_mode, radius_km, empty_fallback, window_days_default, updated_at`,
    [worldKey, mode, radius, fallback, windowDays]
  );

  cache.del(`world_rules:${worldKey}`); // instant on this instance; TTL elsewhere
  return success(res, { world_rules: rows[0] });
});

// DELETE /v1/admin/world-rules/:world_key — back to legacy (absent row = rank_only).
const deleteWorldRules = asyncHandler(async (req, res) => {
  const worldKey = String(req.params.world_key || '').trim().toLowerCase();
  if (!worldKey) bad('world_key required', 'world_key');
  await db.query(`DELETE FROM world_rule_settings WHERE world_key = $1`, [worldKey]);
  cache.del(`world_rules:${worldKey}`);
  return success(res, { deleted: worldKey });
});

module.exports = { listWorldRules, saveWorldRules, deleteWorldRules };
