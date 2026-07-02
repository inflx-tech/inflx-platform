'use strict';

/**
 * influencerGroup.controller.js — F-5 server-persisted influencer groups.
 *
 * Brand-side CRUD over saved groups of influencers (migration 123:
 * influencer_groups + influencer_group_members). Auth: authenticated brand
 * user; every query is scoped to the caller's brand_id (resolved from
 * req.user.sub → brands.id), so a brand only ever sees/modifies its own groups.
 *
 * Routes (mounted under /brands/me in influencerGroup.routes.js):
 *   GET    /brands/me/influencer-groups              — list groups (+ members)
 *   POST   /brands/me/influencer-groups              — create (optional seed members)
 *   PATCH  /brands/me/influencer-groups/:id          — rename
 *   DELETE /brands/me/influencer-groups/:id          — delete (cascade members)
 *   POST   /brands/me/influencer-groups/:id/members  — add members (ignore dupes)
 *   DELETE /brands/me/influencer-groups/:id/members/:influencerId — remove one
 *
 * The list/create/add responses embed each member as
 * { id, full_name, instagram_handle } plus an influencer_ids[] array and
 * member_count — the exact shape the campaign wizard's addGroupToSet() expects
 * so a whole group can be expanded into a set.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function getBrandIdByUserId(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

// Fetch one group (brand-scoped) with its members joined from influencers.
// Returns null if the group doesn't exist or isn't owned by this brand.
async function loadGroupWithMembers(groupId, brandId) {
  const { rows: grp } = await db.query(
    `SELECT id, brand_id, name, created_at, updated_at
       FROM influencer_groups
      WHERE id = $1 AND brand_id = $2`,
    [groupId, brandId]
  );
  if (!grp[0]) return null;

  const { rows: members } = await db.query(
    `SELECT i.id, i.full_name, i.instagram_handle, m.added_at
       FROM influencer_group_members m
       JOIN influencers i ON i.id = m.influencer_id
      WHERE m.group_id = $1
      ORDER BY m.added_at ASC`,
    [groupId]
  );

  return {
    ...grp[0],
    members,
    influencer_ids: members.map((r) => r.id),
    member_count: members.length,
  };
}

// Validate that every id in influencer_ids is a real influencer. Returns an
// array of the (de-duped) valid ids, or throws VALIDATION_ERROR if any is unknown.
async function resolveInfluencerIds(rawIds) {
  if (!Array.isArray(rawIds)) {
    throw new AppError('VALIDATION_ERROR', 'influencer_ids must be an array', 422, 'influencer_ids');
  }
  const ids = [...new Set(rawIds.filter(Boolean).map(String))];
  if (ids.length === 0) return [];

  const { rows } = await db.query(
    `SELECT id FROM influencers WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw new AppError('VALIDATION_ERROR', `Unknown influencer id(s): ${missing.join(', ')}`, 422, 'influencer_ids');
  }
  return ids;
}

// ── GET /brands/me/influencer-groups ─────────────────────────────────────────
const listGroups = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { rows: groups } = await db.query(
    `SELECT id, brand_id, name, created_at, updated_at
       FROM influencer_groups
      WHERE brand_id = $1
      ORDER BY created_at DESC`,
    [brandId]
  );

  // Single query for all members across this brand's groups, then bucket.
  const { rows: members } = await db.query(
    `SELECT m.group_id, i.id, i.full_name, i.instagram_handle, m.added_at
       FROM influencer_group_members m
       JOIN influencer_groups g ON g.id = m.group_id
       JOIN influencers i       ON i.id = m.influencer_id
      WHERE g.brand_id = $1
      ORDER BY m.added_at ASC`,
    [brandId]
  );
  const byGroup = new Map();
  for (const m of members) {
    if (!byGroup.has(m.group_id)) byGroup.set(m.group_id, []);
    byGroup.get(m.group_id).push({
      id: m.id, full_name: m.full_name, instagram_handle: m.instagram_handle, added_at: m.added_at,
    });
  }

  const out = groups.map((g) => {
    const mem = byGroup.get(g.id) || [];
    return { ...g, members: mem, influencer_ids: mem.map((r) => r.id), member_count: mem.length };
  });

  return success(res, { groups: out });
});

// ── POST /brands/me/influencer-groups ────────────────────────────────────────
// Body: { name, influencer_ids? }
const createGroup = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { name, influencer_ids } = req.body || {};
  if (!name || !String(name).trim()) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }
  if (String(name).trim().length > 120) {
    throw new AppError('VALIDATION_ERROR', 'name must be 120 characters or fewer', 422, 'name');
  }

  // Validate members up-front (before insert) so we never create a group with a
  // bogus member id.
  const ids = influencer_ids !== undefined ? await resolveInfluencerIds(influencer_ids) : [];

  const { rows } = await db.query(
    `INSERT INTO influencer_groups (brand_id, name) VALUES ($1, $2) RETURNING id`,
    [brandId, String(name).trim()]
  );
  const groupId = rows[0].id;

  if (ids.length) {
    await db.query(
      `INSERT INTO influencer_group_members (group_id, influencer_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT (group_id, influencer_id) DO NOTHING`,
      [groupId, ids]
    );
  }

  const group = await loadGroupWithMembers(groupId, brandId);
  return success(res, { group }, 201);
});

// ── PATCH /brands/me/influencer-groups/:id ───────────────────────────────────
// Body: { name }
const renameGroup = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }
  if (String(name).trim().length > 120) {
    throw new AppError('VALIDATION_ERROR', 'name must be 120 characters or fewer', 422, 'name');
  }

  const { rows } = await db.query(
    `UPDATE influencer_groups SET name = $1, updated_at = now()
      WHERE id = $2 AND brand_id = $3
      RETURNING id`,
    [String(name).trim(), req.params.id, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Group not found', 404);

  const group = await loadGroupWithMembers(req.params.id, brandId);
  return success(res, { group });
});

// ── DELETE /brands/me/influencer-groups/:id ──────────────────────────────────
// Members cascade-delete via the FK.
const deleteGroup = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { rows } = await db.query(
    `DELETE FROM influencer_groups WHERE id = $1 AND brand_id = $2 RETURNING id`,
    [req.params.id, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Group not found', 404);
  return success(res, { deleted: true, id: rows[0].id });
});

// ── POST /brands/me/influencer-groups/:id/members ────────────────────────────
// Body: { influencer_ids: [] } — add members, ignoring duplicates.
const addMembers = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  // Ownership check.
  const { rows: own } = await db.query(
    `SELECT id FROM influencer_groups WHERE id = $1 AND brand_id = $2`,
    [req.params.id, brandId]
  );
  if (!own[0]) throw new AppError('NOT_FOUND', 'Group not found', 404);

  const ids = await resolveInfluencerIds((req.body || {}).influencer_ids);
  if (ids.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'influencer_ids must contain at least one id', 422, 'influencer_ids');
  }

  await db.query(
    `INSERT INTO influencer_group_members (group_id, influencer_id)
     SELECT $1, unnest($2::uuid[])
     ON CONFLICT (group_id, influencer_id) DO NOTHING`,
    [req.params.id, ids]
  );
  await db.query(`UPDATE influencer_groups SET updated_at = now() WHERE id = $1`, [req.params.id]);

  const group = await loadGroupWithMembers(req.params.id, brandId);
  return success(res, { group });
});

// ── DELETE /brands/me/influencer-groups/:id/members/:influencerId ────────────
const removeMember = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  // Ownership check.
  const { rows: own } = await db.query(
    `SELECT id FROM influencer_groups WHERE id = $1 AND brand_id = $2`,
    [req.params.id, brandId]
  );
  if (!own[0]) throw new AppError('NOT_FOUND', 'Group not found', 404);

  await db.query(
    `DELETE FROM influencer_group_members WHERE group_id = $1 AND influencer_id = $2`,
    [req.params.id, req.params.influencerId]
  );
  await db.query(`UPDATE influencer_groups SET updated_at = now() WHERE id = $1`, [req.params.id]);

  const group = await loadGroupWithMembers(req.params.id, brandId);
  return success(res, { group });
});

module.exports = {
  listGroups,
  createGroup,
  renameGroup,
  deleteGroup,
  addMembers,
  removeMember,
};
