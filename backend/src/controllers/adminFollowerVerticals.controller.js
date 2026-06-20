'use strict';

/**
 * adminFollowerVerticals.controller.js — admin-managed follower v2 home:
 * the world-switcher tabs (follower_verticals) + their "What's on your mind?"
 * category rails (follower_vertical_categories).
 *
 * Admin can rename / reorder / upload a 3D image (image_url stores the public
 * /v1/media/stock/* URL from the shared stock-upload-url helper) / enable-hide.
 * Public read = follower.controller.getVerticals (enabled rows only). Mirrors
 * adminFollowerCategories.controller. requireAnyAdminRole via the 'categories'
 * capability gate (reused — founder's account already manages categories).
 * Contract: features/follower-location-redesign (home admin slice).
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const KEY_RE = /^[a-z0-9_]+$/;
const strOrNull = (v) => (v == null ? null : String(v).trim());

// GET /v1/admin/home-verticals — all verticals (incl. hidden) + their categories.
const listVerticals = asyncHandler(async (req, res) => {
  const { rows: verts } = await db.query(
    `SELECT id, key, name, icon, image_url, accent_hex, sort_order, enabled
       FROM follower_verticals ORDER BY sort_order ASC, name ASC`
  );
  const { rows: cats } = await db.query(
    `SELECT id, vertical_key, key, name, icon, image_url, sort_order, enabled
       FROM follower_vertical_categories ORDER BY sort_order ASC, name ASC`
  );
  const byVert = {};
  for (const c of cats) (byVert[c.vertical_key] = byVert[c.vertical_key] || []).push(c);
  return success(res, { verticals: verts.map((v) => ({ ...v, categories: byVert[v.key] || [] })) });
});

// POST /v1/admin/home-verticals
const createVertical = asyncHandler(async (req, res) => {
  const key = String(req.body.key || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim();
  if (!KEY_RE.test(key)) throw new AppError('VALIDATION_ERROR', 'key must be lowercase letters, numbers, or underscore', 422, 'key');
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  const { rows: dup } = await db.query('SELECT id FROM follower_verticals WHERE key = $1', [key]);
  if (dup[0]) throw new AppError('VALIDATION_ERROR', `Vertical '${key}' already exists`, 422, 'key');
  const { rows } = await db.query(
    `INSERT INTO follower_verticals (key, name, icon, image_url, accent_hex, sort_order, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [key, name, strOrNull(req.body.icon), strOrNull(req.body.image_url), strOrNull(req.body.accent_hex),
     Number.isInteger(req.body.sort_order) ? req.body.sort_order : 0, req.body.enabled === false ? false : true]
  );
  return success(res, { vertical: rows[0] }, 201);
});

// PATCH /v1/admin/home-verticals/:id
const updateVertical = asyncHandler(async (req, res) => {
  const sets = [];
  const params = [req.params.id];
  const put = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  if (req.body.name !== undefined) { const n = String(req.body.name).trim(); if (!n) throw new AppError('VALIDATION_ERROR', 'name cannot be empty', 422, 'name'); put('name', n); }
  if (req.body.icon !== undefined) put('icon', strOrNull(req.body.icon));
  if (req.body.image_url !== undefined) put('image_url', strOrNull(req.body.image_url));
  if (req.body.accent_hex !== undefined) put('accent_hex', strOrNull(req.body.accent_hex));
  if (req.body.sort_order !== undefined) { const so = Number(req.body.sort_order); if (!Number.isInteger(so)) throw new AppError('VALIDATION_ERROR', 'sort_order must be an integer', 422, 'sort_order'); put('sort_order', so); }
  if (req.body.enabled !== undefined) put('enabled', !!req.body.enabled);
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'no fields to update', 422);
  sets.push('updated_at = now()');
  const { rows } = await db.query(`UPDATE follower_verticals SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'vertical not found', 404);
  return success(res, { vertical: rows[0] });
});

// DELETE /v1/admin/home-verticals/:id — soft hide (reversible).
const removeVertical = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`UPDATE follower_verticals SET enabled = false, updated_at = now() WHERE id = $1 RETURNING id`, [req.params.id]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'vertical not found', 404);
  return success(res, { disabled: rows[0].id });
});

// POST /v1/admin/home-vertical-categories
const createCategory = asyncHandler(async (req, res) => {
  const vertical_key = String(req.body.vertical_key || '').trim().toLowerCase();
  const key = String(req.body.key || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim();
  if (!vertical_key) throw new AppError('VALIDATION_ERROR', 'vertical_key is required', 422, 'vertical_key');
  if (!KEY_RE.test(key)) throw new AppError('VALIDATION_ERROR', 'key must be lowercase letters, numbers, or underscore', 422, 'key');
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  const { rows: vk } = await db.query('SELECT 1 FROM follower_verticals WHERE key = $1', [vertical_key]);
  if (!vk[0]) throw new AppError('VALIDATION_ERROR', 'unknown vertical_key', 422, 'vertical_key');
  const { rows: dup } = await db.query('SELECT id FROM follower_vertical_categories WHERE vertical_key = $1 AND key = $2', [vertical_key, key]);
  if (dup[0]) throw new AppError('VALIDATION_ERROR', `Category '${key}' already exists in ${vertical_key}`, 422, 'key');
  const { rows } = await db.query(
    `INSERT INTO follower_vertical_categories (vertical_key, key, name, icon, image_url, sort_order, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [vertical_key, key, name, strOrNull(req.body.icon), strOrNull(req.body.image_url),
     Number.isInteger(req.body.sort_order) ? req.body.sort_order : 0, req.body.enabled === false ? false : true]
  );
  return success(res, { category: rows[0] }, 201);
});

// PATCH /v1/admin/home-vertical-categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const sets = [];
  const params = [req.params.id];
  const put = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  if (req.body.name !== undefined) { const n = String(req.body.name).trim(); if (!n) throw new AppError('VALIDATION_ERROR', 'name cannot be empty', 422, 'name'); put('name', n); }
  if (req.body.icon !== undefined) put('icon', strOrNull(req.body.icon));
  if (req.body.image_url !== undefined) put('image_url', strOrNull(req.body.image_url));
  if (req.body.sort_order !== undefined) { const so = Number(req.body.sort_order); if (!Number.isInteger(so)) throw new AppError('VALIDATION_ERROR', 'sort_order must be an integer', 422, 'sort_order'); put('sort_order', so); }
  if (req.body.enabled !== undefined) put('enabled', !!req.body.enabled);
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'no fields to update', 422);
  const { rows } = await db.query(`UPDATE follower_vertical_categories SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'category not found', 404);
  return success(res, { category: rows[0] });
});

// DELETE /v1/admin/home-vertical-categories/:id — soft hide.
const removeCategory = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`UPDATE follower_vertical_categories SET enabled = false WHERE id = $1 RETURNING id`, [req.params.id]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'category not found', 404);
  return success(res, { disabled: rows[0].id });
});

module.exports = {
  listVerticals, createVertical, updateVertical, removeVertical,
  createCategory, updateCategory, removeCategory,
};
