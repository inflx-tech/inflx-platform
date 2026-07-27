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

const ROW_TYPES = new Set(['section', 'category_row', 'creator_row', 'business_row']);

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

// ── GET /influencers/me/discover-options (B4 — the arranger's raw material) ──
// Every concept/collection THIS creator's approved+visible posts qualify for,
// with live counts + their posts (id, cover, label) for the cover picker.
// The arranger can only arrange what's here — no rules, no free choice.
const getCreatorOptions = asyncHandler(async (req, res) => {
  const creatorId = await influencerIdFor(req.user.sub);
  const { conceptName, familyOf } = require('../services/concepts.service');
  const { mediaUrl } = require('../services/creatorPosts.service');

  const VISIBLE = `cp.status = 'approved'
    AND (cp.eligible_product_count IS NULL OR cp.eligible_product_count > 0)`;

  const { rows } = await db.query(
    `SELECT cp.id AS post_id, cp.caption, cp.created_at,
            cp.concept_id, cp.collection_id,
            ct.kind, ct.name_pattern, cn.name AS leaf_name,
            col.name AS collection_name,
            pm.id AS media_id
       FROM creator_posts cp
       LEFT JOIN concepts co ON co.id = cp.concept_id
       LEFT JOIN concept_templates ct ON ct.id = co.template_id
       LEFT JOIN category_nodes cn ON cn.id = co.category_node_id
       LEFT JOIN collections col ON col.id = cp.collection_id
       LEFT JOIN post_media pm ON pm.post_id = cp.id AND pm.slide_index = 0
      WHERE cp.influencer_id = $1 AND ${VISIBLE}
      ORDER BY cp.created_at DESC`,
    [creatorId]);

  const byKey = new Map();
  for (const r of rows) {
    const key = r.concept_id ? `c:${r.concept_id}` : `l:${r.collection_id}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        concept_id: r.concept_id || null,
        collection_id: r.collection_id || null,
        name: r.concept_id
          ? conceptName({ kind: r.kind, name_pattern: r.name_pattern }, r.leaf_name)
          : r.collection_name,
        family: r.concept_id ? familyOf(r.kind, !!r.leaf_name) : 6,
        visible: 0,
        posts: [],
      });
    }
    const opt = byKey.get(key);
    opt.visible += 1;
    opt.posts.push({
      id: r.post_id,
      label: (r.caption || '').slice(0, 40) || 'Post',
      cover_url: r.media_id ? mediaUrl(r.media_id) : null,
      created_at: r.created_at,
    });
  }

  return success(res, { options: [...byKey.values()].sort((a, b) => b.visible - a.visible) });
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
  const { scope = 'global', brand_id = null, city = null } = req.query;
  let creator_id = req.query.creator_id || null;
  // B4 — the follower app knows creators by HANDLE (store pages); resolve it.
  if (!creator_id && req.query.creator_handle) {
    const { rows } = await db.query(
      `SELECT id FROM influencers WHERE lower(instagram_handle) = lower($1)`,
      [String(req.query.creator_handle).replace(/^@/, '')]);
    creator_id = rows[0]?.id || null;
    if (!creator_id) return success(res, { scope: 'creator', rows: [], updated_at: null });
  }
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
  getCreatorLayout, putCreatorLayout, getCreatorOptions,
  followerDiscover,
};
