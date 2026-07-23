'use strict';

/**
 * adminPosts.controller.js — Post Moderation Queue (Post/Concept P2).
 * Contract: features/concept-p2-posts/. Admin-only approval — the founder's
 * lock: brand is NOT in the post approval path.
 */

const creatorPosts = require('../services/creatorPosts.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /v1/admin/posts?status=submitted&limit=&offset=
const list = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await creatorPosts.listQueue({
      status: req.query.status || 'submitted',
      limit: req.query.limit,
      offset: req.query.offset,
    });
  } catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  return success(res, result);
});

// POST /v1/admin/posts/:id/approve
const approve = asyncHandler(async (req, res) => {
  const post = await creatorPosts.decidePost(req.params.id, req.user.sub, true, null);
  if (!post) throw new AppError('NOT_FOUND', 'post not found or not awaiting review', 404);
  return success(res, { post });
});

// POST /v1/admin/posts/:id/reject  { reason }
const reject = asyncHandler(async (req, res) => {
  const post = await creatorPosts.decidePost(
    req.params.id, req.user.sub, false, req.body && req.body.reason);
  if (!post) throw new AppError('NOT_FOUND', 'post not found or not awaiting review', 404);
  return success(res, { post });
});

module.exports = { list, approve, reject };
