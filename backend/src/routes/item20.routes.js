'use strict';

/**
 * Item 20 — a creator who owns a brand. Mounted at '/'.
 * Contract: features/item20-own-brand · master rules v1.33 §2D · board L1–L6, B1–B3, S1–S3.
 *
 * Linking is identity, like Change number: none of the link routes asks for an approved account
 * (the question is put at sign-up, when nobody is approved yet). Posting for the brand is on the
 * shoppable-post routes, which do. Recording where a post was shared changes his own record, so it
 * asks for an approved account like every other post action.
 */

const { Router } = require('express');
const { authenticate, requireApproved, requireRole } = require('../middleware/auth');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const db = require('../config/db');
const ownBrand = require('../services/ownBrand.service');
const places = require('../services/postPlaces.service');

const router = Router();
const brand = [authenticate, requireRole('brand')];
const creator = [authenticate, requireRole('influencer')];
const acting = [...creator, requireApproved];
const h = (fn) => asyncHandler(async (req, res) => success(res, await fn(req)));

async function herId(req) {
  const { rows: [i] } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [req.user.sub]);
  if (!i) throw new AppError('NOT_FOUND', 'Creator profile not found', 404);
  return i.id;
}

// ── Creator: the link (L1–L6) ────────────────────────────────────────────────
router.get('/influencers/me/brand-link', ...creator, h((req) => ownBrand.status(req.user.sub)));
router.post('/influencers/me/brand-link/same-number', ...creator, h((req) => ownBrand.linkSameNumber(req.user.sub)));
router.post('/influencers/me/brand-link/code', ...creator, h((req) => ownBrand.sendCode(req.user.sub, (req.body || {}).phone)));
router.post('/influencers/me/brand-link/code/confirm', ...creator, h((req) => ownBrand.confirmCode(req.user.sub, (req.body || {}).otp)));
router.delete('/influencers/me/brand-link', ...creator, h((req) => ownBrand.removeMine(req.user.sub)));

// ── Creator: where he shared an own-brand post (S1, S2) ──────────────────────
router.get('/influencers/me/shoppable-posts/:postId/places', ...creator, h(async (req) => places.list(await herId(req), req.params.postId)));
router.post('/influencers/me/shoppable-posts/:postId/places', ...acting, h(async (req) => places.add(await herId(req), req.params.postId, req.body)));
router.patch('/influencers/me/shoppable-posts/:postId/places/:placeId', ...acting, h(async (req) => places.update(await herId(req), req.params.postId, req.params.placeId, req.body)));
router.delete('/influencers/me/shoppable-posts/:postId/places/:placeId', ...acting, h(async (req) => places.remove(await herId(req), req.params.postId, req.params.placeId)));

// ── Brand: who is linked to it (B2, B3) ──────────────────────────────────────
router.get('/brands/me/linked-creators', ...brand, h((req) => ownBrand.linkedCreators(req.user.sub)));
router.delete('/brands/me/linked-creators/:influencerId', ...brand, h((req) => ownBrand.removeByBrand(req.user.sub, req.params.influencerId)));

module.exports = router;
