'use strict';

/**
 * adminMasterDish.controller.js
 *
 * Admin CRUD for master_dishes — the curated restaurant dish catalogue
 * shipped in migration 035 + consumed by RestaurantDishPicker via
 * /brands/me/master-catalogue. Admin owns this content forever; engineering
 * shipped the plumbing.
 *
 * Routes (admin.routes.js, requireAdminRole('reviewer')):
 *   GET    /admin/master-dishes              — list with filters + activation count
 *   POST   /admin/master-dishes              — create
 *   PATCH  /admin/master-dishes/:id          — update (partial)
 *   DELETE /admin/master-dishes/:id          — delete (FK cascades via SET NULL)
 *   GET    /admin/master-dishes/cuisines     — distinct cuisines for filter UI
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const VALID_FIELDS = [
  'cuisine', 'section', 'name',
  'default_image_url', 'suggested_price_min', 'suggested_price_max',
  'default_description', 'sort_order',
];

// ── GET /admin/master-dishes ─────────────────────────────────────────────────
// Filters: cuisine, section, search (name ILIKE), page (default 1, limit 50)
// Each row annotated with `activated_count` — how many brand_products rows
// reference this dish. Useful before deletion (high count → reconsider).

const listMasterDishes = asyncHandler(async (req, res) => {
  const cuisine = req.query.cuisine || null;
  const section = req.query.section || null;
  const search = (req.query.search || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (cuisine) { params.push(cuisine); where.push(`md.cuisine = $${params.length}`); }
  if (section) { params.push(section); where.push(`md.section = $${params.length}`); }
  if (search)  { params.push(`%${search}%`); where.push(`md.name ILIKE $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM master_dishes md ${whereSql}`,
    params
  );
  const total = countRows[0].total;

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT
       md.*,
       COALESCE(activation.cnt, 0)::int AS activated_count
     FROM master_dishes md
     LEFT JOIN (
       SELECT master_dish_id, COUNT(*) AS cnt
       FROM brand_products
       WHERE master_dish_id IS NOT NULL
       GROUP BY master_dish_id
     ) activation ON activation.master_dish_id = md.id
     ${whereSql}
     ORDER BY md.cuisine, md.section, md.sort_order, md.name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return success(res, { items: rows }, 200, { page, limit, total });
});

// ── GET /admin/master-dishes/cuisines ────────────────────────────────────────
// Distinct cuisines + per-cuisine count + section list. Drives the admin
// filter UI without requiring a separate count round-trip per cuisine.

const listCuisines = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT cuisine, COUNT(*)::int AS dish_count,
           array_agg(DISTINCT section ORDER BY section) AS sections
    FROM master_dishes
    GROUP BY cuisine
    ORDER BY cuisine
  `);
  return success(res, { cuisines: rows });
});

// ── POST /admin/master-dishes ────────────────────────────────────────────────

const createMasterDish = asyncHandler(async (req, res) => {
  const body = req.body || {};

  if (!body.cuisine || !body.section || !body.name) {
    throw new AppError('VALIDATION_ERROR', 'cuisine, section, and name are required', 422);
  }
  if (body.suggested_price_min != null && body.suggested_price_max != null
      && Number(body.suggested_price_min) > Number(body.suggested_price_max)) {
    throw new AppError('VALIDATION_ERROR', 'suggested_price_min cannot exceed suggested_price_max', 422);
  }

  // Auto-bump sort_order to (max within cuisine+section) + 1 if not provided
  let sortOrder = body.sort_order;
  if (sortOrder == null) {
    const { rows: maxRows } = await db.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM master_dishes WHERE cuisine = $1 AND section = $2`,
      [body.cuisine, body.section]
    );
    sortOrder = maxRows[0].next;
  }

  const { rows } = await db.query(
    `INSERT INTO master_dishes
       (cuisine, section, name, default_image_url, suggested_price_min, suggested_price_max, default_description, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      body.cuisine,
      body.section,
      body.name,
      body.default_image_url || null,
      body.suggested_price_min != null ? Number(body.suggested_price_min) : null,
      body.suggested_price_max != null ? Number(body.suggested_price_max) : null,
      body.default_description || null,
      sortOrder,
    ]
  );

  return success(res, { dish: rows[0] }, 201);
});

// ── PATCH /admin/master-dishes/:id ───────────────────────────────────────────

const updateMasterDish = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw new AppError('VALIDATION_ERROR', 'invalid id', 422);

  const body = req.body || {};
  const sets = [];
  const params = [];

  for (const f of VALID_FIELDS) {
    if (body[f] !== undefined) {
      params.push(body[f]);
      sets.push(`${f} = $${params.length}`);
    }
  }

  if (sets.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'no valid fields to update', 422);
  }

  if (body.suggested_price_min != null && body.suggested_price_max != null
      && Number(body.suggested_price_min) > Number(body.suggested_price_max)) {
    throw new AppError('VALIDATION_ERROR', 'suggested_price_min cannot exceed suggested_price_max', 422);
  }

  params.push(id);
  const { rows } = await db.query(
    `UPDATE master_dishes SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );

  if (rows.length === 0) throw new AppError('NOT_FOUND', 'dish not found', 404);
  return success(res, { dish: rows[0] });
});

// ── DELETE /admin/master-dishes/:id ──────────────────────────────────────────
// brand_products.master_dish_id has ON DELETE SET NULL, so existing
// brand-activated rows survive but lose the master reference. Frontend
// surfaces activation_count before delete so admin can decide.

const deleteMasterDish = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw new AppError('VALIDATION_ERROR', 'invalid id', 422);

  const { rows } = await db.query(`DELETE FROM master_dishes WHERE id = $1 RETURNING id`, [id]);
  if (rows.length === 0) throw new AppError('NOT_FOUND', 'dish not found', 404);
  return success(res, { deleted: id });
});

module.exports = {
  listMasterDishes,
  listCuisines,
  createMasterDish,
  updateMasterDish,
  deleteMasterDish,
};
