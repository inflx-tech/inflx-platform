'use strict';

/**
 * Item 19 — Home and Needs You. Mounted at '/'.
 * Contract: features/item19-home · master rules v1.32 §24 · board BH1–BH6 (brand), CH1–CH5 (creator)
 *
 * Six reads; nothing here writes. No `requireApproved`: an account still under review has nothing
 * to list (its Home is the Under review screen, which never calls these), and a 403 here would
 * raise the app's "not approved yet" sheet from a background count.
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const db = require('../config/db');
const home = require('../services/home.service');

const router = Router();
const brand = [authenticate, requireRole('brand')];
const creator = [authenticate, requireRole('influencer')];

async function theBrand(req) {
  const { rows: [b] } = await db.query(`SELECT id, business_name FROM brands WHERE user_id = $1`, [req.user.sub]);
  if (!b) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return b;
}
async function her(req) {
  const { rows: [i] } = await db.query(
    `SELECT i.id, COALESCE(i.full_name, u.name) AS name, i.instagram_handle
       FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.user_id = $1`, [req.user.sub]);
  if (!i) throw new AppError('NOT_FOUND', 'Creator profile not found', 404);
  return i;
}
const listOf = (req) => (req.params.list === 'waiting' ? 'waiting' : 'needs');

// ── Brand ────────────────────────────────────────────────────────────────────
// BH1 / BH4 / BH5 — the four sections.
router.get('/brands/me/home', ...brand, asyncHandler(async (req, res) => success(res, await home.brandHome(await theBrand(req), req.user.sub))));
// The number on the Home tab, and the bell's.
router.get('/brands/me/home/count', ...brand, asyncHandler(async (req, res) => success(res, await home.brandCount(await theBrand(req), req.user.sub))));
// BH2 — Needs you, all · BH3 — Waiting on others, all.
router.get('/brands/me/home/:list(needs|waiting)', ...brand, asyncHandler(async (req, res) => success(res, await home.brandList(await theBrand(req), listOf(req)))));

// ── Creator ──────────────────────────────────────────────────────────────────
// CH1 / CH4 / CH5.
router.get('/influencers/me/home', ...creator, asyncHandler(async (req, res) => success(res, await home.creatorHome(await her(req), req.user.sub))));
router.get('/influencers/me/home/count', ...creator, asyncHandler(async (req, res) => success(res, await home.creatorCount(await her(req), req.user.sub))));
// CH2 · CH3.
router.get('/influencers/me/home/:list(needs|waiting)', ...creator, asyncHandler(async (req, res) => success(res, await home.creatorList(await her(req), listOf(req)))));

module.exports = router;
