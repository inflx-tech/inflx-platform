'use strict';

/**
 * adminPages.controller.js — Admin custom-page registry (App Builder).
 *
 * CRUD over follower_pages: the GLOBAL themed pages an admin creates and uses as
 * a section's tap-destination (③). A page is metadata only here; its section
 * stack lives in section_config under screen='page', scope_type='vertical',
 * scope_value=<key> and is composed via the existing /admin/sections composer.
 *
 * Contract: features/follower-page-builder/. Admin-only (requireCapability('sections')).
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// label → url-safe key: lowercase, non-alnum → _, collapse + trim _.
function deriveKey(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

// GET /v1/admin/pages — all pages, newest first.
const listPages = asyncHandler(async (_req, res) => {
  const { rows } = await db.query(
    `SELECT id, key, label, title, subtitle, enabled, created_at, updated_at
       FROM follower_pages ORDER BY created_at DESC`
  );
  return success(res, { pages: rows });
});

// POST /v1/admin/pages — create. Body: { label, key?, title?, subtitle? }.
const createPage = asyncHandler(async (req, res) => {
  const label = (req.body.label || '').trim();
  if (!label) throw new AppError('VALIDATION_ERROR', 'label required', 422, 'label');
  const key = (req.body.key ? deriveKey(req.body.key) : deriveKey(label));
  if (!key) throw new AppError('VALIDATION_ERROR', 'could not derive a valid key', 422, 'key');

  const { rows: dup } = await db.query(`SELECT 1 FROM follower_pages WHERE key = $1`, [key]);
  if (dup[0]) throw new AppError('VALIDATION_ERROR', `key '${key}' already exists`, 422, 'key');

  const { rows } = await db.query(
    `INSERT INTO follower_pages (key, label, title, subtitle)
     VALUES ($1, $2, $3, $4)
     RETURNING id, key, label, title, subtitle, enabled, created_at, updated_at`,
    [key, label, req.body.title || null, req.body.subtitle || null]
  );
  return success(res, { page: rows[0] }, 201);
});

// PATCH /v1/admin/pages/:id — update label/title/subtitle/enabled (key is immutable).
const updatePage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sets = [];
  const vals = [id];
  for (const col of ['label', 'title', 'subtitle']) {
    if (req.body[col] !== undefined) { vals.push(req.body[col]); sets.push(`${col} = $${vals.length}`); }
  }
  if (req.body.enabled !== undefined) { vals.push(!!req.body.enabled); sets.push(`enabled = $${vals.length}`); }
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'nothing to update', 422);

  const { rows } = await db.query(
    `UPDATE follower_pages SET ${sets.join(', ')}, updated_at = now()
      WHERE id = $1
      RETURNING id, key, label, title, subtitle, enabled, created_at, updated_at`,
    vals
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'page not found', 404);
  return success(res, { page: rows[0] });
});

// DELETE /v1/admin/pages/:id — remove the registry row. Its section_config rows
// (screen='page', scope_value=key) are left orphaned-safe: any lingering
// tap_destination reference resolves to an empty page on the follower side.
const deletePage = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`DELETE FROM follower_pages WHERE id = $1 RETURNING id`, [req.params.id]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'page not found', 404);
  return success(res, { deleted: rows[0].id });
});

module.exports = { listPages, createPage, updatePage, deletePage };
