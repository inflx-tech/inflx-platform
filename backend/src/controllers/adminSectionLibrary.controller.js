'use strict';

/**
 * adminSectionLibrary.controller.js — admin CRUD + live preview for the reusable
 * Section Library (Phase 3b). Contract: features/merch-engine-p3b-rule-builder-ui.
 * requireAnyAdminRole (founder's account isn't always superadmin).
 *
 * Preview runs the 3a data-driven evaluator (sectionRules.library_products) at
 * PLATFORM scope (no creator/brand context) so the builder shows how many gated
 * products a draft rule catches + a few samples, before the section is saved/placed.
 */

const db = require('../config/db');
const sectionLibrary = require('../services/sectionLibrary.service');
const categoryTaxonomy = require('../services/categoryTaxonomy.service');
const { runRule } = require('../services/sectionRules.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const PREVIEW_LIMIT = 200;

// GET /v1/admin/section-library?business_type=
const list = asyncHandler(async (req, res) => {
  const sections = await sectionLibrary.listSections({ business_type: req.query.business_type });
  return success(res, { sections });
});

// POST /v1/admin/section-library
const create = asyncHandler(async (req, res) => {
  let section;
  try { section = await sectionLibrary.createSection(req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  return success(res, { section }, 201);
});

// PATCH /v1/admin/section-library/:id
const update = asyncHandler(async (req, res) => {
  let section;
  try { section = await sectionLibrary.updateSection(req.params.id, req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  if (!section) throw new AppError('NOT_FOUND', 'section not found', 404);
  return success(res, { section });
});

// POST /v1/admin/section-library/preview  { business_type, rule_json }
const preview = asyncHandler(async (req, res) => {
  let rule;
  try { rule = sectionLibrary.validateRule(req.body && req.body.rule_json); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }

  const bt = String((req.body && req.body.business_type) || '').trim();
  const maps = await categoryTaxonomy.getMaps();
  const categoryCats = (bt && bt !== 'ALL') ? (maps.membersByKey[bt] || null) : null;

  // platform scope: no influencer / no brandId → gate = pushed_to_store
  const items = await runRule('library_products', { ruleDef: rule, categoryCats, limit: PREVIEW_LIMIT });
  return success(res, {
    count: items.length,
    capped: items.length >= PREVIEW_LIMIT,
    sample: items.slice(0, 8),
  });
});

// GET /v1/admin/section-library/product-search?business_type=&q=
// Hand-pick search (P4, features/rule-builder-depth/): gated products only
// (approved brand + pushed_to_store), name ILIKE, optional business scope.
// Same gates the engine applies at render — what you pick is what can show.
const productSearch = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return success(res, { products: [] });
  const bt = String(req.query.business_type || '').trim();
  const maps = await categoryTaxonomy.getMaps();
  const cats = (bt && bt !== 'ALL') ? (maps.membersByKey[bt] || null) : null;

  const params = [`%${q}%`];
  let catClause = '';
  if (cats) { params.push(cats); catClause = 'AND b.category = ANY($2)'; }
  const { rows } = await db.query(
    `SELECT bp.id, bp.name, bp.price, bp.image_url, b.business_name AS brand_name
       FROM brand_products bp
       JOIN brands b  ON b.id = bp.brand_id
       JOIN users u_b ON u_b.id = b.user_id
      WHERE u_b.status = 'approved' AND bp.is_active = true AND bp.pushed_to_store = true
        AND bp.name ILIKE $1
        ${catClause}
      ORDER BY bp.created_at DESC
      LIMIT 20`,
    params
  );
  return success(res, { products: rows });
});

module.exports = { list, create, update, preview, productSearch };
