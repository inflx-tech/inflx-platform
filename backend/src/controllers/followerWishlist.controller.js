'use strict';

/**
 * followerWishlist.controller — product Wishlist + collections (Stage C2).
 * Contract: features/concept-stagec2-bag-wishlist/
 *
 * Board rules encoded here:
 * - Rows are POINTERS; the list endpoint joins LIVE brand_products so a dead
 *   or out-of-stock product renders greyed ("Currently unavailable"), never
 *   as a stale copy. available = is_active AND (stock IS NULL OR stock > 0).
 * - Card prices reuse the exact same best-live-discount machinery as the PDP
 *   and shelves (OFFER_BEST_PCT + offerFieldsFromPct) — one evaluator, no
 *   drift between what the wishlist shows and what the bag charges.
 * - Collections are follower-private; one item may sit in many collections;
 *   deleting a collection never deletes the items.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { OFFER_BEST_PCT, offerFieldsFromPct } = require('../services/sectionRules.service');

async function getFollowerId(userSub) {
  const { rows } = await db.query(`SELECT id FROM followers WHERE user_id = $1`, [userSub]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);
  return rows[0].id;
}

// ── GET /followers/wishlist ──────────────────────────────────────────────────
const list = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);

  const { rows: items } = await db.query(
    `SELECT wi.id AS item_id, wi.product_id, wi.created_at,
            bp.name, bp.price, bp.image_url, bp.variants_json, bp.brand_id,
            b.name AS brand_name,
            (bp.id IS NOT NULL AND bp.is_active = true
              AND (bp.stock IS NULL OR bp.stock > 0)) AS available,
            CASE WHEN bp.id IS NULL OR bp.is_active = false THEN NULL
                 ELSE ${OFFER_BEST_PCT} END AS offer_pct,
            COALESCE(
              (SELECT array_agg(ci.collection_id)
                 FROM follower_wishlist_collection_items ci
                WHERE ci.item_id = wi.id), '{}') AS collection_ids
       FROM follower_wishlist_items wi
       LEFT JOIN brand_products bp ON bp.id = wi.product_id
       LEFT JOIN brands b ON b.id = bp.brand_id
      WHERE wi.follower_id = $1
      ORDER BY wi.created_at DESC`,
    [followerId]
  );

  const { rows: collections } = await db.query(
    `SELECT c.id, c.name, c.created_at,
            (SELECT count(*)::int FROM follower_wishlist_collection_items ci
              WHERE ci.collection_id = c.id) AS item_count
       FROM follower_wishlist_collections c
      WHERE c.follower_id = $1
      ORDER BY c.created_at ASC`,
    [followerId]
  );

  return success(res, {
    items: items.map((r) => {
      const price = r.price != null ? Number(r.price) : null;
      return {
        product_id: r.product_id,
        name: r.name,
        image_url: r.image_url,
        price,
        ...offerFieldsFromPct(r.offer_pct, price),
        brand_id: r.brand_id,
        brand_name: r.brand_name,
        available: !!r.available,
        has_variants: !!(r.variants_json && JSON.stringify(r.variants_json) !== '[]' && JSON.stringify(r.variants_json) !== '{}'),
        collection_ids: r.collection_ids || [],
        created_at: r.created_at,
      };
    }),
    collections,
  });
});

// ── POST /followers/wishlist/items { product_id } ───────────────────────────
const addItem = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);
  const { product_id } = req.body || {};
  if (!product_id) throw new AppError('VALIDATION_ERROR', 'product_id is required', 400, 'product_id');
  const { rows } = await db.query(
    `INSERT INTO follower_wishlist_items (follower_id, product_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_id, product_id) DO UPDATE SET product_id = EXCLUDED.product_id
     RETURNING id, product_id`,
    [followerId, product_id]
  );
  return success(res, { item: rows[0] });
});

// ── DELETE /followers/wishlist/items/:product_id ─────────────────────────────
const removeItem = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);
  await db.query(
    `DELETE FROM follower_wishlist_items WHERE follower_id = $1 AND product_id = $2`,
    [followerId, req.params.product_id]
  );
  return success(res, { removed: true });
});

// ── POST /followers/wishlist/collections { name } ────────────────────────────
const createCollection = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);
  const name = String(req.body?.name || '').trim();
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required', 400, 'name');
  if (name.length > 40) throw new AppError('VALIDATION_ERROR', 'name too long (max 40)', 400, 'name');
  const { rows } = await db.query(
    `INSERT INTO follower_wishlist_collections (follower_id, name)
     VALUES ($1, $2)
     ON CONFLICT (follower_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, created_at`,
    [followerId, name]
  );
  return success(res, { collection: rows[0] });
});

// ── PATCH /followers/wishlist/collections/:id { name } ──────────────────────
const renameCollection = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);
  const name = String(req.body?.name || '').trim();
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required', 400, 'name');
  const { rows } = await db.query(
    `UPDATE follower_wishlist_collections SET name = $3
      WHERE id = $1 AND follower_id = $2
      RETURNING id, name`,
    [req.params.id, followerId, name]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Collection not found', 404);
  return success(res, { collection: rows[0] });
});

// ── DELETE /followers/wishlist/collections/:id ───────────────────────────────
const deleteCollection = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);
  await db.query(
    `DELETE FROM follower_wishlist_collections WHERE id = $1 AND follower_id = $2`,
    [req.params.id, followerId]
  );
  return success(res, { removed: true });
});

// ── POST /followers/wishlist/collections/:id/items { product_id } ───────────
// Adds the product to the wishlist too if it isn't there yet — assigning to a
// collection implies wishlisting (one tap on the board's long-press flow).
const assignItem = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);
  const { product_id } = req.body || {};
  if (!product_id) throw new AppError('VALIDATION_ERROR', 'product_id is required', 400, 'product_id');

  const { rows: coll } = await db.query(
    `SELECT id FROM follower_wishlist_collections WHERE id = $1 AND follower_id = $2`,
    [req.params.id, followerId]
  );
  if (!coll[0]) throw new AppError('NOT_FOUND', 'Collection not found', 404);

  const { rows: item } = await db.query(
    `INSERT INTO follower_wishlist_items (follower_id, product_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_id, product_id) DO UPDATE SET product_id = EXCLUDED.product_id
     RETURNING id`,
    [followerId, product_id]
  );
  await db.query(
    `INSERT INTO follower_wishlist_collection_items (collection_id, item_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.params.id, item[0].id]
  );
  return success(res, { assigned: true });
});

// ── DELETE /followers/wishlist/collections/:id/items/:product_id ────────────
const unassignItem = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);
  await db.query(
    `DELETE FROM follower_wishlist_collection_items ci
      USING follower_wishlist_items wi, follower_wishlist_collections c
      WHERE ci.collection_id = $1 AND c.id = $1 AND c.follower_id = $2
        AND ci.item_id = wi.id AND wi.product_id = $3 AND wi.follower_id = $2`,
    [req.params.id, followerId, req.params.product_id]
  );
  return success(res, { unassigned: true });
});

module.exports = {
  list,
  addItem,
  removeItem,
  createCollection,
  renameCollection,
  deleteCollection,
  assignItem,
  unassignItem,
};
