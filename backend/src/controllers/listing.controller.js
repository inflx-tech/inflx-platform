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
const bulk = require('../services/listingBulk.service');
const imageIngest = require('../services/imageIngest.service');

const INGEST_ERR_MSG = {
  bad_scheme: 'Only http/https links are allowed', private_ip: 'That address is not allowed',
  not_image: 'That link is not an image', unreachable: 'Could not fetch that link',
  too_large: 'Image is over 5 MB', invalid_url: 'That is not a valid link',
  dns_failed: 'Could not resolve that host', too_many_redirects: 'Too many redirects', empty: 'The image was empty',
};

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

// Shared create path — insert a validated batch of items, reserving a
// contiguous SKU block. Used by BOTH the UI batch-add and the Excel import so
// they can never diverge. Caller validates with taxonomy.validateItem first.
async function insertProducts(brand, node, items) {
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
  return created;
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

  const created = await insertProducts(brand, node, items);

  return success(res, {
    node: { id: node.id, segment: node.segment, category: node.category, name: node.name },
    store_code: brand.store_code || (created[0] && created[0].sku ? created[0].sku.split('-')[0] : null),
    created_count: created.length,
    products: created,
  }, 201);
});

// ── GET /listing/nodes/:id/template.xlsx ──────────────────────────────────────
// Live-generate a per-leaf Excel template from the leaf's CURRENT facets, so a
// spec change auto-propagates to the sheet (contract: listing-excel-bulk).
const downloadTemplate = asyncHandler(async (req, res) => {
  const node = await taxonomy.getNode(req.params.id);
  if (!node) throw new AppError('NOT_FOUND', 'Category node not found', 404);
  if (!node.is_leaf) throw new AppError('VALIDATION_ERROR', 'Templates exist only for leaf item types', 422, 'id');
  const facets = await taxonomy.getNodeFacets(node);
  const wb = bulk.buildTemplateWorkbook(node, facets, new Date());

  const fname = `${String(node.name || 'listing').replace(/[^A-Za-z0-9]+/g, '-')}-template.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  await wb.xlsx.write(res);
  res.end();
});

// ── POST /listing/nodes/:id/import (multipart file) ───────────────────────────
// Parse → group row-per-variant → validate against CURRENT specs (same
// taxonomy.validateItem as the UI) → all-or-nothing → insertProducts.
const importProducts = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const node = await taxonomy.getNode(req.params.id);
  if (!node) throw new AppError('NOT_FOUND', 'Category node not found', 404);
  if (!node.is_leaf) throw new AppError('VALIDATION_ERROR', 'Products can only be added under a leaf node', 422, 'id');
  if (!req.file || !req.file.buffer) throw new AppError('VALIDATION_ERROR', 'No file uploaded (field "file")', 422, 'file');

  const facets = await taxonomy.getNodeFacets(node);
  const rows = await bulk.parseRows(req.file);
  if (!rows.length) throw new AppError('VALIDATION_ERROR', 'The file has no product rows', 422, 'file');

  const { items, fileErrors } = bulk.buildItems(rows, node, facets);
  if (fileErrors.length) throw new AppError('VALIDATION_ERROR', fileErrors.join(' '), 422, JSON.stringify({ file_errors: fileErrors }));
  if (items.length > 200) throw new AppError('VALIDATION_ERROR', 'Max 200 products per upload — split into smaller files', 422, 'items');

  // Forgiving value handling: snap case mismatches to the canonical allowed
  // value; drop unrecognised OPTIONAL tags (don't let one stray catalog value
  // block the whole upload) and report them. Required/colour stay strict.
  const valueWarnings = bulk.coerceItemFacets(items, facets);

  // Per-row validation, mapped back to spreadsheet row numbers. All-or-nothing.
  const problems = [];
  items.forEach((it) => {
    const errs = taxonomy.validateItem(node, facets, it);
    if (errs.length) problems.push({ rows: it.__rows, name: it.name || '(unnamed)', errors: errs });
  });
  if (problems.length) {
    throw new AppError('VALIDATION_ERROR', `${problems.length} product(s) need fixing — nothing was saved`, 422, JSON.stringify({ row_errors: problems }));
  }

  // Dedup: skip products whose name already exists under this leaf for this
  // brand, so a re-uploaded sheet doesn't create duplicates (walkthrough:
  // "uploaded twice → two copies"). Match by case-insensitive name within leaf.
  const lname = (s) => String(s || '').trim().toLowerCase();
  const wanted = [...new Set(items.map(it => lname(it.name)))];
  const { rows: existRows } = wanted.length ? await db.query(
    `SELECT DISTINCT lower(name) AS n FROM brand_products
      WHERE brand_id = $1 AND category_node_id = $2 AND is_active = true AND lower(name) = ANY($3)`,
    [brand.id, node.id, wanted]
  ) : { rows: [] };
  const existSet = new Set(existRows.map(r => r.n));
  const skipped = [...new Set(items.filter(it => existSet.has(lname(it.name))).map(it => it.name))];
  const toCreate = items.filter(it => !existSet.has(lname(it.name)));

  // Ingest image-URL cells to R2 (contract: listing-image-urls), only for the
  // products we'll actually create. NON-blocking: a link that fails is skipped
  // (product still created) and reported as a warning.
  const imageWarnings = [];
  for (const it of toCreate) {
    if (it.__cover_urls?.length) {
      const covers = [];
      for (const u of it.__cover_urls) {
        try { covers.push(await imageIngest.ingestImageFromUrl({ brandId: brand.id, url: u })); }
        catch (e) { imageWarnings.push({ name: it.name, where: 'cover', url: u, reason: INGEST_ERR_MSG[e.message] || 'failed' }); }
      }
      if (covers.length) it.images = covers;
    }
    for (const v of (it.variants || [])) {
      if (!v.__image_urls?.length) continue;
      const vi = [];
      for (const u of v.__image_urls) {
        try { vi.push(await imageIngest.ingestImageFromUrl({ brandId: brand.id, url: u })); }
        catch (e) { imageWarnings.push({ name: it.name, where: `colour ${v.color}`, url: u, reason: INGEST_ERR_MSG[e.message] || 'failed' }); }
      }
      if (vi.length) v.images = vi;
    }
  }

  const clean = toCreate.map(({ __rows, __cover_urls, variants, ...it }) => ({
    ...it,
    variants: variants ? variants.map(({ __image_urls, ...v }) => v) : undefined,
  }));
  const created = clean.length ? await insertProducts(brand, node, clean) : [];

  return success(res, {
    node: { id: node.id, segment: node.segment, category: node.category, name: node.name },
    created_count: created.length,
    products: created,                       // id + sku → drives the post-import photo tray
    needs_photos: created.map(p => p.id),
    skipped,                                 // names already in the listing — not re-created
    image_warnings: imageWarnings,           // links we couldn't fetch (product still created)
    value_warnings: valueWarnings,           // unrecognised optional tags we dropped
  }, 201);
});

// ── POST /listing/ingest-image ────────────────────────────────────────────────
// Manual flow: fetch a pasted image URL into our R2, return a stable served URL.
const ingestImage = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') throw new AppError('VALIDATION_ERROR', 'url is required', 422, 'url');
  try {
    const ingested = await imageIngest.ingestImageFromUrl({ brandId: brand.id, url });
    return success(res, { url: ingested }, 201);
  } catch (e) {
    throw new AppError('VALIDATION_ERROR', INGEST_ERR_MSG[e.message] || 'Could not import that image', 422, 'url');
  }
});

// ── POST /listing/products/:id/cover-photos ───────────────────────────────────
// Append cover photos to a product (post-import photo tray supports MULTIPLE).
// Merges into variants_json.cover_images (keeps the colour matrix) + sets the
// main image_url to the first cover.
const setProductCoverPhotos = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const { urls } = req.body || {};
  if (!Array.isArray(urls) || !urls.length) throw new AppError('VALIDATION_ERROR', 'urls[] is required', 422, 'urls');

  const { rows } = await db.query(
    `SELECT id, variants_json, image_url FROM brand_products WHERE id = $1 AND brand_id = $2`,
    [req.params.id, brand.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Product not found', 404);

  let vj = rows[0].variants_json || {};
  if (typeof vj === 'string') { try { vj = JSON.parse(vj); } catch { vj = {}; } }
  const existing = Array.isArray(vj.cover_images) ? vj.cover_images : [];
  vj.cover_images = [...existing, ...urls.filter(Boolean)].slice(0, 6);
  const cover = vj.cover_images[0] || rows[0].image_url || null;

  await db.query(
    `UPDATE brand_products SET variants_json = $1::jsonb, image_url = $2 WHERE id = $3 AND brand_id = $4`,
    [JSON.stringify(vj), cover, req.params.id, brand.id]
  );
  return success(res, { id: req.params.id, image_url: cover, cover_images: vj.cover_images });
});

// ─────────────────────────────────────────────────────────────────────────────
// Category browser (Type-1 result page) — contract: listing-category-browser.
// Powers the follower "sidebar + product grid + filter chips" screen on the
// SAME category_nodes tree the listing wizard writes to. Two public reads:
//   GET /listing/nodes/:id/children   → the sidebar rail (a node + its children)
//   GET /listing/nodes/:id/products   → the grid (subtree products) + the
//        available filter values aggregated over the live set + price range.
// Live gate mirrors the section engine's productsInCategory: approved brand,
// is_active, pushed_to_store.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_MAX = 50;
// facet_role values that a follower can filter by (skip media/price defs).
const FILTERABLE_ROLES = new Set(['variant', 'descriptive', 'discovery']);

// Map a product row → the card shape the follower grid renders. Mirrors
// sectionRules.mapListedProductItem; discount_value derived from mrp (display
// only — mig 118; a live brand_offer overlays an extra discount at checkout).
function mapBrowseProduct(r) {
  const price = r.price != null ? parseFloat(r.price) : null;
  const mrp = r.mrp != null ? parseFloat(r.mrp) : null;
  const discount = (mrp != null && price != null && mrp > price)
    ? Math.round(((mrp - price) / mrp) * 100) : null;
  // Variant summary (colour → sizes w/ price + stock) for the quick-add
  // "Select variant" sheet — any world with variants_json.colors[] surfaces it.
  let vj = r.variants_json;
  if (typeof vj === 'string') { try { vj = JSON.parse(vj); } catch { vj = null; } }
  const variants = (vj && Array.isArray(vj.colors)) ? vj.colors.map((c) => ({
    color: c.color || null,
    image_url: (Array.isArray(c.images) && c.images[0]) || null,
    sizes: (Array.isArray(c.sizes) ? c.sizes : []).map((sz) => ({
      size: sz.size,
      stock: sz.stock != null ? Number(sz.stock) : null,
      price: sz.price != null ? Number(sz.price) : null,
      sku: sz.sku || null,
    })),
  })) : [];
  const has_variants = variants.some((c) => c.sizes.length > 0);
  return {
    entity_type: 'product',
    id: r.id, name: r.name, price, mrp, discount_value: discount,
    image_url: r.image_url, section: r.section, veg_flag: r.veg_flag, description: r.description,
    badge: r.badge || null, has_addons: r.has_addons === true,
    rating: r.rating != null ? Number(r.rating) : null,
    review_count: r.review_count != null ? Number(r.review_count) : 0,
    brand: { id: r.brand_id, name: r.brand_name, category: r.brand_category, city: r.brand_city },
    variants, has_variants,
    via_creator: null, tracking: null,
  };
}

// ── GET /listing/nodes/:id/children ───────────────────────────────────────────
// The left rail: a node + its direct children (sub-categories / leaves).
const getNodeChildren = asyncHandler(async (req, res) => {
  const node = await taxonomy.getNode(req.params.id);
  if (!node) throw new AppError('NOT_FOUND', 'Category node not found', 404);
  const { rows } = await db.query(
    `SELECT id, parent_id, segment, category, name, slug, depth, is_leaf, sort_order
       FROM category_nodes WHERE parent_id = $1 ORDER BY sort_order, name`,
    [node.id]
  );
  return success(res, {
    node: {
      id: node.id, parent_id: node.parent_id, vertical: node.vertical,
      segment: node.segment, category: node.category, name: node.name,
      depth: node.depth, is_leaf: node.is_leaf,
    },
    children: rows,
  });
});

// ── GET /listing/nodes/:id/products ───────────────────────────────────────────
// Subtree product grid + facet filtering + price range + sort + pagination, AND
// the available filter values aggregated over the live set (drives the chips).
// Filters arrive as f_<facet_key>=v1,v2 (keys validated against the node's facet
// schema). price_min/price_max, sort (new|price_asc|price_desc|discount),
// page, page_size.
const getNodeProducts = asyncHandler(async (req, res) => {
  const node = await taxonomy.getNode(req.params.id);
  if (!node) throw new AppError('NOT_FOUND', 'Category node not found', 404);

  // Allowed filter keys = this node's facet schema (+ the always-present brand).
  // Guards the jsonb key against arbitrary input.
  const facetDefs = await taxonomy.getNodeFacets(node);
  const defByKey = new Map(facetDefs.map((f) => [f.facet_key, f]));
  const allowKeys = new Set([...defByKey.keys(), 'brand']);

  const chosen = [];
  for (const [qk, qv] of Object.entries(req.query)) {
    if (!qk.startsWith('f_')) continue;
    const key = qk.slice(2);
    if (!allowKeys.has(key)) continue;
    const vals = String(qv).split(',').map((s) => s.trim()).filter(Boolean);
    if (vals.length) chosen.push({ key, vals });
  }
  const priceMin = req.query.price_min != null && req.query.price_min !== '' ? Number(req.query.price_min) : null;
  const priceMax = req.query.price_max != null && req.query.price_max !== '' ? Number(req.query.price_max) : null;
  const sort = String(req.query.sort || 'new');
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(PAGE_MAX, Math.max(1, parseInt(req.query.page_size, 10) || 20));

  const subtree = `WITH RECURSIVE sub AS (
      SELECT id FROM category_nodes WHERE id = $1
      UNION ALL
      SELECT cn.id FROM category_nodes cn JOIN sub ON cn.parent_id = sub.id)`;

  // ── filtered, paginated page ──
  const params = [node.id];
  let p = 1;
  const clauses = [];
  for (const { key, vals } of chosen) {
    const ki = ++p; params.push(key);
    const vi = ++p; params.push(vals);
    // Matches a jsonb array (?| over elements) OR a scalar string (= ANY).
    clauses.push(`((bp.facets -> $${ki}) ?| $${vi}::text[] OR (bp.facets ->> $${ki}) = ANY($${vi}::text[]))`);
  }
  if (priceMin != null) { const i = ++p; params.push(priceMin); clauses.push(`bp.price >= $${i}`); }
  if (priceMax != null) { const i = ++p; params.push(priceMax); clauses.push(`bp.price <= $${i}`); }
  const filterSql = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

  const orderBy = sort === 'price_asc' ? 'bp.price ASC NULLS LAST'
    : sort === 'price_desc' ? 'bp.price DESC NULLS LAST'
    : sort === 'discount' ? 'CASE WHEN bp.mrp IS NOT NULL AND bp.mrp > bp.price THEN (bp.mrp - bp.price) / NULLIF(bp.mrp, 0) ELSE 0 END DESC, bp.created_at DESC NULLS LAST'
    : 'bp.created_at DESC NULLS LAST';

  const limIdx = ++p; params.push(pageSize);
  const offIdx = ++p; params.push((page - 1) * pageSize);

  const pageSql = `${subtree}
    SELECT bp.id, bp.name, bp.price, bp.mrp, bp.image_url, bp.section, bp.veg_flag, bp.description,
           bp.created_at, bp.badge, bp.variants_json,
           b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category, u_b.city AS brand_city,
           rev.rating, rev.review_count,
           EXISTS (SELECT 1 FROM product_addon_groups g WHERE g.product_id = bp.id) AS has_addons,
           COUNT(*) OVER() AS _total
      FROM brand_products bp
      JOIN brands b  ON b.id = bp.brand_id
      JOIN users u_b ON u_b.id = b.user_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(rr.rating)::numeric, 1) AS rating, COUNT(*)::int AS review_count
          FROM restaurant_reviews rr WHERE rr.brand_id = b.id AND rr.status = 'published'
      ) rev ON true
     WHERE bp.category_node_id IN (SELECT id FROM sub)
       AND u_b.status = 'approved' AND bp.is_active = true AND bp.pushed_to_store = true
       ${filterSql}
     ORDER BY ${orderBy}
     LIMIT $${limIdx} OFFSET $${offIdx}`;
  const { rows } = await db.query(pageSql, params);
  const total = rows.length ? Number(rows[0]._total) : 0;
  const items = rows.map(mapBrowseProduct);

  // ── facet aggregation over the live set (filters themselves not applied, so
  //    the chips always show every available option) ──
  const aggSql = `${subtree}
    SELECT bp.facets, bp.price
      FROM brand_products bp
      JOIN brands b  ON b.id = bp.brand_id
      JOIN users u_b ON u_b.id = b.user_id
     WHERE bp.category_node_id IN (SELECT id FROM sub)
       AND u_b.status = 'approved' AND bp.is_active = true AND bp.pushed_to_store = true`;
  const { rows: aggRows } = await db.query(aggSql, [node.id]);

  const valueCounts = new Map();   // facet_key → Map(value → count)
  let pmin = null, pmax = null;
  for (const ar of aggRows) {
    const f = ar.facets && typeof ar.facets === 'object' ? ar.facets : {};
    for (const key of allowKeys) {
      const raw = f[key];
      if (raw == null) continue;
      const vals = Array.isArray(raw) ? raw : [raw];
      if (!valueCounts.has(key)) valueCounts.set(key, new Map());
      const m = valueCounts.get(key);
      for (const v of vals) {
        const sv = String(v).trim();
        if (sv) m.set(sv, (m.get(sv) || 0) + 1);
      }
    }
    const pr = ar.price != null ? parseFloat(ar.price) : null;
    if (pr != null) { pmin = pmin == null ? pr : Math.min(pmin, pr); pmax = pmax == null ? pr : Math.max(pmax, pr); }
  }

  const filters = [];
  for (const key of allowKeys) {
    const m = valueCounts.get(key);
    if (!m || m.size === 0) continue;
    const def = defByKey.get(key);
    if (def && !FILTERABLE_ROLES.has(def.facet_role)) continue;   // skip media/price defs
    const label = key === 'brand' ? 'Brand' : (def?.label || key);
    const values = [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
    filters.push({ key, label, role: def?.facet_role || 'descriptive', input_type: def?.input_type || 'multi_select', values });
  }

  return success(res, {
    node: {
      id: node.id, vertical: node.vertical, segment: node.segment,
      category: node.category, name: node.name, is_leaf: node.is_leaf,
    },
    total, page, page_size: pageSize,
    items,
    filters,
    price: { min: pmin, max: pmax },
  });
});

module.exports = { getTree, getNodeFacets, getBrands, batchCreate, downloadTemplate, importProducts, ingestImage, setProductCoverPhotos, getNodeChildren, getNodeProducts };
