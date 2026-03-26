'use strict';

/**
 * commission.controller.js
 * Phase 4 — Block G
 *
 * GET /influencers/me/commissions
 * GET /brands/me/campaigns/:id/conversions
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const commissionService = require('../services/commission.service');

// ── GET /influencers/me/commissions ───────────────────────────────────────────

const getCommissions = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id FROM influencers WHERE user_id = $1`,
    [req.user.sub]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const influencerId = rows[0].id;

  const { status = 'all' } = req.query;
  const data = await commissionService.getInfluencerCommissions(influencerId, status);

  return success(res, data);
});

// ── GET /brands/me/campaigns/:id/conversions ──────────────────────────────────

const getConversions = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id FROM brands WHERE user_id = $1`,
    [req.user.sub]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const brandId = rows[0].id;

  const data = await commissionService.getBrandConversions(req.params.campaign_id, brandId);
  return success(res, data);
});

module.exports = { getCommissions, getConversions };
