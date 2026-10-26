'use strict';

/**
 * postEngagement.controller.js — a post's comments for the creator (read, reply, hide, unhide) and for
 * the brand (read only). The numbers ride on the existing stats / status / set-posts payloads.
 * Contract: features/post-engagement-stats · rules §4.15
 */

const db = require('../config/db');
const eng = require('../services/shopperEngagement.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function influencerOf(req) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [req.user.sub]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

module.exports = {
  myComments: asyncHandler(async (req, res) => success(res, await eng.creatorComments(await influencerOf(req), req.params.postId, { before: req.query.before }))),
  reply: asyncHandler(async (req, res) => success(res, await eng.replyAsCreator(await influencerOf(req), req.params.postId, req.body || {}), 201)),
  hide: asyncHandler(async (req, res) => success(res, await eng.setHidden(await influencerOf(req), req.params.id, true))),
  unhide: asyncHandler(async (req, res) => success(res, await eng.setHidden(await influencerOf(req), req.params.id, false))),
  brandComments: asyncHandler(async (req, res) => success(res, await eng.brandComments(req.user.sub, req.params.id, req.params.sid, req.params.postId, { before: req.query.before }))),
};
