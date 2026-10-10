'use strict';

/**
 * shoppablePosts.controller.js — the creator app's Create tab (Level 3).
 * Contract: features/shoppable-posts-v2 · boards P1–P20. Every route is the signed-in creator's own.
 */

const db = require('../config/db');
const posts = require('../services/shoppablePosts.service');
const collections = require('../services/creatorCollections.service');
const { MSG } = require('../services/postsCopy');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function me(req) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [req.user.sub]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

const h = (fn) => asyncHandler(async (req, res) => success(res, await fn(await me(req), req)));

module.exports = {
  // P1
  home:           h((id) => posts.createHome(id)),
  // P2, P3
  brands:         h(async (id) => ({ brands: await posts.brands(id) })),
  collaborations: h(async (id, req) => ({ collaborations: await posts.collaborations(id, req.query.brand_id) })),
  // drafts and steps
  // item 20: `own_brand_id` (and no collaboration) starts a post for the brand he is linked to
  create:         h(async (id, req) => ({ post: await posts.createDraft(id, (req.body || {}).campaign_influencer_id, (req.body || {}).own_brand_id) })),
  list:           h((id, req) => posts.listMine(id, { state: req.query.state || null })),
  get:            h(async (id, req) => ({ post: await posts.getPost(id, req.params.postId) })),
  options:        h((id, req) => posts.options(id, req.params.postId)),
  update:         h(async (id, req) => ({ post: await posts.update(id, req.params.postId, req.body) })),
  uploadUrl:      h((id, req) => posts.uploadUrl(id, req.params.postId, req.body || {})),
  submit:         h(async (id, req) => ({ post: await posts.submit(id, req.params.postId, req.user.sub) })),
  takeDown:       h(async (id, req) => ({ post: await posts.takeDown(id, req.params.postId, req.user.sub) })),
  remove:         h((id, req) => posts.remove(id, req.params.postId)),
  // collections (P16–P20)
  collectionOptions: h((id, req) => collections.options(id, req.query.kind)),
  collectionList:    h((id) => collections.list(id)),
  collectionCreate:  h(async (id, req) => ({ collection: await collections.create(id, req.body || {}) })),
  collectionGet:     h(async (id, req) => ({ collection: await collections.get(id, req.params.collectionId) })),
  collectionUpdate:  h(async (id, req) => ({ collection: await collections.update(id, req.params.collectionId, req.body || {}) })),
  collectionRemove:  h((id, req) => collections.remove(id, req.params.collectionId)),
  // the July composer (rules 4.8: multi-brand and "everything" posts are gone)
  retired: asyncHandler(async () => { throw new AppError('RETIRED', MSG.RETIRED, 410); }),
};
