'use strict';

/**
 * adminDishGroups.controller.js — admin CRUD for food-discovery dish groups
 * (migration 115). A group = a tile (Biryani, Paratha, Pizza) with explicit
 * member master_dishes + an optional name keyword. Gated requireCapability
 * ('master_data') in admin.routes.js.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /admin/dish-groups — all groups (incl. hidden) with member counts.
const listDishGroups = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT g.id, g.name, g.image_url, g.keyword, g.sort_order, g.status,
            (SELECT COUNT(*) FROM dish_group_dishes d WHERE d.dish_group_id = g.id)::int AS member_count
       FROM dish_groups g
      ORDER BY g.sort_order, g.name`
  );
  return success(res, { groups: rows });
});

// POST /admin/dish-groups — create a group.
const createDishGroup = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  const { rows } = await db.query(
    `INSERT INTO dish_groups (name, image_url, keyword, sort_order)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, b.image_url || null, (b.keyword || '').trim() || null,
     Number.isInteger(b.sort_order) ? b.sort_order : 0]
  );
  return success(res, { group: rows[0] }, 201);
});

// PATCH /admin/dish-groups/:id — partial update (name/image/keyword/sort/enabled).
const updateDishGroup = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw new AppError('VALIDATION_ERROR', 'bad id', 422);
  const sets = [];
  const params = [id];
  const put = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

  if (req.body.name !== undefined) {
    const n = String(req.body.name).trim();
    if (!n) throw new AppError('VALIDATION_ERROR', 'name cannot be empty', 422, 'name');
    put('name', n);
  }
  if (req.body.image_url !== undefined) put('image_url', req.body.image_url || null);
  if (req.body.keyword !== undefined) put('keyword', (req.body.keyword || '').trim() || null);
  if (req.body.sort_order !== undefined) {
    const so = Number(req.body.sort_order);
    if (!Number.isInteger(so)) throw new AppError('VALIDATION_ERROR', 'sort_order must be an integer', 422);
    put('sort_order', so);
  }
  if (req.body.enabled !== undefined) put('status', req.body.enabled ? 'active' : 'hidden');

  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'no fields to update', 422);
  sets.push('updated_at = now()');
  const { rows } = await db.query(
    `UPDATE dish_groups SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'dish group not found', 404);
  return success(res, { group: rows[0] });
});

// DELETE /admin/dish-groups/:id — soft-hide (keeps it referenceable).
const deleteDishGroup = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows } = await db.query(
    `UPDATE dish_groups SET status='hidden', updated_at=now() WHERE id=$1 RETURNING id`, [id]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'dish group not found', 404);
  return success(res, { ok: true });
});

// GET /admin/dish-groups/:id/members — the member dishes of a group.
const getGroupMembers = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows } = await db.query(
    `SELECT md.id, md.cuisine, md.section, md.name
       FROM dish_group_dishes d
       JOIN master_dishes md ON md.id = d.master_dish_id
      WHERE d.dish_group_id = $1
      ORDER BY md.cuisine, md.section, md.name`, [id]);
  return success(res, { members: rows });
});

// PUT /admin/dish-groups/:id/members — replace the member set.
// Body: { master_dish_ids: [int, ...] }
const setGroupMembers = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const ids = Array.isArray(req.body?.master_dish_ids)
    ? [...new Set(req.body.master_dish_ids.map(x => parseInt(x, 10)).filter(Number.isInteger))]
    : [];
  const { rows: g } = await db.query(`SELECT id FROM dish_groups WHERE id=$1`, [id]);
  if (!g[0]) throw new AppError('NOT_FOUND', 'dish group not found', 404);

  await db.withTransaction(async (client) => {
    await client.query(`DELETE FROM dish_group_dishes WHERE dish_group_id=$1`, [id]);
    if (ids.length) {
      await client.query(
        `INSERT INTO dish_group_dishes (dish_group_id, master_dish_id)
         SELECT $1, x FROM unnest($2::int[]) AS x
          WHERE EXISTS (SELECT 1 FROM master_dishes m WHERE m.id = x)
         ON CONFLICT DO NOTHING`,
        [id, ids]);
    }
  });

  const { rows } = await db.query(
    `SELECT md.id, md.cuisine, md.section, md.name
       FROM dish_group_dishes d JOIN master_dishes md ON md.id=d.master_dish_id
      WHERE d.dish_group_id=$1 ORDER BY md.cuisine, md.section, md.name`, [id]);
  return success(res, { members: rows });
});

// GET /admin/dish-groups/suggest?q=biryani — master_dishes whose name matches,
// for the create-group auto-suggest (admin pre-ticks these).
const suggestMembers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return success(res, { suggestions: [] });
  const { rows } = await db.query(
    `SELECT id, cuisine, section, name
       FROM master_dishes
      WHERE name ILIKE '%' || $1 || '%'
      ORDER BY cuisine, section, name
      LIMIT 200`, [q]);
  return success(res, { suggestions: rows });
});

module.exports = {
  listDishGroups,
  createDishGroup,
  updateDishGroup,
  deleteDishGroup,
  getGroupMembers,
  setGroupMembers,
  suggestMembers,
};
