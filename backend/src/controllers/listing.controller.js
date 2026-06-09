'use strict';

/**
 * listing.controller.js — drill-down listing engine API
 * (contract: features/listing-drilldown-taxonomy-engine).
 *
 *   GET  /listing/tree?vertical=fashion        — full category tree (public)
 *   GET  /listing/nodes/:id/facets             — leaf node + its facet schema (public)
 *   POST /brands/me/products/batch             — drill-once batch-add (brand)
 *
 * Pricing/units unchanged; price stays rupees numeric. Facet VALUES → brand_products.facets.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const taxonomy = require('../services/taxonomy.service');

async function getBrandIdByUserId(userId) {
  const { rows } = await db.query(`SELECT id, category_key FROM brands WHERE user_id = $1`, [userId]);
  return rows[0] || null;
}

// ── GET /listing/tree?vertical= ───────────────────────────────────────────────
const getTree = asyncHandler(async (req, res) => {
  const vertical = String(req.query.vertical || '').trim();
  if (!vertical) throw new AppError('VALIDATION_ERROR', 'vertical is required', 422, 'vertical');
  const tree = await taxonomy.getTree(vertical);
  return success(res, { vertical, tree });
});

// ── GET /listing/nodes/:id/facets ─────────────────────────────────────────────
const getNodeFacets = asyncHandler(async (req, res) => {
  const node = await taxonomy.getNode(req.params.id);
  if (!node) throw new AppError('NOT_FOUND', 'Category node not found', 404);
  const facets = await taxonomy.getNodeFacets(node);
  return success(res, {
    node: {
      id: node.id, vertical: node.vertical, segment: node.segment, category: node.category,
      name: node.name, is_leaf: node.is_leaf, size_system: node.size_system,
      variant_axis: node.variant_axis, unisex_default: node.unisex_default,
      size_required: taxonomy.sizeRequired(node),
    },
    facets,
  });
});

// ── POST /brands/me/products/batch ────────────────────────────────────────────
// Body: { category_node_id, items: [{ name, price, images?[], facets?{}, variants_json?, stock?, description? }] }
// Drill-once batch-add: every item is filed under ONE leaf node. Validates each
// against the leaf's facet schema; rejects the whole batch if any item is invalid.
const batchCreate = asyncHandler(async (req, res) => {
  const brand = await getBrandIdByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { category_node_id, items } = req.body || {};
  if (!category_node_id) throw new AppError('VALIDATION_ERROR', 'category_node_id is required', 422, 'category_node_id');
  if (!Array.isArray(items) || items.length === 0) throw new AppError('VALIDATION_ERROR', 'items[] is required', 422, 'items');
  if (items.length > 200) throw new AppError('VALIDATION_ERROR', 'max 200 items per batch', 422, 'items');

  const node = await taxonomy.getNode(category_node_id);
  if (!node) throw new AppError('NOT_FOUND', 'Category node not found', 404);
  if (!node.is_leaf) throw new AppError('VALIDATION_ERROR', 'Products can only be added under a leaf node', 422, 'category_node_id');

  const facetDefs = await taxonomy.getNodeFacets(node);

  // Validate all items first — reject the batch if any fails (no partial writes).
  const problems = [];
  items.forEach((it, i) => {
    const errs = taxonomy.validateItem(node, facetDefs, it);
    if (errs.length) problems.push({ index: i, errors: errs });
  });
  if (problems.length) {
    throw new AppError('VALIDATION_ERROR', `${problems.length} item(s) invalid`, 422, JSON.stringify(problems));
  }

  // Insert all under one transaction.
  const created = [];
  await db.withTransaction(async (client) => {
    for (const it of items) {
      const images = Array.isArray(it.images) ? it.images.filter(Boolean) : [];
      const facets = (it.facets && typeof it.facets === 'object') ? { ...it.facets } : {};
      if (images.length) facets._images = images;            // multi-image lives in facets._images
      const { rows } = await client.query(
        `INSERT INTO brand_products
           (brand_id, name, price, category_key, super_category, section,
            image_url, description, stock, variants_json, category_node_id, facets, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,true)
         RETURNING id, name, price, category_node_id`,
        [brand.id, String(it.name).trim(), Number(it.price),
         node.vertical, node.segment, node.category,
         images[0] || null, it.description || null,
         it.stock != null ? parseInt(it.stock, 10) : null,
         JSON.stringify(it.variants_json || {}),
         node.id, JSON.stringify(facets)]
      );
      created.push(rows[0]);
    }
  });

  return success(res, {
    node: { id: node.id, segment: node.segment, category: node.category, name: node.name },
    created_count: created.length,
    products: created,
  }, 201);
});

module.exports = { getTree, getNodeFacets, batchCreate };
