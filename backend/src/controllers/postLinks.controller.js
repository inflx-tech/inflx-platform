'use strict';

/**
 * postLinks.controller.js — post codes and links (Level 4).
 * Contract: features/post-links-codes · rules v1.5 §4.14 · boards L1–L8
 *
 * Public lookups (no sign-in) are what inflx.in/p, /s and /c ask when someone taps a link; the
 * website passes on the visitor's user agent and referrer, and the shopper app its device id.
 */

const db = require('../config/db');
const links = require('../services/postLinks.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function visitorOf(req) {
  return {
    ua: String(req.headers['x-visitor-ua'] || req.headers['user-agent'] || '').slice(0, 400),
    referer: String(req.headers['x-visitor-referer'] || req.headers.referer || '').slice(0, 400) || null,
    deviceId: req.headers['x-device-id'] || null,
  };
}

async function influencerOf(req) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [req.user.sub]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

module.exports = {
  // public
  post: asyncHandler(async (req, res) => success(res, await links.resolvePost(req.params.code, { channel: links.channelOf(req.query.ch), visitor: visitorOf(req) }))),
  store: asyncHandler(async (req, res) => success(res, await links.resolveStore(req.params.handle, { channel: links.channelOf(req.query.ch), visitor: visitorOf(req) }))),
  collection: asyncHandler(async (req, res) => success(res, await links.resolveCollection(req.params.code, { visitor: visitorOf(req) }))),
  code: asyncHandler(async (req, res) => success(res, await links.lookupCode(req.params.code, { visitor: visitorOf(req) }))),
  // creator
  share: asyncHandler(async (req, res) => success(res, await links.shareFor(await influencerOf(req), req.params.postId))),
  stats: asyncHandler(async (req, res) => success(res, await links.myStats(await influencerOf(req), req.params.postId))),
  myLinks: asyncHandler(async (req, res) => success(res, await links.myLinks(await influencerOf(req)))),
  // brand
  setPosts: asyncHandler(async (req, res) => success(res, await links.setPosts(req.user.sub, req.params.id, req.params.sid, { ciId: req.query.ci || null }))),
  setPostStats: asyncHandler(async (req, res) => success(res, await links.brandPostStats(req.user.sub, req.params.id, req.params.sid, req.params.postId))),
};
