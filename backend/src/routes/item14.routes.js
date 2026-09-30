'use strict';

/**
 * Item 14 — Pay for Sale going live. Mounted at '/' beside item 12.
 * Contract: features/item14-sale-going-live · board v2 (locked 30 Sep 2026)
 *
 * Path 2 IS item 12's content step: the read, captions, files, sending, the verdicts, links,
 * "posted", confirm live and reports all go through item12.routes.js unchanged — contentGate
 * lets a new-terms Pay for Sale collaboration in. What Pay for Sale adds is only what item 12 does
 * not have: she NAMES her rows (an approved post + a place), may take one out, and may add a
 * link for a post outside the package. Anything not hers is a 404, never a 403.
 */

const { Router } = require('express');
const { authenticate, requireApproved, requireRole } = require('../middleware/auth');
const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const saleLive = require('../services/saleLive.service');
const flow = require('../services/contentFlow.service');

const router = Router();
const creator = [authenticate, requireRole('influencer'), requireApproved];
const scope = (req) => ({ side: 'creator', userId: req.user.sub });
const C = '/influencers/me/invitations/:ciId/content';
const send = async (req, res) => success(res, { content: await flow.read(req.params.ciId, scope(req)) });

// S7/S8 — name one approved post and the places it will be shared.
router.post(`${C}/social-rows`, ...creator, asyncHandler(async (req, res) => {
  const b = req.body || {};
  await saleLive.addRows(req.params.ciId, scope(req), { postId: b.postId, types: b.types });
  return send(req, res);
}));

// S8/S12 — take one out while the package is hers.
router.delete(`${C}/social-rows/:rowKey`, ...creator, asyncHandler(async (req, res) => {
  await saleLive.removeRow(req.params.ciId, scope(req), req.params.rowKey);
  return send(req, res);
}));

// S17 — a post outside the package: a link only. Returns the new row's key for the proof call.
router.post(`${C}/outside-rows`, ...creator, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const rowKey = await saleLive.addOutside(req.params.ciId, scope(req), { postId: b.postId, type: b.type });
  const content = await flow.read(req.params.ciId, scope(req));
  return success(res, { rowKey, content });
}));

module.exports = router;
