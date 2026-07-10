'use strict';

/**
 * adminExperiencePreview.controller.js — Adaptive Renderer preview API
 * (Creator Experience Engine Phase 4a, features/adaptive-renderer/).
 *
 * Resolves a LIVE theme (P2) → its preset tokens (P1) + a LIVE layout's
 * contract (P3), fills a sample Asset Pack, and returns a render spec the
 * mobile AdaptiveRenderer (P4b) will draw. Read-only, admin-gated. Reads only;
 * no writes, no new tables, does NOT touch the live section engine.
 */

const db = require('../config/db');
const rs = require('../services/renderSpec.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Assemble the full render spec for a theme × layout. Exported for local/unit
// exercise. Returns null if the theme or layout is not found.
async function buildPreviewSpec({ themeKey, layoutKey, worldKey }) {
  const world = String(worldKey || 'fashion').toLowerCase();

  // authored theme wins over a blueprint of the same key
  const t = (await db.query(
    `SELECT key, name, subtitle, preset_key, default_title, default_subtitle, default_cta
       FROM experience_themes WHERE world_key = $1 AND key = $2
      ORDER BY is_blueprint ASC LIMIT 1`, [world, String(themeKey)])).rows[0];
  if (!t) return null;

  const layout = (await db.query(
    `SELECT key, label, kind, aspect_hint, contract_json
       FROM design_layouts WHERE key = $1 AND status = 'active' LIMIT 1`, [String(layoutKey)])).rows[0];
  if (!layout) return null;

  // resolve tokens from the theme's preset
  let tokens = { palette: {}, typography: {}, background: {}, radius: 12, shadow: 'soft' };
  if (t.preset_key) {
    const preset = (await db.query(
      `SELECT tokens_json FROM design_presets WHERE key = $1 LIMIT 1`, [t.preset_key])).rows[0];
    const tk = (preset && preset.tokens_json) || {};
    const { rows } = await db.query(
      `SELECT kind, key, config_json FROM design_tokens
        WHERE (kind='palette' AND key=$1) OR (kind='typography' AND key=$2)
           OR (kind='background' AND key=$3) OR (kind='radius' AND key=$4)`,
      [tk.palette || '', tk.typography || '', tk.background || '', tk.radius || '']);
    const byKind = {};
    for (const r of rows) byKind[r.kind] = r.config_json;
    tokens = {
      palette: byKind.palette || {},
      typography: byKind.typography || {},
      background: byKind.background || {},
      radius: (byKind.radius && byKind.radius.px) || 12,
      shadow: tk.shadow || 'soft',
    };
  }

  const copy = {
    title: t.default_title || t.name,
    subtitle: t.default_subtitle || t.subtitle,
    cta: t.default_cta,
  };
  const ctx = { pack: rs.SAMPLE_PACK, tokens, copy };
  const resolved = rs.resolveSlots(layout.contract_json, ctx);
  const featured = rs.pickFeatured(layout.aspect_hint, rs.SAMPLE_PACK.featured_images);

  return {
    theme: { key: t.key, name: t.name, title: copy.title, subtitle: copy.subtitle, cta: copy.cta },
    design: { layout_key: layout.key, aspect_hint: layout.aspect_hint, kind: layout.kind, contract: layout.contract_json },
    tokens,
    pack: rs.SAMPLE_PACK,
    resolved: {
      visible_slots: resolved.visible_slots,
      featured_pick: featured,
      blocked: resolved.blocked,
      missing: resolved.missing,
    },
  };
}

// GET /v1/admin/experience-preview?theme_key=&layout_key=&world_key=
const preview = asyncHandler(async (req, res) => {
  const themeKey = req.query.theme_key;
  const layoutKey = req.query.layout_key;
  if (!themeKey || !layoutKey) throw new AppError('VALIDATION_ERROR', 'theme_key and layout_key required', 422);
  const spec = await buildPreviewSpec({ themeKey, layoutKey, worldKey: req.query.world_key });
  if (!spec) throw new AppError('NOT_FOUND', 'theme or layout not found', 404);
  return success(res, { render_spec: spec });
});

module.exports = { preview, buildPreviewSpec };
