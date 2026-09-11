'use strict';

/**
 * influencerGroup.controller.js — creator groups (rules v1.11 §5A).
 * Contract: features/item3-discovery-profiles-groups · prompt A8, §6.5
 *
 * The tables and the six original routes (mig 123, brand website "Shortlist") stay. Item 3
 * adds the §5A rules and the phone screens' needs on top, keeping every original response
 * a SUPERSET so the website keeps working:
 *
 *   GET    /brands/me/influencer-groups                     list (+ counts, avatars; recently updated first)
 *   POST   /brands/me/influencer-groups                     create { name, influencer_ids? }
 *   PATCH  /brands/me/influencer-groups/:id                 rename { name }
 *   DELETE /brands/me/influencer-groups/:id                 delete (members cascade; nothing else touched)
 *   POST   /brands/me/influencer-groups/:id/members         add { influencer_ids[] } → { added, skipped, capacityLeft }
 *   DELETE /brands/me/influencer-groups/:id/members/:iid    remove one
 *   GET    /brands/me/influencer-groups/:id                 detail: header + members paged with live status   (new)
 *   GET    /brands/me/influencer-groups/for-creator/:iid    which of this brand's groups contain her          (new)
 *   PUT    /brands/me/influencer-groups/for-creator/:iid    set her groups { groupIds[] } in one transaction  (new)
 *
 * Rules (all server-side): name 1–40 after trimming, unique per brand ignoring case; at most
 * 100 members; only approved creators can be added; a suspended creator is HIDDEN from every
 * read and count but keeps her rows (founder Q11); a rejected creator's rows are deleted by
 * the admin path. Another brand's group is 404, never 403. Groups never touch invitations,
 * sets, contracts or notifications, and creators are never told.
 */

const db = require('../config/db');
const discovery = require('../services/discovery.service');
const { resolveAvatars } = require('../utils/avatarResolver');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const CAP = 100;
const PAGE = 20;
const MSG = Object.freeze({
  NAME_REQUIRED: 'Enter a group name.',
  NAME_TOO_LONG: 'Keep it under 40 characters.',
  NAME_TAKEN: 'You already have a group with this name.',
  FULL: (name) => `${name} is full (100 creators). Remove someone or use another group.`,
});

