'use strict';

/**
 * categories.controller.js — Phase A7-admin.
 *
 * Admin CRUD for L3 marketplace fee categories. Every category row
 * holds path_a_pct (direct), path_b_pct (influencer_direct), path_c_pct
 * (influencer_attributed). pricing.service.computeL3OnFollowerTxn reads
 * these via a 60s in-memory cache (bustCategoryCache on every mutation).
 *
 * Endpoints (mounted /admin via admin.routes.js):
 *   GET    /admin/categories                  any admin
 *   POST   /admin/categories                  superadmin
 *   PATCH  /admin/categories/:categoryKey     superadmin
 *   DELETE /admin/categories/:categoryKey     superadmin
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const pricingService = require('../services/pricing.service');

function _validate(body, { partial = false } = {}) {
  const errs = [];
  if (!partial || body.category_key !== undefined) {
    if (!body.category_key || typeof body.category_key !== 'string' || body.category_key.length > 50) {
      errs.push('category_key required (non-empty string, max 50 chars)');
    }
  }
  if (!partial || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string') errs.push('name required');
  }
  if (!partial || body.label !== undefined) {
    if (!body.label || typeof body.label !== 'string') errs.push('label required');
  }
  for (const f of ['path_a_pct', 'path_b_pct', 'path_c_pct']) {
    if (!partial || body[f] !== undefined) {
      const v = parseFloat(body[f]);
      if (isNaN(v) || v < 0 || v > 50) errs.push(`${f} must be 0–50`);
    }
  }
  return errs;
}

const list = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, category_key, name, label, path_a_pct, path_b_pct, path_c_pct,
            active, sort_order, description, return_window_days, updated_at, updated_by
       FROM categories
      ORDER BY sort_order ASC, label ASC`
  );
  return success(res, { categories: rows });
});

const create = asyncHandler(async (req, res) => {
  const errs = _validate(req.body);
  if (errs.length) throw new AppError('VALIDATION_ERROR', errs.join('; '), 422);

  const {
    category_key, name, label,
    path_a_pct, path_b_pct, path_c_pct,
    sort_order = 0, description = null, active = true,
  } = req.body;

  const { rows } = await db.query(
    `INSERT INTO categories
       (category_key, name, label, path_a_pct, path_b_pct, path_c_pct,
        active, sort_order, description, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [category_key, name, label,
     parseFloat(path_a_pct), parseFloat(path_b_pct), parseFloat(path_c_pct),
     active !== false, parseInt(sort_order, 10) || 0, description, req.user.sub]
  ).catch(err => {
    if (err.code === '23505') {
      throw new AppError('VALIDATION_ERROR',
        `category_key '${category_key}' already exists`, 422, 'category_key');
    }
    throw err;
  });

  pricingService.bustCategoryCache();
  return success(res, { category: rows[0] }, 201);
});

const update = asyncHandler(async (req, res) => {
  const { categoryKey } = req.params;
  const errs = _validate(req.body, { partial: true });
  if (errs.length) throw new AppError('VALIDATION_ERROR', errs.join('; '), 422);

  const allowed = ['name', 'label', 'path_a_pct', 'path_b_pct', 'path_c_pct',
                   'active', 'sort_order', 'description',
                   // Wave 1 — per-category commerce-commission return window
                   'return_window_days'];
  const sets = [], params = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      params.push(req.body[k]);
      sets.push(`${k} = $${params.length}`);
    }
  }
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'No editable fields supplied', 422);

  sets.push(`updated_at = now()`);
  params.push(req.user.sub);
  sets.push(`updated_by = $${params.length}`);
  params.push(categoryKey);

  const { rows } = await db.query(
    `UPDATE categories SET ${sets.join(', ')}
      WHERE category_key = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', `Category '${categoryKey}' not found`, 404);

  pricingService.bustCategoryCache();
  return success(res, { category: rows[0] });
});

const remove = asyncHandler(async (req, res) => {
  const { categoryKey } = req.params;
  const { rows } = await db.query(
    `DELETE FROM categories WHERE category_key = $1 RETURNING category_key`,
    [categoryKey]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', `Category '${categoryKey}' not found`, 404);
  pricingService.bustCategoryCache();
  return success(res, { deleted: rows[0].category_key });
});

module.exports = { list, create, update, remove };
