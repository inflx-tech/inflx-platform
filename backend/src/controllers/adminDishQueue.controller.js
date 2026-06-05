'use strict';

/**
 * adminDishQueue.controller.js
 *
 * Contract: features/listing-restaurant-search-flywheel.
 *
 * The inbound side of the dish dictionary — custom names sellers typed that
 * aren't canonical yet (pending_dishes). Surfaced as a "Review Queue" tab
 * inside the existing Master Dishes admin area. Admin resolves each grouped
 * name as: alias (link to a canonical dish), promote (new master_dishes row),
 * or reject (stays a one-off).
 *
 * Routes (admin.routes.js, requireAdminRole('reviewer')):
 *   GET   /admin/master-dishes/queue          — grouped pending names
 *   PATCH /admin/master-dishes/queue/:id      — resolve a group {action,...}
 *
 * "Promote" reuses the same INSERT shape as adminMasterDish.createMasterDish.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { PROMOTE_THRESHOLD } = require('../services/dishFlywheel.service');

// ── GET /admin/master-dishes/queue ───────────────────────────────────────────
// Groups pending rows by normalized name. Each group: representative raw_name,
// distinct restaurant count, the best suggested canonical match, and a
// flywheel flag when >= PROMOTE_THRESHOLD restaurants share the name.

const listQueue = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT
       g.norm_name,
       g.raw_name,
       g.section,
       g.rep_id,
       g.restaurant_count,
       g.suggested_master_dish_id,
       md.name AS suggested_name,
       g.suggested_score
     FROM (
       SELECT
         norm_name,
         (array_agg(raw_name ORDER BY created_at))[1]                                   AS raw_name,
         (array_agg(section  ORDER BY created_at))[1]                                   AS section,
         (array_agg(id       ORDER BY created_at))[1]                                   AS rep_id,
         COUNT(DISTINCT brand_id)::int                                                  AS restaurant_count,
         (array_agg(suggested_master_dish_id ORDER BY suggested_score DESC NULLS LAST))[1] AS suggested_master_dish_id,
         MAX(suggested_score)                                                           AS suggested_score
       FROM pending_dishes
       WHERE status = 'pending'
       GROUP BY norm_name
     ) g
     LEFT JOIN master_dishes md ON md.id = g.suggested_master_dish_id
     ORDER BY g.restaurant_count DESC, g.raw_name`
  );

  const items = rows.map(r => ({
    id: r.rep_id,
    raw_name: r.raw_name,
    section: r.section,
    restaurant_count: r.restaurant_count,
    suggested: r.suggested_master_dish_id
      ? { master_dish_id: r.suggested_master_dish_id, name: r.suggested_name, score: Number(r.suggested_score) }
      : null,
    auto_promote_candidate: !r.suggested_master_dish_id && r.restaurant_count >= PROMOTE_THRESHOLD,
  }));

  return success(res, { items });
});

// ── PATCH /admin/master-dishes/queue/:id ─────────────────────────────────────
// Resolves the whole group sharing the representative row's norm_name.
// Body: { action: 'alias'|'promote'|'reject', master_dish_id?, cuisine?, section? }

const resolveQueueItem = asyncHandler(async (req, res) => {
  const repId = parseInt(req.params.id, 10);
  if (!Number.isInteger(repId)) throw new AppError('VALIDATION_ERROR', 'invalid id', 422);

  const action = (req.body || {}).action;
  if (!['alias', 'promote', 'reject'].includes(action)) {
    throw new AppError('VALIDATION_ERROR', "action must be 'alias', 'promote' or 'reject'", 422, 'action');
  }
  const resolver = req.user?.sub || 'admin';

  const { rows: repRows } = await db.query(
    `SELECT norm_name, raw_name, section FROM pending_dishes WHERE id = $1`, [repId]
  );
  if (!repRows[0]) throw new AppError('NOT_FOUND', 'queue item not found', 404);
  const { norm_name, raw_name, section } = repRows[0];

  // All still-pending listings sharing this name (across restaurants).
  const { rows: group } = await db.query(
    `SELECT brand_product_id FROM pending_dishes
      WHERE norm_name = $1 AND status = 'pending' AND brand_product_id IS NOT NULL`,
    [norm_name]
  );
  const productIds = group.map(g => g.brand_product_id);

  return db.withTransaction(async (tx) => {
    let masterDishId = null;
    let resultStatus = null;

    if (action === 'alias') {
      masterDishId = parseInt((req.body.master_dish_id), 10);
      if (!Number.isInteger(masterDishId)) {
        throw new AppError('VALIDATION_ERROR', 'master_dish_id required for alias', 422, 'master_dish_id');
      }
      const { rows: md } = await tx.query(`SELECT id FROM master_dishes WHERE id = $1`, [masterDishId]);
      if (!md[0]) throw new AppError('NOT_FOUND', 'master dish not found', 404);

      await tx.query(
        `INSERT INTO dish_aliases (master_dish_id, alias_text, source)
         VALUES ($1, $2, 'promotion')
         ON CONFLICT (master_dish_id, alias_text) DO NOTHING`,
        [masterDishId, raw_name]
      );
      resultStatus = 'alias';
    }

    if (action === 'promote') {
      const cuisine = (req.body.cuisine || '').trim();
      const promoteSection = (req.body.section || section || '').trim();
      if (!cuisine || !promoteSection) {
        throw new AppError('VALIDATION_ERROR', 'cuisine and section required to promote', 422);
      }
      const { rows: maxRows } = await tx.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM master_dishes WHERE cuisine = $1 AND section = $2`,
        [cuisine, promoteSection]
      );
      const { rows: created } = await tx.query(
        `INSERT INTO master_dishes (cuisine, section, name, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [cuisine, promoteSection, raw_name, maxRows[0].next]
      );
      masterDishId = created[0].id;
      resultStatus = 'promoted';
    }

    if (action === 'reject') {
      resultStatus = 'rejected';
    }

    // Link the affected listings to the canonical dish (alias/promote only).
    let linked = 0;
    if (masterDishId && productIds.length) {
      const { rowCount } = await tx.query(
        `UPDATE brand_products SET master_dish_id = $1
          WHERE id = ANY($2::uuid[]) AND master_dish_id IS NULL`,
        [masterDishId, productIds]
      );
      linked = rowCount;
    }

    // Close out the whole pending group.
    await tx.query(
      `UPDATE pending_dishes
          SET status = $1, resolver = $2, resolved_at = now()
        WHERE norm_name = $3 AND status = 'pending'`,
      [resultStatus, resolver, norm_name]
    );

    return success(res, {
      id: repId,
      status: resultStatus,
      master_dish_id: masterDishId,
      linked_listings: linked,
    });
  });
});

module.exports = { listQueue, resolveQueueItem };