async function getBrandIdByUserId(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}
async function brandOrThrow(req) {
  const id = await getBrandIdByUserId(req.user.sub);
  if (!id) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return id;
}
async function ownGroupOrThrow(groupId, brandId) {
  const { rows } = await db.query(`SELECT id, name, created_at, updated_at FROM influencer_groups WHERE id = $1 AND brand_id = $2`, [groupId, brandId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Group not found', 404);
  return rows[0];
}

function validationError(field, code, message) {
  return new AppError('VALIDATION_ERROR', message, 422, field, { fields: [{ field, code, message }] });
}

/** §5A name rules. Returns the trimmed name or throws the exact message. */
async function validateName(raw, brandId, exceptGroupId) {
  const name = String(raw ?? '').trim();
  if (!name) throw validationError('name', 'NAME_REQUIRED', MSG.NAME_REQUIRED);
  if (name.length > 40) throw validationError('name', 'NAME_TOO_LONG', MSG.NAME_TOO_LONG);
  const { rows } = await db.query(
    `SELECT id FROM influencer_groups WHERE brand_id = $1 AND lower(trim(name)) = lower($2) AND ($3::uuid IS NULL OR id <> $3)`,
    [brandId, name, exceptGroupId || null]
  );
  if (rows[0]) throw validationError('name', 'NAME_TAKEN', MSG.NAME_TAKEN);
  return name;
}

/** De-dupe ids and keep only APPROVED creators (§5A: any approved creator, whatever her settings). */
async function approvedIds(rawIds) {
  if (!Array.isArray(rawIds)) throw new AppError('VALIDATION_ERROR', 'influencer_ids must be an array', 422, 'influencer_ids');
  const ids = [...new Set(rawIds.filter(Boolean).map(String))];
  if (!ids.length) return { ids: [], unknown: [], notApproved: [] };
  const { rows } = await db.query(
    `SELECT i.id, u.status FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = ANY($1::uuid[])`, [ids]);
  const byId = new Map(rows.map(r => [r.id, r.status]));
  const unknown = ids.filter(id => !byId.has(id));
  if (unknown.length) throw new AppError('VALIDATION_ERROR', `Unknown influencer id(s): ${unknown.join(', ')}`, 422, 'influencer_ids');
  const notApproved = ids.filter(id => byId.get(id) !== 'approved');
  if (notApproved.length) throw new AppError('NOT_APPROVED', 'Only approved creators can be added to a group.', 422, 'influencer_ids');
  return { ids, unknown, notApproved };
}

const VISIBLE_MEMBER = `JOIN users u ON u.id = i.user_id AND u.status = 'approved'`;

/** Live member count (approved only) and open-to count for a set of groups, one query. */
async function countsFor(brandId, groupIds) {
  if (!groupIds.length) return new Map();
  const subs = await discovery.brandSubCategories(brandId);
  const { rows } = await db.query(
    `WITH ${discovery.CREATOR_BASE_CTE}
     SELECT m.group_id, count(*)::int AS members, count(*) FILTER (WHERE sc.status = 'OK')::int AS open_count
       FROM influencer_group_members m
       JOIN scored sc ON sc.id = m.influencer_id
      WHERE m.group_id = ANY($3::uuid[])
      GROUP BY m.group_id`,
    [brandId, subs, groupIds]
  );
  return new Map(rows.map(r => [r.group_id, { members: r.members, openCount: r.open_count }]));
}

/** The original list shape (members[], influencer_ids[], member_count) plus the item-3 fields. */
async function loadGroupWithMembers(groupId, brandId) {
  const { rows: grp } = await db.query(
    `SELECT id, brand_id, name, created_at, updated_at FROM influencer_groups WHERE id = $1 AND brand_id = $2`, [groupId, brandId]);
  if (!grp[0]) return null;
  const { rows: members } = await db.query(
    `SELECT i.id, COALESCE(i.full_name, u.name) AS full_name, i.instagram_handle, m.added_at
       FROM influencer_group_members m JOIN influencers i ON i.id = m.influencer_id ${VISIBLE_MEMBER}
      WHERE m.group_id = $1 ORDER BY m.added_at ASC`, [groupId]);
  const counts = await countsFor(brandId, [groupId]);
  const c = counts.get(groupId) || { members: 0, openCount: 0 };
  return {
    ...grp[0], members, influencer_ids: members.map(r => r.id), member_count: members.length,
    memberCount: c.members, openCount: c.openCount, updatedAt: grp[0].updated_at, createdAt: grp[0].created_at,
    changed: new Date(grp[0].updated_at).getTime() - new Date(grp[0].created_at).getTime() > 1000,
    capacityLeft: Math.max(0, CAP - members.length),
  };
}

// ── GET /brands/me/influencer-groups ─────────────────────────────────────────
const listGroups = asyncHandler(async (req, res) => {
  const brandId = await brandOrThrow(req);
  const { rows: groups } = await db.query(
    `SELECT id, brand_id, name, created_at, updated_at FROM influencer_groups WHERE brand_id = $1 ORDER BY updated_at DESC, created_at DESC`, [brandId]);
  const { rows: members } = await db.query(
    `SELECT m.group_id, i.id, COALESCE(i.full_name, u.name) AS full_name, i.instagram_handle, m.added_at, i.profile_image_r2_key
       FROM influencer_group_members m
       JOIN influencer_groups g ON g.id = m.group_id
       JOIN influencers i ON i.id = m.influencer_id ${VISIBLE_MEMBER}
      WHERE g.brand_id = $1 ORDER BY m.added_at DESC`, [brandId]);
  const counts = await countsFor(brandId, groups.map(g => g.id));
  const byGroup = new Map();
  for (const m of members) {
    if (!byGroup.has(m.group_id)) byGroup.set(m.group_id, []);
    byGroup.get(m.group_id).push(m);
  }
  // Avatars for the first four members of each group, resolved in one pass.
  const avatarRows = [];
  for (const g of groups) for (const m of (byGroup.get(g.id) || []).slice(0, 4)) avatarRows.push(m);
  await resolveAvatars(avatarRows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });

  const out = groups.map(g => {
    const mem = byGroup.get(g.id) || [];
    const c = counts.get(g.id) || { members: 0, openCount: 0 };
    return {
      ...g,
      members: mem.map(m => ({ id: m.id, full_name: m.full_name, instagram_handle: m.instagram_handle, added_at: m.added_at })),
      influencer_ids: mem.map(m => m.id),
      member_count: mem.length,
      memberCount: c.members,
      openCount: c.openCount,
      updatedAt: g.updated_at,
      createdAt: g.created_at,
      changed: new Date(g.updated_at).getTime() - new Date(g.created_at).getTime() > 1000,
      avatars: mem.slice(0, 4).map(m => ({ id: m.id, name: m.full_name, avatarUrl: m.avatar_url || null })),
    };
  });
  return success(res, { groups: out });
});

// ── POST /brands/me/influencer-groups ────────────────────────────────────────
const createGroup = asyncHandler(async (req, res) => {
  const brandId = await brandOrThrow(req);
  const { name: rawName, influencer_ids } = req.body || {};
  const name = await validateName(rawName, brandId, null);
  const { ids } = influencer_ids !== undefined ? await approvedIds(influencer_ids) : { ids: [] };
  if (ids.length > CAP) throw new AppError('GROUP_FULL', MSG.FULL(name), 422, 'influencer_ids');
  const groupId = await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(`INSERT INTO influencer_groups (brand_id, name) VALUES ($1, $2) RETURNING id`, [brandId, name]);
    if (ids.length) {
      await tx.query(
        `INSERT INTO influencer_group_members (group_id, influencer_id, added_by)
         SELECT $1, unnest($2::uuid[]), $3 ON CONFLICT (group_id, influencer_id) DO NOTHING`, [rows[0].id, ids, req.user.sub]);
    }
    return rows[0].id;
  });
  return success(res, { group: await loadGroupWithMembers(groupId, brandId) }, 201);
});

