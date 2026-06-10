'use strict';

/**
 * listing.controller.js — drill-down listing engine API
 * (contract: features/listing-drilldown-taxonomy-engine).
 *
 *   GET  /listing/tree?vertical=fashion        — full category tree (public)
 *   GET  /listing/nodes/:id/facets             — leaf node + its facet schema (public)
 *   GET  /listing/brands?vertical=&q=          — brand directory search (public)
 *   POST /brands/me/products/batch             — drill-once batch-add (brand)
 *
 * Pricing/units unchanged; price stays rupees numeric. Facet VALUES → brand_products.facets.
 * Auto-SKU: per-business store_code + running seq → CODE-####; variant sub-SKUs
 * CODE-####-CLR-SIZE. Variant pics + per-size stock live in variants_json.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const taxonomy = require('../services/taxonomy.service');

async function getBrandByUserId(userId) {
  const { rows } = await db.query(
    `SELECT id, business_name, store_code, product_seq FROM brands WHERE user_id = $1`, [userId]);
  return rows[0] || null;
}

const abbr = (s, n) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, n);
const pad4 = (n) => String(n).padStart(4, '0');

// Generate + persist a unique 4-letter store code from the business name.
async function ensureStoreCode(client, brand) {
  if (brand.store_code) return brand.store_code;
  let base = abbr(brand.business_name, 4) || 'STOR';
  if (base.length < 4) base = (base + 'XXXX').slice(0, 4);
  let code = base, n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await client.query(`SELECT 1 FROM brands WHERE store_code = $1 AND id <> $2`, [code, brand.id]);
    if (!rows.length) break;
    code = base.slice(0, 3) + n; n++;
  }
  await client.query(`UPDATE brands SET store_code = $1 WHERE id = $2`, [code, brand.id]);
  return code;
}

// Build variants_json from the form's per-colour variants (pics + per-size stock),
// stamping a sub-SKU on every sellable size×colour.
function buildVariants(it, productSku) {
  const cover = Array.isArray(it.images) ? it.images.filter(Boolean) : [];
  const colors = Array.isArray(it.variants) ? it.variants : null;
  if (!colors || !colors.length) {
    const passthrough = (it.variants_json && typeof it.variants_json === 'object') ? it.variants_json : {};
    return { ...passthrough, sku: productSku, cover_images: cover };
  }
  const out = { sku: productSku, cover_images: cover, colors: [] };
  for (const cv of colors) {
    const color = cv.color || '';
    const ca = abbr(color, 3) || 'STD';
    const sizes = Array.isArray(cv.sizes) ? cv.sizes.map((s) => ({
      size: s.size,
      stock: s.stock != null && s.stock !== '' ? parseInt(s.stock, 10) : null,
      price: s.price != null && s.price !== '' ? Number(s.price) : null,
      sku: `${productSku}-${ca}-${abbr(s.size, 6)}`,
    })) : [];
    out.colors.push({ color, images: Array.isArray(cv.images) ? cv.images.filter(Boolean) : [], sizes });
  }
  return out;
}

function coverImage(it) {
  const cover = Array.isArray(it.images) ? it.images.filter(Boolean) : [];
  if (cover[0]) return cover[0];
  const v = Array.isArray(it.variants) ? it.variants : [];
  for (const cv of v) { const im = Array.isArray(cv.images) ? cv.images.filter(Boolean) : []; if (im[0]) return im[0]; }
  return null;
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

// ── GET /listing/brands?vertical=&q= ──────────────────────────────────────────
const getBrands = asyncHandler(async (req, res) => {
  const vertical = String(req.query.vertical || 'fashion').trim();
  const q = String(req.query.q || '').trim();
  const params = [vertical];
  let sql = `SELECT name FROM listing_brands WHERE vertical = $1 AND status = 'active'`;
  if (q) { params.push(`%${q}%`); sql += ` AND name ILIKE $${params.length}`; }
  sql += ` ORDER BY usage_count DESC, name ASC LIMIT 30`;
  const { rows } = await db.query(sql, params);
  return success(res, { brands: rows.map((r) => r.name) });
});

// ── POST /brands/me/products/batch ────────────────────────────────────────────
// Body: { category_node_id, items: [{ name, price, brand?, sku?, description?, images?[],
//          facets?{}, variants?[{color, images[], sizes[{size,stock,price}]}], stock? }] }
const batchCreate = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { category_node_id, items } = req.body || {};
  if (!category_node_id) throw new AppError('VALIDATION_ERROR', 'category_node_id is required', 422, 'category_node_id');
  if (!Array.isArray(items) || items.length === 0) throw new AppError('VALIDATION_ERROR', 'items[] is required', 422, 'items');
  if (items.length > 200) throw new AppError('VALIDATION_ERROR', 'max 200 items per batch', 422, 'items');

  const node = await taxonomy.getNode(category_node_id);
  if (!node) throw new AppError('NOT_FOUND', 'Category node not found', 404);
  if (!node.is_leaf) throw new AppError('VALIDATION_ERROR', 'Products can only be added under a leaf node', 422, 'category_node_id');

  const facetDefs = await taxonomy.getNodeFacets(node);

  // Validate all items first — reject the whole batch if any fails.
  const problems = [];
  items.forEach((it, i) => {
    const errs = taxonomy.validateItem(node, facetDefs, it);
    if (errs.length) problems.push({ index: i, errors: errs });
  });
  if (problems.length) throw new AppError('VALIDATION_ERROR', `${problems.length} item(s) invalid`, 422, JSON.stringify(problems));

  const created = [];
  await db.withTransaction(async (client) => {
    const storeCode = await ensureStoreCode(client, brand);
    // Atomically reserve a contiguous block of sequence numbers for this batch.
    const { rows: [seqRow] } = await client.query(
      `UPDATE brands SET product_seq = product_seq + $1 WHERE id = $2 RETURNING product_seq`,
      [items.length, brand.id]);
    let seq = seqRow.product_seq - items.length;
    const customBrands = new Set();

    for (const it of items) {
      seq += 1;
      const sku = (it.sku && String(it.sku).trim()) || `${storeCode}-${pad4(seq)}`;
      const facets = (it.facets && typeof it.facets === 'object') ? { ...it.facets } : {};
      const cover = Array.isArray(it.images) ? it.images.filter(Boolean) : [];
      if (cover.length) facets._images = cover;
      if (it.brand && String(it.brand).trim()) { facets.brand = String(it.brand).trim(); customBrands.add(facets.brand); }
      const variantsJson = buildVariants(it, sku);

      const { rows } = await client.query(
        `INSERT INTO brand_products
           (brand_id, name, price, sku, category_key, super_category, section,
            image_url, description, stock, variants_json, category_node_id, facets, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,true)
         RETURNING id, name, price, sku, category_node_id`,
        [brand.id, String(it.name).trim(), Number(it.price), sku,
         node.vertical, node.segment, node.category,
         coverImage(it), it.description || null,
         it.stock != null && it.stock !== '' ? parseInt(it.stock, 10) : null,
         JSON.stringify(variantsJson), node.id, JSON.stringify(facets)]
      );
      created.push(rows[0]);
    }

    // Capture custom (typed) brands into the directory — feeds the future flywheel.
    for (const b of customBrands) {
      await client.query(
        `INSERT INTO listing_brands (vertical, name, source, status, usage_count)
         VALUES ($1, $2, 'custom', 'active', 1)
         ON CONFLICT (vertical, lower(name)) DO UPDATE SET usage_count = listing_brands.usage_count + 1`,
        [node.vertical, b]);
    }
  });

  return success(res, {
    node: { id: node.id, segment: node.segment, category: node.category, name: node.name },
    store_code: brand.store_code || (created[0] && created[0].sku ? created[0].sku.split('-')[0] : null),
    created_count: created.length,
    products: created,
  }, 201);
});

module.exports = { getTree, getNodeFacets, getBrands, batchCreate };
