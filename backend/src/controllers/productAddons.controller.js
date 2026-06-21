'use strict';

/**
 * productAddons.controller.js — Food World Phase 2: dish customisation authoring.
 *
 * Brand-side write API over product_addon_groups + product_addon_items
 * (migration 113). ONE unified model:
 *   variation group  = selection_type 'single' + is_variation true
 *                      (item price = ABSOLUTE base, e.g. Half ₹70 / Full ₹114)
 *   add-on group     = selection_type 'multi'   + is_variation false
 *                      ("select up to N" via max_select; item price = +DELTA)
 *
 * Routes (mounted under /brands/me in productAddons.routes.js):
 *   GET  /brands/me/products/:productId/addon-groups  — nested groups+items
 *   POST /brands/me/products/:productId/addon-groups  — bulk-replace
 *
 * Auth: brand-owner must own the parent product. Mirrors
 * productVariants.controller's ownership guard + bulk-replace shape.
 *
 * Bulk replace HARD-deletes the product's groups (items cascade) then
 * reinserts. This is SAFE — unlike product_variants, nothing FKs these rows:
 * follower_orders.items_json stores a VALUE snapshot (name+price captured at
 * order time), so deleting/recreating addon rows never touches historical
 * orders. Verified in the Phase-1 audit.
 *
 * The returned shape is byte-identical to the follower read
 * (follower.controller.getProductDetail) so the editor and the customer app
 * consume one contract.
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

// Read groups+items for a product into the nested shape (shared by GET +
// the POST response). Mirrors follower.controller.getProductDetail.
async function readGroups(productId) {
  const { rows: groupRows } = await db.query(
    `SELECT id, name, selection_type, is_variation, is_required,
            min_select, max_select, sort_order
       FROM product_addon_groups
      WHERE product_id = $1
      ORDER BY sort_order, name`,
    [productId]
  );
  if (!groupRows.length) return [];

  const groupIds = groupRows.map(g => g.id);
  const { rows: itemRows } = await db.query(
    `SELECT id, group_id, name, price, source_product_id, is_default, sort_order
       FROM product_addon_items
      WHERE group_id = ANY($1::uuid[]) AND is_active = true
      ORDER BY sort_order, name`,
    [groupIds]
  );
  const itemsByGroup = {};
  for (const it of itemRows) {
    (itemsByGroup[it.group_id] = itemsByGroup[it.group_id] || []).push({
      id: it.id,
      name: it.name,
      price: parseFloat(it.price || 0),
      source_product_id: it.source_product_id || null,
      is_default: it.is_default === true,
      sort_order: it.sort_order,
    });
  }
  return groupRows.map(g => ({
    id: g.id,
    name: g.name,
    selection_type: g.selection_type,
    is_variation: g.is_variation === true,
    is_required: g.is_required === true,
    min_select: g.min_select,
    max_select: g.max_select,
    sort_order: g.sort_order,
    items: itemsByGroup[g.id] || [],
  }));
}

// Validate the desired group/item payload. Throws AppError(422) on any
// problem BEFORE the transaction opens, so a bad request never writes
// partial rows.
function validateGroups(groups) {
  if (!Array.isArray(groups)) {
    throw new AppError('VALIDATION_ERROR', 'groups must be an array', 422, 'groups');
  }
  groups.forEach((g, gi) => {
    if (!g || typeof g.name !== 'string' || !g.name.trim()) {
      throw new AppError('VALIDATION_ERROR', `group ${gi + 1}: name is required`, 422, 'groups');
    }
    if (!['single', 'multi'].includes(g.selection_type)) {
      throw new AppError('VALIDATION_ERROR', `group "${g.name}": selection_type must be 'single' or 'multi'`, 422, 'selection_type');
    }
    // A variation (portion) is inherently single-select.
    if (g.is_variation === true && g.selection_type !== 'single') {
      throw new AppError('VALIDATION_ERROR', `group "${g.name}": a variation group must be single-select`, 422, 'is_variation');
    }
    const items = Array.isArray(g.items) ? g.items : [];
    if (!items.length) {
      throw new AppError('VALIDATION_ERROR', `group "${g.name}": at least one option is required`, 422, 'items');
    }
    if (g.max_select != null && Number(g.max_select) < 1) {
      throw new AppError('VALIDATION_ERROR', `group "${g.name}": max_select must be >= 1`, 422, 'max_select');
    }
    items.forEach((it, ii) => {
      if (!it || typeof it.name !== 'string' || !it.name.trim()) {
        throw new AppError('VALIDATION_ERROR', `group "${g.name}" option ${ii + 1}: name is required`, 422, 'items');
      }
      const price = Number(it.price);
      if (!Number.isFinite(price) || price < 0) {
        throw new AppError('VALIDATION_ERROR', `option "${it.name}": price must be a number >= 0`, 422, 'price');
      }
    });
  });
}

// ── GET /brands/me/products/:productId/addon-groups ──────────────────────────

const getAddonGroups = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  await assertProductOwnership(req.params.productId, brandId);
  const groups = await readGroups(req.params.productId);
  return success(res, { groups });
});

// ── POST /brands/me/products/:productId/addon-groups ─────────────────────────
// Body: { groups: [ { name, selection_type, is_variation, is_required,
//                     min_select, max_select, sort_order,
//                     items: [{ name, price, is_default, source_product_id?, sort_order }] } ] }
// Bulk-replace: the posted set becomes the product's complete customisation.

const replaceAddonGroups = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  await assertProductOwnership(req.params.productId, brandId);

  const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];
  validateGroups(groups);

  // "Pull from my menu" records source_product_id. Defensive: any source id
  // provided must be one of this brand's own products, else drop it to null
  // (provenance only — never a cross-brand leak).
  const srcIds = [...new Set(
    groups.flatMap(g => (g.items || []).map(it => it.source_product_id).filter(Boolean))
  )];
  let ownSrc = new Set();
  if (srcIds.length) {
    const { rows } = await db.query(
      `SELECT id FROM brand_products WHERE id = ANY($1::uuid[]) AND brand_id = $2`,
      [srcIds, brandId]
    );
    ownSrc = new Set(rows.map(r => r.id));
  }

  await db.withTransaction(async (client) => {
    // Hard-delete the current set (items cascade). Safe: items_json is a
    // value snapshot, no FK references these rows.
    await client.query(`DELETE FROM product_addon_groups WHERE product_id = $1`, [req.params.productId]);

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const { rows: gRows } = await client.query(
        `INSERT INTO product_addon_groups
           (product_id, name, selection_type, is_variation, is_required,
            min_select, max_select, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          req.params.productId,
          g.name.trim(),
          g.selection_type,
          g.is_variation === true,
          g.is_required === true,
          g.min_select != null ? parseInt(g.min_select, 10) : 0,
          g.max_select != null ? parseInt(g.max_select, 10) : null,
          g.sort_order != null ? parseInt(g.sort_order, 10) : gi,
        ]
      );
      const groupId = gRows[0].id;

      const items = Array.isArray(g.items) ? g.items : [];
      for (let ii = 0; ii < items.length; ii++) {
        const it = items[ii];
        const src = it.source_product_id && ownSrc.has(it.source_product_id)
          ? it.source_product_id : null;
        await client.query(
          `INSERT INTO product_addon_items
             (group_id, name, price, source_product_id, is_default, is_active, sort_order)
           VALUES ($1,$2,$3,$4,$5,true,$6)`,
          [
            groupId,
            it.name.trim(),
            parseFloat(it.price),
            src,
            it.is_default === true,
            it.sort_order != null ? parseInt(it.sort_order, 10) : ii,
          ]
        );
      }
    }
  });

  const groupsOut = await readGroups(req.params.productId);
  return success(res, { groups: groupsOut });
});

module.exports = {
  getAddonGroups,
  replaceAddonGroups,
};
