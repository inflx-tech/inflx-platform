'use strict';

/**
 * brandProducts.service.js — a brand's published products as a creator may see them.
 * Contract: features/item3-discovery-profiles-groups · rules v1.11 §15 · prompt D9, D10, A11
 *
 * Published = brand_products.is_active AND pushed_to_store AND the brand's user is approved
 * — the same three-part gate every shopper surface uses (follower.service.js:536-552,
 * sectionRules.service.js:1001). List price only (brands.price; mrp is display-only per
 * mig 118). Never an offer, never a discounted price.
 *
 * Sizes and images come from variants_json (the website wizard's structure; product_variants
 * has no rows) — founder Q7. Out of stock (founder Q6): stock 0, or sizes present and every
 * size's stock is 0. Blank stock = available.
 */

const db = require('../config/db');
const { resolveProductImage } = require('../utils/productImage');

const PAGE = 20;
const PUBLISHED = `bp.is_active = true AND bp.pushed_to_store = true AND u.status = 'approved'`;

function asObj(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

/** Every image URL for a product, cover first, de-duplicated. */
function allImages(row) {
  const out = [];
  const push = (u) => { if (u && typeof u === 'string' && u.trim() && !out.includes(u.trim())) out.push(u.trim()); };
  push(row.image_url);
  const vj = asObj(row.variants_json);
  if (vj) {
    for (const u of Array.isArray(vj.cover_images) ? vj.cover_images : []) push(typeof u === 'string' ? u : u && u.url);
    for (const c of Array.isArray(vj.colors) ? vj.colors : []) for (const u of Array.isArray(c && c.images) ? c.images : []) push(typeof u === 'string' ? u : u && u.url);
  }
  const facets = asObj(row.facets);
  if (facets) for (const u of Array.isArray(facets._images) ? facets._images : []) push(typeof u === 'string' ? u : u && u.url);
  return out;
}

/** Sizes with availability, merged across colours: available when ANY colour has stock ≠ 0 for that size. */
function sizes(row) {
  const vj = asObj(row.variants_json);
  const bySize = new Map();
  const colors = vj && Array.isArray(vj.colors) ? vj.colors : [];
  for (const c of colors) {
    for (const s of Array.isArray(c && c.sizes) ? c.sizes : []) {
      const name = String(s && (s.size ?? s.name) || '').trim();
      if (!name) continue;
      const stock = s && s.stock != null && s.stock !== '' ? Number(s.stock) : null;
      const available = stock == null || stock > 0;
      bySize.set(name, (bySize.get(name) || false) || available);
    }
  }
  // Top-level sizes[] (no colours) — some wizard versions write this shape.
  if (!colors.length && vj && Array.isArray(vj.sizes)) {
    for (const s of vj.sizes) {
      const name = String(s && (s.size ?? s.name ?? s) || '').trim();
      if (!name) continue;
      const stock = s && typeof s === 'object' && s.stock != null && s.stock !== '' ? Number(s.stock) : null;
      bySize.set(name, stock == null || stock > 0);
    }
  }
  return [...bySize.entries()].map(([size, available]) => ({ size, available }));
}

function outOfStock(row) {
  const stock = row.stock != null && row.stock !== '' ? Number(row.stock) : null;
  if (stock != null && stock <= 0) return true;
  const sz = sizes(row);
  return sz.length > 0 && sz.every(s => !s.available);
}

function listRow(r) {
  return {
    id: r.id,
    name: r.name,
    price: r.price == null ? null : Number(r.price),
    imageUrl: resolveProductImage(r),
    outOfStock: outOfStock(r),
  };
}

async function countPublished(brandId) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM brand_products bp JOIN brands b ON b.id = bp.brand_id JOIN users u ON u.id = b.user_id
      WHERE bp.brand_id = $1 AND ${PUBLISHED}`, [brandId]);
  return rows[0].n;
}

async function list(brandId, { page = 1, limit = PAGE } = {}) {
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(Math.max(1, parseInt(limit, 10) || PAGE), 50);
  const total = await countPublished(brandId);
  const { rows } = await db.query(
    `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.variants_json, bp.facets, bp.stock
       FROM brand_products bp JOIN brands b ON b.id = bp.brand_id JOIN users u ON u.id = b.user_id
      WHERE bp.brand_id = $1 AND ${PUBLISHED}
      ORDER BY bp.is_featured DESC, bp.featured_sort ASC, bp.created_at DESC
      LIMIT $2 OFFSET $3`, [brandId, lim, (pg - 1) * lim]);
  return { total, page: pg, rows: rows.map(listRow) };
}

/** Detail (O3). Null when unpublished or not this brand's. */
async function detail(brandId, productId) {
  const { rows } = await db.query(
    `SELECT bp.id, bp.name, bp.price, bp.description, bp.image_url, bp.variants_json, bp.facets, bp.stock,
            b.id AS brand_id, b.business_name AS brand_name,
            NULLIF(concat_ws(' › ', cn.segment, cn.category, cn.name), '') AS category_path
       FROM brand_products bp
       JOIN brands b ON b.id = bp.brand_id JOIN users u ON u.id = b.user_id
       LEFT JOIN category_nodes cn ON cn.id = bp.category_node_id
      WHERE bp.brand_id = $1 AND bp.id = $2 AND ${PUBLISHED}`, [brandId, productId]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    brand: { id: r.brand_id, name: r.brand_name },
    categoryPath: r.category_path || null,
    price: r.price == null ? null : Number(r.price),
    images: allImages(r),
    sizes: sizes(r),
    outOfStock: outOfStock(r),
    description: r.description || null,
  };
}

module.exports = { PAGE, PUBLISHED, list, detail, countPublished, allImages, sizes, outOfStock };
