'use strict';

/**
 * adminTagVocabulary.controller.js — admin-owned fixed tag vocabulary.
 * Contract: features/merch-engine-p1a-product-tags. Admin-only.
 *
 * The fixed tags a brand picks from while listing, and that admin Collections
 * rule on. Keyed by `scope` = a business category_key value OR 'ALL'. Hiding a
 * tag removes it from the picker but never touches products already tagged
 * (tags are snapshot slugs on brand_products, not an FK).
 *
 * requireAnyAdminRole on all routes (per admin-role-gate memory: the founder's
 * daily account is not always superadmin; vocabulary edits are trivially
 * reversible).
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { slugify } = require('../services/tags.service');

const STATUSES = ['active', 'hidden'];

// GET /v1/admin/tag-vocabulary?scope=
const listVocabulary = asyncHandler(async (req, res) => {
  const scope = req.query.scope || null;
  const params = [];
  let where = '';
  if (scope) { params.push(scope); where = 'WHERE scope = $1'; }
  const { rows } = await db.query(
    `SELECT id, scope, label, slug, sort_order, status, created_at, updated_at
       FROM tag_vocabulary ${where}
      ORDER BY scope ASC, sort_order ASC, label ASC`,
    params
  );
  return success(res, { tags: rows });
});

// POST /v1/admin/tag-vocabulary  { scope, label, sort_order? }
const createTag = asyncHandler(async (req, res) => {
  const scope = String(req.body.scope || '').trim();
  const label = String(req.body.label || '').trim();
  if (!scope) throw new AppError('VALIDATION_ERROR', 'scope is required', 422, 'scope');
  if (!label) throw new AppError('VALIDATION_ERROR', 'label is required', 422, 'label');
  const slug = slugify(label);
  if (!slug) throw new AppError('VALIDATION_ERROR', 'label must contain letters or numbers', 422, 'label');
  const sortOrder = Number.isInteger(req.body.sort_order) ? req.body.sort_order : 0;

  const { rows: dup } = await db.query(
    'SELECT id FROM tag_vocabulary WHERE scope = $1 AND slug = $2', [scope, slug]
  );
  if (dup[0]) throw new AppError('VALIDATION_ERROR', `Tag '${label}' already exists in this scope`, 422, 'label');

  const { rows } = await db.query(
    `INSERT INTO tag_vocabulary (scope, label, slug, sort_order)
     VALUES ($1,$2,$3,$4)
     RETURNING id, scope, label, slug, sort_order, status, created_at, updated_at`,
    [scope, label, slug, sortOrder]
  );
  return success(res, { tag: rows[0] }, 201);
});

// PATCH /v1/admin/tag-vocabulary/:id  { label?, sort_order?, status? }
const updateTag = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sets = [];
  const params = [id];

  if (req.body.label !== undefined) {
    const label = String(req.body.label).trim();
    if (!label) throw new AppError('VALIDATION_ERROR', 'label cannot be empty', 422, 'label');
    const slug = slugify(label);
    if (!slug) throw new AppError('VALIDATION_ERROR', 'label must contain letters or numbers', 422, 'label');
    params.push(label); sets.push(`label = $${params.length}`);
    params.push(slug);  sets.push(`slug = $${params.length}`);
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
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'no fields to update', 422);
  sets.push('updated_at = now()');

  let rows;
  try {
    ({ rows } = await db.query(
      `UPDATE tag_vocabulary SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, scope, label, slug, sort_order, status, created_at, updated_at`,
      params
    ));
  } catch (e) {
    if (e.code === '23505') throw new AppError('VALIDATION_ERROR', 'A tag with that name already exists in this scope', 422, 'label');
    throw e;
  }
  if (!rows[0]) throw new AppError('NOT_FOUND', 'tag not found', 404);
  return success(res, { tag: rows[0] });
});

// DELETE /v1/admin/tag-vocabulary/:id — soft hide (existing product tags untouched)
const deleteTag = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `UPDATE tag_vocabulary SET status = 'hidden', updated_at = now() WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'tag not found', 404);
  return success(res, { hidden: rows[0].id });
});

module.exports = { listVocabulary, createTag, updateTag, deleteTag };
