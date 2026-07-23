'use strict';

/**
 * creatorPosts.controller.js — creator-side posts API (Post/Concept P2).
 * Contract: features/concept-p2-posts/. All /me endpoints requireRole('influencer').
 * servePostMedia is PUBLIC (follower app + admin queue load slides through it).
 */

const db = require('../config/db');
const creatorPosts = require('../services/creatorPosts.service');
const concepts = require('../services/concepts.service');
const storage = require('../services/storage.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function getInfluencerId(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

// GET /v1/influencers/me/post-scope — step 1 (+ the pickers' vocabulary)
const getPostScope = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  const [brands, templates, collections] = await Promise.all([
    creatorPosts.collaborationBrands(influencerId),
    concepts.listTemplates({ includeHidden: false }),
    concepts.listCollections({ includeHidden: false }),
  ]);
  return success(res, { brands, templates, collections });
});

// POST /v1/influencers/me/posts/picker — step 2: the live product universe
const picker = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  const b = req.body || {};
  let result;
  try {
    result = await creatorPosts.pickerProducts({
      influencerId,
      scope: b.scope,
      brandIds: b.brand_ids,
      templateId: b.template_id || null,
      categoryNodeId: b.category_node_id || null,
      collectionId: b.collection_id || null,
    });
  } catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  return success(res, result);
});

// POST /v1/influencers/me/posts/upload-url — step 3 presign (images only)
const uploadUrl = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  let result;
  try { result = await creatorPosts.buildUploadUrl(influencerId, req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  return success(res, result);
});

// POST /v1/influencers/me/posts — step 4: create (status=submitted)
const create = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  let post;
  try { post = await creatorPosts.createPost(influencerId, req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  return success(res, { post }, 201);
});

// GET /v1/influencers/me/posts?status=
const listMine = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  const posts = await creatorPosts.listMyPosts(influencerId, {
    status: req.query.status || null,
    limit: req.query.limit,
    offset: req.query.offset,
  });
  return success(res, { posts });
});

// GET /v1/media/post/:id — PUBLIC redirect to a fresh presigned GET (same
// stable-URL pattern as /v1/media/assets/:id).
const servePostMedia = asyncHandler(async (req, res) => {
  const key = await creatorPosts.mediaR2Key(req.params.id);
  if (!key) throw new AppError('NOT_FOUND', 'media not found', 404);
  const url = await storage.generateDownloadUrl(key);
  if (!url) throw new AppError('NOT_FOUND', 'media unavailable', 404);
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return res.redirect(302, url);
});

module.exports = { getPostScope, picker, uploadUrl, create, listMine, servePostMedia };
