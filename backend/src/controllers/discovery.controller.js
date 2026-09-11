'use strict';

/**
 * discovery.controller.js — Item 3 HTTP layer for everything that is not the profile
 * editors or groups: Discover creators, Worked with, Find brands, place resolution,
 * branches, brand products, reference cities.
 * Contract: features/item3-discovery-profiles-groups · prompt §5 (A2, A3, A5, A7, A9, A11, A13)
 *
 * Privacy (prompt §5): every response here is shaped by the discovery/branches/products
 * services, which select only what the other side may see. No creator private setting,
 * email or phone; no brand threshold, address, phone, GSTIN, contact person or offer.
 */

const db = require('../config/db');
const discovery = require('../services/discovery.service');
const branches = require('../services/brandBranches.service');
const products = require('../services/brandProducts.service');
const ref = require('../services/referenceLists.service');
const { resolveAvatars } = require('../utils/avatarResolver');
const { SIGNED_CONTRACT_SQL } = require('../services/collabState');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function brandIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0].id;
}
async function influencerIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

/** Turn a service error (code/field/details) into the standard envelope. */
function rethrow(e) {
  if (e && e.code === 'VALIDATION_ERROR') throw new AppError('VALIDATION_ERROR', e.message, 422, e.field || null, e.details || null);
  if (e && e.code === 'MAIN_BRANCH') throw new AppError('MAIN_BRANCH', e.message, 422, 'id');
  if (e && e.code === ref.STATE_UNKNOWN) throw new AppError(ref.STATE_UNKNOWN, e.message, 422, 'place_id');
  if (e && e.code === ref.PLACE_NOT_FOUND) throw new AppError('PLACE_NOT_FOUND', 'place not found', 404, 'place_id');
  if (e && e.code === 'RATE_LIMITED') throw new AppError('RATE_LIMITED', e.message, 429);
  throw e;
}

// ── A5 Discover creators (brand) ─────────────────────────────────────────────
const discoverCreators = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const out = await discovery.discoverCreators(brandId, { ...req.query, withGroups: req.query.withGroups === '1' || req.query.withGroups === 'true' });
  return success(res, out);
});

// ── A7 Worked with (brand) ───────────────────────────────────────────────────
const workedWith = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const params = [brandId];
  let searchSql = '';
  if (req.query.search && String(req.query.search).trim()) {
    params.push(`%${String(req.query.search).trim().replace(/^@+/, '').toLowerCase()}%`);
    searchSql = `AND (lower(COALESCE(i.full_name, u.name)) LIKE $2 OR lower(i.instagram_handle) LIKE $2)`;
  }
  const base = `
    FROM contracts con
    JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN influencers i ON i.id = ci.influencer_id
    JOIN users u ON u.id = i.user_id
   WHERE c.brand_id = $1 AND ${SIGNED_CONTRACT_SQL} AND u.status = 'approved' ${searchSql}`;
  const { rows: cnt } = await db.query(`SELECT count(DISTINCT i.id)::int AS n ${base}`, params);
  params.push(discovery.PAGE, (page - 1) * discovery.PAGE);
  const { rows } = await db.query(
    `SELECT i.id, COALESCE(i.full_name, u.name) AS name, i.instagram_handle, i.profile_image_r2_key,
            count(*)::int AS collaborations,
            max(GREATEST(con.influencer_signed_at, con.brand_signed_at)) AS last_signed_at
       ${base}
      GROUP BY i.id, u.name
      ORDER BY last_signed_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  await resolveAvatars(rows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });
  return success(res, {
    total: cnt[0].n, page,
    rows: rows.map(r => ({ influencerId: r.id, name: r.name, instagramHandle: r.instagram_handle, avatarUrl: r.avatar_url || null, collaborations: r.collaborations, lastSignedAt: r.last_signed_at })),
  });
});

// ── A9 Find brands (creator) ─────────────────────────────────────────────────
const findBrands = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  return success(res, await discovery.findBrands(influencerId, req.query));
});

// ── A3 Places resolve (any signed-in role) ──────────────────────────────────
const resolvePlace = asyncHandler(async (req, res) => {
  const { place_id, session } = req.body || {};
  try {
    const r = await ref.resolvePlace(place_id, { session, userId: req.user.sub });
    return success(res, r);
  } catch (e) { rethrow(e); }
});

// ── A2 Branches (brand) ──────────────────────────────────────────────────────
const listBranches = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  return success(res, { branches: await branches.list(brandId) });
});
const createBranch = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  try { return success(res, await branches.create(brandId, req.body || {}, { userId: req.user.sub }), 201); }
  catch (e) { rethrow(e); }
});
const updateBranch = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  try {
    const out = await branches.update(brandId, req.params.id, req.body || {}, { userId: req.user.sub });
    if (!out) throw new AppError('NOT_FOUND', 'Branch not found', 404);
    return success(res, out);
  } catch (e) { rethrow(e); }
});
const makeMainBranch = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const b = await branches.makeMain(brandId, req.params.id);
  if (!b) throw new AppError('NOT_FOUND', 'Branch not found', 404);
  return success(res, { branch: b });
});
const removeBranch = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  try {
    const b = await branches.remove(brandId, req.params.id);
    if (!b) throw new AppError('NOT_FOUND', 'Branch not found', 404);
    return success(res, { removed: true, id: b.id });
  } catch (e) { rethrow(e); }
});

// ── A11 Brand products (creator or brand viewer) ─────────────────────────────
const listBrandProducts = asyncHandler(async (req, res) => {
  return success(res, await products.list(req.params.id, { page: req.query.page, limit: req.query.limit }));
});
const brandProductDetail = asyncHandler(async (req, res) => {
  const p = await products.detail(req.params.id, req.params.productId);
  if (!p) throw new AppError('NOT_FOUND', 'Product not found', 404);
  return success(res, { product: p });
});

// ── A13 Reference cities by id ──────────────────────────────────────────────
const citiesByIds = asyncHandler(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(s => Number(s.trim())).filter(Number.isFinite);
  return success(res, { items: await ref.citiesByIds(ids) });
});

module.exports = {
  discoverCreators, workedWith, findBrands, resolvePlace,
  listBranches, createBranch, updateBranch, makeMainBranch, removeBranch,
  listBrandProducts, brandProductDetail, citiesByIds,
};