// ── PATCH /brands/me/influencer-groups/:id ───────────────────────────────────
const renameGroup = asyncHandler(async (req, res) => {
  const brandId = await brandOrThrow(req);
  await ownGroupOrThrow(req.params.id, brandId);
  const name = await validateName((req.body || {}).name, brandId, req.params.id);
  await db.query(`UPDATE influencer_groups SET name = $1, updated_at = now() WHERE id = $2 AND brand_id = $3`, [name, req.params.id, brandId]);
  return success(res, { group: await loadGroupWithMembers(req.params.id, brandId) });
});

// ── DELETE /brands/me/influencer-groups/:id ──────────────────────────────────
const deleteGroup = asyncHandler(async (req, res) => {
  const brandId = await brandOrThrow(req);
  const { rows } = await db.query(`DELETE FROM influencer_groups WHERE id = $1 AND brand_id = $2 RETURNING id`, [req.params.id, brandId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Group not found', 404);
  return success(res, { deleted: true, id: rows[0].id });
});

// ── GET /brands/me/influencer-groups/:id — detail with paged members + live status ──
const getGroup = asyncHandler(async (req, res) => {
  const brandId = await brandOrThrow(req);
  const g = await ownGroupOrThrow(req.params.id, brandId);
  const counts = await countsFor(brandId, [g.id]);
  const c = counts.get(g.id) || { members: 0, openCount: 0 };
  const all = req.query.page === 'all';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const subs = await discovery.brandSubCategories(brandId);
  const params = [brandId, subs, g.id];
  let limitSql = '';
  if (!all) { params.push(PAGE, (page - 1) * PAGE); limitSql = `LIMIT $4 OFFSET $5`; }
  const { rows } = await db.query(
    `WITH ${discovery.CREATOR_BASE_CTE}
     SELECT sc.id, sc.name, sc.instagram_handle, sc.youtube_handle, sc.niche_code, sc.languages, sc.followers_count,
            sc.youtube_subscribers, sc.engagement_rate, sc.measured_at, sc.city_id, sc.city_name, sc.state_name,
            sc.profile_image_r2_key, sc.aims, sc.modes, sc.status, sc.blocked_by_us, rn.label AS niche_label, m.added_at
       FROM influencer_group_members m
       JOIN scored sc ON sc.id = m.influencer_id
       LEFT JOIN ref_creator_niches rn ON rn.code = sc.niche_code
      WHERE m.group_id = $3
      ORDER BY m.added_at DESC
      ${limitSql}`, params);
  await resolveAvatars(rows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });
  return success(res, {
    group: { id: g.id, name: g.name, memberCount: c.members, openCount: c.openCount, createdAt: g.created_at, updatedAt: g.updated_at,
             changed: new Date(g.updated_at).getTime() - new Date(g.created_at).getTime() > 1000, capacityLeft: Math.max(0, CAP - c.members) },
    members: { total: c.members, page: all ? 1 : page, rows: rows.map(r => ({ ...discovery.creatorRow(r), addedAt: r.added_at })) },
    memberIds: all ? rows.map(r => r.id) : undefined,
  });
});

// ── POST /brands/me/influencer-groups/:id/members — bulk, idempotent, capped ──
const addMembers = asyncHandler(async (req, res) => {
  const brandId = await brandOrThrow(req);
  const g = await ownGroupOrThrow(req.params.id, brandId);
  const { ids } = await approvedIds((req.body || {}).influencer_ids);
  if (!ids.length) throw new AppError('VALIDATION_ERROR', 'influencer_ids must contain at least one id', 422, 'influencer_ids');
  const result = await db.withTransaction(async (tx) => {
    await tx.query(`SELECT id FROM influencer_groups WHERE id = $1 FOR UPDATE`, [g.id]);
    const { rows: cur } = await tx.query(`SELECT influencer_id FROM influencer_group_members WHERE group_id = $1`, [g.id]);
    const have = new Set(cur.map(r => r.influencer_id));
    const fresh = ids.filter(id => !have.has(id));
    const room = CAP - have.size;
    if (fresh.length > room) {
      throw new AppError('GROUP_FULL', MSG.FULL(g.name), 422, 'influencer_ids', { capacityLeft: Math.max(0, room), requested: fresh.length });
    }
    if (fresh.length) {
      await tx.query(
        `INSERT INTO influencer_group_members (group_id, influencer_id, added_by)
         SELECT $1, unnest($2::uuid[]), $3 ON CONFLICT (group_id, influencer_id) DO NOTHING`, [g.id, fresh, req.user.sub]);
      await tx.query(`UPDATE influencer_groups SET updated_at = now() WHERE id = $1`, [g.id]);
    }
    return { added: fresh.length, skipped: ids.length - fresh.length, capacityLeft: Math.max(0, room - fresh.length) };
  });
  return success(res, { ...result, group: await loadGroupWithMembers(g.id, brandId) });
});

// ── DELETE /brands/me/influencer-groups/:id/members/:influencerId ────────────
const removeMember = asyncHandler(async (req, res) => {
  const brandId = await brandOrThrow(req);
  const g = await ownGroupOrThrow(req.params.id, brandId);
  const { rows } = await db.query(`DELETE FROM influencer_group_members WHERE group_id = $1 AND influencer_id = $2 RETURNING influencer_id`, [g.id, req.params.influencerId]);
  if (rows[0]) await db.query(`UPDATE influencer_groups SET updated_at = now() WHERE id = $1`, [g.id]);
  return success(res, { removed: !!rows[0], group: await loadGroupWithMembers(g.id, brandId) });
});

// ── GET /brands/me/influencer-groups/for-creator/:influencerId ───────────────
const groupsForCreator = asyncHandler(async (req, res) => {
  const brandId = await brandOrThrow(req);
  const { rows } = await db.query(
    `SELECT g.id, g.name,
            (SELECT count(*)::int FROM influencer_group_members m JOIN influencers i ON i.id = m.influencer_id ${VISIBLE_MEMBER} WHERE m.group_id = g.id) AS member_count,
            EXISTS (SELECT 1 FROM influencer_group_members m WHERE m.group_id = g.id AND m.influencer_id = $2) AS contains
       FROM influencer_groups g WHERE g.brand_id = $1 ORDER BY g.updated_at DESC`, [brandId, req.params.influencerId]);
  return success(res, { groups: rows.map(r => ({ id: r.id, name: r.name, memberCount: r.member_count, contains: r.contains, capacityLeft: Math.max(0, CAP - r.member_count) })) });
});

// ── PUT /brands/me/influencer-groups/for-creator/:influencerId { groupIds[] } ──
const setGroupsForCreator = asyncHandler(async (req, res) => {
  const brandId = await brandOrThrow(req);
  const influencerId = req.params.influencerId;
  const wanted = Array.isArray((req.body || {}).groupIds) ? [...new Set(req.body.groupIds.map(String))] : null;
  if (!wanted) throw new AppError('VALIDATION_ERROR', 'groupIds must be an array', 422, 'groupIds');
  await approvedIds([influencerId]);
  const { rows: own } = await db.query(`SELECT id, name FROM influencer_groups WHERE brand_id = $1`, [brandId]);
  const ownIds = new Set(own.map(g => g.id));
  const foreign = wanted.filter(id => !ownIds.has(id));
  if (foreign.length) throw new AppError('NOT_FOUND', 'Group not found', 404);
  const result = await db.withTransaction(async (tx) => {
    const { rows: cur } = await tx.query(
      `SELECT m.group_id FROM influencer_group_members m JOIN influencer_groups g ON g.id = m.group_id WHERE g.brand_id = $1 AND m.influencer_id = $2`, [brandId, influencerId]);
    const has = new Set(cur.map(r => r.group_id));
    const toAdd = wanted.filter(id => !has.has(id));
    const toRemove = [...has].filter(id => !wanted.includes(id));
    for (const gid of toAdd) {
      await tx.query(`SELECT id FROM influencer_groups WHERE id = $1 FOR UPDATE`, [gid]);
      const { rows: n } = await tx.query(`SELECT count(*)::int AS n FROM influencer_group_members WHERE group_id = $1`, [gid]);
      if (n[0].n >= CAP) {
        const name = own.find(g => g.id === gid)?.name || 'This group';
        throw new AppError('GROUP_FULL', MSG.FULL(name), 422, 'groupIds', { groupId: gid });
      }
      await tx.query(`INSERT INTO influencer_group_members (group_id, influencer_id, added_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [gid, influencerId, req.user.sub]);
      await tx.query(`UPDATE influencer_groups SET updated_at = now() WHERE id = $1`, [gid]);
    }
    if (toRemove.length) {
      await tx.query(`DELETE FROM influencer_group_members WHERE influencer_id = $1 AND group_id = ANY($2::uuid[])`, [influencerId, toRemove]);
      await tx.query(`UPDATE influencer_groups SET updated_at = now() WHERE id = ANY($1::uuid[])`, [toRemove]);
    }
    return { added: toAdd.map(id => ({ id, name: own.find(g => g.id === id)?.name })), removed: toRemove.map(id => ({ id, name: own.find(g => g.id === id)?.name })) };
  });
  return success(res, result);
});

/** Called by the admin paths: a REJECTED creator's member rows are deleted (founder Q11). */
async function dropFromAllGroups(influencerId) {
  await db.query(`DELETE FROM influencer_group_members WHERE influencer_id = $1`, [influencerId]);
}

module.exports = {
  CAP, MSG,
  listGroups, createGroup, renameGroup, deleteGroup, addMembers, removeMember,
  getGroup, groupsForCreator, setGroupsForCreator, dropFromAllGroups,
};
