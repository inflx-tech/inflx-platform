'use strict';

const engagementService = require('../services/engagement.service');
const postStats = require('../services/postStats.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const db = require('../config/db');

async function ownCampaign(req) {
  const { rows: brandRows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [req.user.sub]);
  if (!brandRows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const { rows } = await db.query(`SELECT id FROM campaigns WHERE id = $1 AND brand_id = $2`, [req.params.id, brandRows[0].id]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  return rows[0].id;
}

// GET /brands/me/campaigns/:id/engagement — post-performance-v2 shape (E11)
const getCampaignEngagement = asyncHandler(async (req, res) => {
  const campaignId = await ownCampaign(req);
  const data = await engagementService.getCampaignEngagement(campaignId);
  if (!data) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  return success(res, data);
});

// POST /brands/me/campaigns/:id/engagement/refresh — the website's one "Update now" (P7): every
// link of the campaign read once; once a day; budget-gated. The per-deliverable refresh-stats door
// is gone with deliverable_stats (P11).
const refreshCampaignEngagement = asyncHandler(async (req, res) => {
  const campaignId = await ownCampaign(req);
  const refreshed = await postStats.refreshCampaign(campaignId);
  return success(res, { refreshed, ...(await engagementService.getCampaignEngagement(campaignId)) });
});

module.exports = { getCampaignEngagement, refreshCampaignEngagement };
