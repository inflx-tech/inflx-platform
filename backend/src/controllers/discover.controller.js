'use strict';

/**
 * discover.controller — Stage B2 (the ONE Discover layout).
 * Contract: features/concept-stageb-discover/.
 *
 * Admin authors intent (GET/PUT layout per scope); the follower endpoint
 * serves the RESOLVED payload (live counts, auto-hide, rules); creators
 * read/write only their own arranger layout.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const discover = require('../services/discover.service');

const ROW_TYPES = new Set(['section', 'creator_row', 'business_row']);

function validateRows(rowsJson) {
  if (!Array.isArray(rowsJson)) throw new AppError('VALIDATION_ERROR', 'rows_json must be an array', 422, 'rows_json');
  for (const row of rowsJson) {
    if (!row || !ROW_TYPES.has(row.type)) {
      throw new AppError('VALIDATION_ERROR', `row.type must be one of: ${[...ROW_TYPES].join(', ')}`, 422, 'rows_json');
    }
    if (row.type === 'section' && !Array.isArray(row.chips)) {
      throw new AppError('VALIDATION_ERROR', 'section rows need chips[]', 422, 'rows_json');
    }
  }
}

// ── admin: GET/PUT /admin/discover-layout?scope=global|business ──────────────
const getAdminLayout = asyncHandler(async (req, res) => {
  const scope = req.query.scope === 'business' ? 'business' : 'global';
  const layout = await discover.getLayout(scope);
  return success(res, { layout });
});

const putAdminLayout = asyncHandler(async (req, res) => {
  const scope = req.body?.scope === 'business' ? 'business' : 'global';
  validateRows(req.body?.rows_json);
  const layout = await discover.putLayout(scope, req.body.rows_json);
  return success(res, { layout });
});

// ── creator: GET/PUT /influencers/me/discover-layout (My Store arranger) ─────
async function influencerIdFor(userSub) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userSub]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

const getCreatorLayout = asyncHandler(async (req, res) => {
  const creatorId = await influencerIdFor(req.user.sub);
  const layout = await discover.getLayout('creator', creatorId);
  return success(res, { layout });
});

const putCreatorLayout = asyncHandler(async (req, res) => {
  const creatorId = await influencerIdFor(req.user.sub);
  validateRows(req.body?.rows_json);
  const layout = await discover.putLayout('creator', req.body.rows_json, creatorId);
  return success(res, { layout });
});

// ── follower: GET /follower/discover ─────────────────────────────────────────
// scope=global (default) | business&brand_id=… | creator&creator_id=…
// city (query) + optional auth personalize the rules; guests get popularity.
const followerDiscover = asyncHandler(async (req, res) => {
  const { scope = 'global', brand_id = null, creator_id = null, city = null } = req.query;
  let followerId = null;
  if (req.user?.sub) {
    const { rows } = await db.query(`SELECT id FROM followers WHERE user_id = $1`, [req.user.sub]);
    followerId = rows[0]?.id || null;
  }
  const payload = await discover.resolveDiscover({
    scope: scope === 'business' ? 'business' : scope === 'creator' ? 'creator' : 'global',
    brandId: brand_id,
    creatorId: creator_id,
    city,
    followerId,
  });
  return success(res, payload);
});

module.exports = {
  getAdminLayout, putAdminLayout,
  getCreatorLayout, putCreatorLayout,
  followerDiscover,
};
