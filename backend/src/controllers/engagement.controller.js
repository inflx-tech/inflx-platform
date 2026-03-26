'use strict';

const engagementService = require('../services/engagement.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const db = require('../config/db');

// GET /brands/me/campaigns/:id/engagement
const getCampaignEngagement = asyncHandler(async (req, res) => {
  const campaignId = req.params.id;

  // Fetch brand by user_id (same pattern as campaign.controller.js)
  const { rows: brandRows } = await db.query(
    `SELECT id FROM brands WHERE user_id = $1`,
    [req.user.sub]
  );
  if (!brandRows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const brandId = brandRows[0].id;

  // Verify campaign belongs to this brand
  const { rows } = await db.query(
    `SELECT id FROM campaigns WHERE id = $1 AND brand_id = $2`,
    [campaignId, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);

  const data = await engagementService.getCampaignEngagement(campaignId);
  if (!data) throw new AppError('NOT_FOUND', 'Campaign not found', 404);

  return success(res, data);
});

module.exports = { getCampaignEngagement };
