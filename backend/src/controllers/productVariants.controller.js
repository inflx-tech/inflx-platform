'use strict';

/**
 * productVariants.controller.js — Fashion-1 SKU management.
 *
 * Brand-side CRUD over product_variants (migration 047). Auth: brand-owner
 * must own the parent product (brand_products.brand_id == req.user.brand_id).
 *
 * Routes (mounted under /brands/me in productVariants.routes.js):
 *   GET    /brands/me/products/:productId/variants            — list SKUs
 *   POST   /brands/me/products/:productId/variants            — bulk-replace SKUs
 *   PATCH  /brands/me/products/:productId/variants/:variantId — update stock/price/image
 *   DELETE /brands/me/products/:productId/variants/:variantId — soft-deactivate
 *
 * Bulk replace (POST) is the primary flow — brand-web's variant builder
 * sends the full desired SKU set per product after each authoring change.
 * The endpoint diffs against existing rows: new combos inserted, existing
 * updated, missing combos deactivated (is_active=false, not deleted, so
 * referenced rows in follower_returns/follower_orders keep their FK).
 *
 * Public-side GET lives on /business/:brand_id/store (extended in
 * follower.service.js to include variants for each product).
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getBrandIdByUserId(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

async function assertProductOwnership(productId, brandId) {
  const { rows } = await db.query(
    `SELECT id FROM brand_products WHERE id = $1 AND brand_id = $2`,
    [productId, brandId]
  );
  if (!rows[0]) throw new AppError('FORBIDDEN', 'Product not found or not owned by this brand', 403);
}

// ── GET /brands/me/products/:productId/variants ──────────────────────────────

const listVariants = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  await assertProductOwnership(req.params.productId, brandId);

  const { rows } = await db.query(
    `SELECT id, size, color, sku, price_override, stock, image_url, is_active, created_at
       FROM product_variants
      WHERE product_id = $1 AND is_active = true
      ORDER BY size NULLS LAST, color NULLS LAST, created_at`,
    [req.params.productId]
  );
  return success(res, { variants: rows });
});

// ── POST /brands/me/products/:productId/variants ─────────────────────────────
// Body: { variants: [{ size, color, sku?, price_override?, stock, image_url? }, ...] }
// Replaces the active variant set for this product. New rows inserted,
// existing rows (matched by size+color) updated, missing rows deactivated.

const replaceVariants = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  await assertProductOwnership(req.params.productId, brandId);

  const desired = Array.isArray(req.body?.variants) ? req.body.variants : [];

  // Basic validation — each variant needs at least size or color, plus stock
  for (const v of desired) {
    if (!v.size && !v.color) {
      throw new AppError('VALIDATION_ERROR', 'Each variant needs at least a size or color', 422);
    }
    if (v.stock != null && !Number.isFinite(Number(v.stock))) {
      throw new AppError('VALIDATION_ERROR', 'stock must be a number', 422);
    }
  }

  await db.withTransaction(async (client) => {
    // Load existing active variants for this product
    const { rows: existing } = await client.query(
      `SELECT id, size, color FROM product_variants
        WHERE product_id = $1 AND is_active = true`,
      [req.params.productId]
    );

    // Build a key → existing-id map for quick matching
    const keyOf = (s, c) => `${s || ''}|${c || ''}`;
    const existingMap = new Map(existing.map(r => [keyOf(r.size, r.color), r.id]));

    // Upsert each desired variant
    const seen = new Set();
    for (const v of desired) {
      const key = keyOf(v.size, v.color);
      seen.add(key);
      if (existingMap.has(key)) {
        // Update in place
        await client.query(
          `UPDATE product_variants
              SET sku = $1, price_override = $2, stock = $3, image_url = $4, is_active = true
            WHERE id = $5`,
          [v.sku || null, v.price_override ?? null, v.stock ?? 0, v.image_url || null, existingMap.get(key)]
        );
      } else {
        // Insert new
        await client.query(
          `INSERT INTO product_variants (product_id, size, color, sku, price_override, stock, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.params.productId, v.size || null, v.color || null, v.sku || null, v.price_override ?? null, v.stock ?? 0, v.image_url || null]
        );
      }
    }

    // Deactivate missing (preserves FK integrity for orders/returns)
    for (const [key, id] of existingMap.entries()) {
      if (!seen.has(key)) {
        await client.query(
          `UPDATE product_variants SET is_active = false WHERE id = $1`,
          [id]
        );
      }
    }
  });

  // Return the fresh list
  const { rows } = await db.query(
    `SELECT id, size, color, sku, price_override, stock, image_url, is_active
       FROM product_variants
      WHERE product_id = $1 AND is_active = true
      ORDER BY size NULLS LAST, color NULLS LAST, created_at`,
    [req.params.productId]
  );
  return success(res, { variants: rows });
});

// ── PATCH /brands/me/products/:productId/variants/:variantId ─────────────────

const updateVariant = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  await assertProductOwnership(req.params.productId, brandId);

  const allowed = ['stock', 'price_override', 'image_url', 'sku'];
  const fields = [];
  const vals = [];
  for (const k of allowed) {
    if (req.body?.[k] !== undefined) {
      fields.push(`${k} = $${fields.length + 1}`);
      vals.push(req.body[k]);
    }
  }
  if (fields.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No updatable fields provided', 422);
  }
  vals.push(req.params.variantId, req.params.productId);

  const { rows } = await db.query(
    `UPDATE product_variants SET ${fields.join(', ')}
      WHERE id = $${vals.length - 1} AND product_id = $${vals.length}
      RETURNING id, size, color, sku, price_override, stock, image_url, is_active`,
    vals
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Variant not found', 404);
  return success(res, { variant: rows[0] });
});

// ── DELETE /brands/me/products/:productId/variants/:variantId ────────────────
// Soft-delete (is_active = false) to preserve FK from follower_returns

const deleteVariant = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  await assertProductOwnership(req.params.productId, brandId);

  await db.query(
    `UPDATE product_variants SET is_active = false
      WHERE id = $1 AND product_id = $2`,
    [req.params.variantId, req.params.productId]
  );
  return success(res, { ok: true });
});

module.exports = {
  listVariants,
  replaceVariants,
  updateVariant,
  deleteVariant,
};
