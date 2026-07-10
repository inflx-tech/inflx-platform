'use strict';

/**
 * adminDesignSystem.controller.js — Creator Experience Engine Phase 1
 * (features/design-system-tokens/, migrations 127-128).
 *
 * Read-only catalog of the design vocabulary — moods, palettes, typography,
 * backgrounds, radius, shadow — plus preset bundles the Theme wizard (Phase 2)
 * will consume. Admin is a curator, not a designer: no writes in v1.
 *
 * Admin-only via the 'sections' capability (same engine-authoring surface the
 * App Builder / World Rules use). world tokens override global on the same
 * (kind,key); presets return global + the requested world.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const KIND_ORDER = ['mood', 'palette', 'typography', 'background', 'radius', 'shadow'];

// GET /v1/admin/design-system/tokens?world_key=&kind=
const listTokens = asyncHandler(async (req, res) => {
  const worldKey = req.query.world_key ? String(req.query.world_key).trim().toLowerCase() : null;
  const kind = req.query.kind ? String(req.query.kind).trim().toLowerCase() : null;

  const params = [];
  let where = `status = 'active'`;
  if (worldKey) { params.push(worldKey); where += ` AND (world_key IS NULL OR world_key = $${params.length})`; }
  else { where += ` AND world_key IS NULL`; }
  if (kind && KIND_ORDER.includes(kind)) { params.push(kind); where += ` AND kind = $${params.length}`; }

  // DISTINCT ON picks one row per (kind,key); a world row (world_key NOT NULL)
  // wins over the global one via the ordering below.
  const { rows } = await db.query(
    `SELECT DISTINCT ON (kind, key) kind, key, label, world_key, config_json, sort_order
       FROM design_tokens
      WHERE ${where}
      ORDER BY kind, key, (world_key IS NOT NULL) DESC`,
    params
  );

  const grouped = {};
  for (const k of KIND_ORDER) grouped[k] = [];
  for (const r of rows) {
    (grouped[r.kind] || (grouped[r.kind] = [])).push({
      key: r.key, label: r.label, world_key: r.world_key, config: r.config_json, sort_order: r.sort_order,
    });
  }
  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  }

  return success(res, { tokens: grouped }, 200, { world_key: worldKey });
});

// GET /v1/admin/design-system/presets?world_key=
const listPresets = asyncHandler(async (req, res) => {
  const worldKey = req.query.world_key ? String(req.query.world_key).trim().toLowerCase() : null;

  const params = [];
  let where = `status = 'active'`;
  if (worldKey) { params.push(worldKey); where += ` AND (world_key IS NULL OR world_key = $${params.length})`; }

  const { rows } = await db.query(
    `SELECT key, label, world_key, tokens_json, positions_json
       FROM design_presets
      WHERE ${where}
      ORDER BY label`,
    params
  );

  const presets = rows.map((r) => ({
    key: r.key, label: r.label, world_key: r.world_key,
    tokens: r.tokens_json, positions: r.positions_json,
  }));

  return success(res, { presets }, 200, { world_key: worldKey });
});

module.exports = { listTokens, listPresets };
