'use strict';

/**
 * adminDesignLayouts.controller.js — Design Library (Creator Experience Engine
 * Phase 3, features/design-library/, migrations 131-132).
 *
 * Read-only catalog of layouts + their Layout Contracts (required/optional/
 * hidden slots) that the Adaptive Renderer (Phase 4) will obey, plus the
 * Section Style vocabulary (a static enum, not a table — Phase-0 decision D4).
 * Admin-only via the 'sections' capability. No writes in v1.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

// Section Style vocabulary — how a row of cards behaves. Static reference used
// on Experience Templates in Phase 5; surfaced read-only here.
const SECTION_STYLES = [
  { key: 'carousel',   label: 'Carousel',   hint: 'horizontal scroll of cards' },
  { key: 'grid',       label: 'Grid',       hint: 'even columns' },
  { key: 'masonry',    label: 'Masonry',    hint: 'staggered heights' },
  { key: 'collage',    label: 'Collage',    hint: 'mixed-size mosaic' },
  { key: 'story_rail', label: 'Story rail', hint: 'circular story reels' },
  { key: 'tabs',       label: 'Tabs',       hint: 'tabbed sets' },
  { key: 'bento',      label: 'Bento',      hint: 'mixed-size grid' },
  { key: 'split',      label: 'Split',      hint: 'two side-by-side' },
  { key: 'hero',       label: 'Hero',       hint: 'single full-width slide(s)' },
  { key: 'magazine',   label: 'Magazine',   hint: 'editorial layout' },
];

// GET /v1/admin/design-layouts?world_key=
const listLayouts = asyncHandler(async (req, res) => {
  const worldKey = req.query.world_key ? String(req.query.world_key).trim().toLowerCase() : null;
  const params = [];
  let where = `status = 'active'`;
  if (worldKey) { params.push(worldKey); where += ` AND (world_key IS NULL OR world_key = $${params.length})`; }
  else { where += ` AND world_key IS NULL`; }

  const { rows } = await db.query(
    `SELECT key, label, kind, aspect_hint, contract_json, world_key, sort_order
       FROM design_layouts WHERE ${where}
      ORDER BY sort_order, label`, params);

  const layouts = rows.map((r) => ({
    key: r.key, label: r.label, kind: r.kind, aspect_hint: r.aspect_hint,
    contract: r.contract_json, world_key: r.world_key,
  }));
  return success(res, { layouts }, 200, { world_key: worldKey });
});

// GET /v1/admin/section-styles
const listSectionStyles = asyncHandler(async (_req, res) => {
  return success(res, { section_styles: SECTION_STYLES });
});

module.exports = { listLayouts, listSectionStyles };
