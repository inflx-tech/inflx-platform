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

module.exports = { feed, detail };
