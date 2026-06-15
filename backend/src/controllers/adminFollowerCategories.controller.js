'use strict';

/**
 * adminFollowerCategories.controller.js — admin-managed follower category tiles.
 * Contract: features/merch-engine-p1b-category-admin. Admin-only.
 *
 * The top-level "browse by category" tiles on the follower Find screen. Seeded
 * to mirror the legacy hardcoded SUPER_CATEGORIES; listing.service reads this
 * table (with a hardcoded fallback). Member businesses are free brand.category
 * keys. requireAnyAdminRole (reversible edits; founder's account isn't always
 * superadmin — admin-role-gate memory).
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const cache = require('../utils/ttlCache');
const categoryTaxonomy = require('../services/categoryTaxonomy.service');

const STATUSES = ['active', 'hidden'];

function cleanMembers(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const m of input) {
    const s = String(m == null ? '' : m).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

// GET /v1/admin/follower-categories
const list = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, key, label, icon, sort_order, status, member_categories, created_at, updated_at
       FROM follower_categories ORDER BY sort_order ASC, label ASC`
  );
  return success(res, { categories: rows });
});

// POST /v1/admin/follower-categories
const create = asyncHandler(async (req, res) => {
  const key = String(req.body.key || '').trim().toLowerCase();
  const label = String(req.body.label || '').trim();
  if (!key) throw new AppError('VALIDATION_ERROR', 'key is required', 422, 'key');
  if (!/^[a-z0-9_]+$/.test(key)) throw new AppError('VALIDATION_ERROR', 'key must be lowercase letters, numbers, or underscore', 422, 'key');
  if (!label) throw new AppError('VALIDATION_ERROR', 'label is required', 422, 'label');
  const icon = req.body.icon != null ? String(req.body.icon).trim() : null;
  const sortOrder = Number.isInteger(req.body.sort_order) ? req.body.sort_order : 0;
  const members = cleanMembers(req.body.member_categories);

  const { rows: dup } = await db.query('SELECT id FROM follower_categories WHERE key = $1', [key]);
  if (dup[0]) throw new AppError('VALIDATION_ERROR', `Tile '${key}' already exists`, 422, 'key');

  const { rows } = await db.query(
    `INSERT INTO follower_categories (key, label, icon, sort_order, member_categories)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, key, label, icon, sort_order, status, member_categories, created_at, updated_at`,
    [key, label, icon, sortOrder, members]
  );
  cache.clear();
  categoryTaxonomy.clearCache(); // bust the section-engine cache so the Home carousel reflects immediately
  return success(res, { category: rows[0] }, 201);
});

// PATCH /v1/admin/follower-categories/:id  (key is immutable)
const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sets = [];
  const params = [id];
  if (req.body.label !== undefined) {
    const l = String(req.body.label).trim();
    if (!l) throw new AppError('VALIDATION_ERROR', 'label cannot be empty', 422, 'label');
    params.push(l); sets.push(`label = $${params.length}`);
  }
  if (req.body.icon !== undefined) {
    params.push(req.body.icon == null ? null : String(req.body.icon).trim());
    sets.push(`icon = $${params.length}`);
  }
  if (req.body.sort_order !== undefined) {
    const so = Number(req.body.sort_order);
    if (!Number.isInteger(so)) throw new AppError('VALIDATION_ERROR', 'sort_order must be an integer', 422, 'sort_order');
    params.push(so); sets.push(`sort_order = $${params.length}`);
  }
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) throw new AppError('VALIDATION_ERROR', 'bad status', 422, 'status');
    params.push(req.body.status); sets.push(`status = $${params.length}`);
  }
  if (req.body.member_categories !== undefined) {
    params.push(cleanMembers(req.body.member_categories));
    sets.push(`member_categories = $${params.length}`);
  }
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'no fields to update', 422);
  sets.push('updated_at = now()');

  const { rows } = await db.query(
    `UPDATE follower_categories SET ${sets.join(', ')} WHERE id = $1
     RETURNING id, key, label, icon, sort_order, status, member_categories, created_at, updated_at`,
    params
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'tile not found', 404);
  cache.clear();
  categoryTaxonomy.clearCache();
  return success(res, { category: rows[0] });
});

// DELETE /v1/admin/follower-categories/:id — soft hide
const remove = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `UPDATE follower_categories SET status = 'hidden', updated_at = now() WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'tile not found', 404);
  cache.clear();
  categoryTaxonomy.clearCache();
  return success(res, { hidden: rows[0].id });
});

module.exports = { list, create, update, remove };
