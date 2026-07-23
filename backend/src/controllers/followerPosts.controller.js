'use strict';

/**
 * followerPosts.controller.js — follower-facing posts (Post/Concept P3).
 * Contract: features/concept-p3-follower-backend/. Both endpoints are
 * authenticateOptional — anonymous browsing works; a JWT adds followed-first
 * ordering and (later) personalization.
 */

const followerPosts = require('../services/followerPosts.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /v1/follower/posts?concept_id=&collection_id=&creator=&limit=&offset=
const feed = asyncHandler(async (req, res) => {
  const posts = await followerPosts.listFeed({
    userId: req.user ? req.user.sub : null,
    conceptId: req.query.concept_id || null,
    collectionId: req.query.collection_id || null,
    handle: req.query.creator || null,
    limit: req.query.limit,
    offset: req.query.offset,
  });
  return success(res, { posts });
});

// GET /v1/follower/posts/:id
const detail = asyncHandler(async (req, res) => {
  const post = await followerPosts.getPostDetail(req.params.id, {
    userId: req.user ? req.user.sub : null,
  });
  if (!post) throw new AppError('NOT_FOUND', 'Post not found', 404);
  return success(res, { post });
});

// GET /v1/follower/app-config — PUBLIC, fetched at app launch. One object,
// admin-editable, so global behaviour knobs (video autoplay/sound, future
// feed tuning) change without an OTA.
const appConfig = asyncHandler(async (req, res) => {
  const config = await followerPosts.getAppConfig();
  return success(res, { config });
});

// PATCH /v1/admin/app-config — settings capability; shallow-merges keys.
const updateAppConfig = asyncHandler(async (req, res) => {
  let config;
  try { config = await followerPosts.updateAppConfig(req.body && req.body.config); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  return success(res, { config });
});

// POST|DELETE /v1/follower/posts/:id/like and /save — minimal engagement
// (P3 globals; comments/share arrive with the intelligence phase).
function engagementHandler(kind, on) {
  return asyncHandler(async (req, res) => {
    const followerId = await followerPosts.followerIdForUser(req.user.sub);
    if (!followerId) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);
    const result = await followerPosts.setEngagement(kind, req.params.id, followerId, on);
    if (!result) throw new AppError('NOT_FOUND', 'Post not found', 404);
    return success(res, { [kind === 'like' ? 'like_count' : 'save_count']: result.count });
  });
}

module.exports = {
  feed, detail, appConfig, updateAppConfig,
  like: engagementHandler('like', true),
  unlike: engagementHandler('like', false),
  save: engagementHandler('save', true),
  unsave: engagementHandler('save', false),
};
