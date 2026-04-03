'use strict';

const engagementService = require('../services/engagement.service');
const apifyService = require('../services/apify.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const db = require('../config/db');

// GET /brands/me/campaigns/:id/engagement
const getCampaignEngagement = asyncHandler(async (req, res) => {
  const campaignId = req.params.id;

  const { rows: brandRows } = await db.query(
    `SELECT id FROM brands WHERE user_id = $1`,
    [req.user.sub]
  );
  if (!brandRows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const brandId = brandRows[0].id;

  const { rows } = await db.query(
    `SELECT id FROM campaigns WHERE id = $1 AND brand_id = $2`,
    [campaignId, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);

  const data = await engagementService.getCampaignEngagement(campaignId);
  if (!data) throw new AppError('NOT_FOUND', 'Campaign not found', 404);

  return success(res, data);
});

// POST /deliverables/:id/refresh-stats — on-demand Apify scrape (brand or influencer)
const refreshDeliverableStats = asyncHandler(async (req, res) => {
  const deliverableId = req.params.id;

  // Fetch deliverable with ownership check
  const { rows } = await db.query(
    `SELECT d.id, d.live_url, d.status, d.campaign_influencer_id,
            ci.influencer_id, i.followers_count,
            u_inf.id AS influencer_user_id,
            u_br.id AS brand_user_id
     FROM deliverables d
     JOIN campaign_influencers ci ON ci.id = d.campaign_influencer_id
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u_inf ON u_inf.id = i.user_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
     JOIN users u_br ON u_br.id = b.user_id
     WHERE d.id = $1`,
    [deliverableId]
  );

  if (!rows[0]) throw new AppError('NOT_FOUND', 'Deliverable not found', 404);
  const d = rows[0];

  // Verify ownership
  if (req.user.role === 'brand' && d.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this deliverable', 403);
  }
  if (req.user.role === 'influencer' && d.influencer_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'This deliverable does not belong to you', 403);
  }

  if (d.status !== 'live') {
    throw new AppError('VALIDATION_ERROR', 'Can only refresh stats for live deliverables', 422);
  }
  if (!d.live_url) {
    throw new AppError('VALIDATION_ERROR', 'Deliverable has no live URL', 422);
  }

  // Call Apify
  const stats = await apifyService.scrapePostEngagement(d.live_url);

  // Calculate engagement rate
  const engagementRate = d.followers_count > 0
    ? parseFloat((((stats.likes + stats.comments + stats.saves) / d.followers_count) * 100).toFixed(2))
    : 0;

  // Upsert into deliverable_stats
  const { rows: upserted } = await db.query(
    `INSERT INTO deliverable_stats
       (deliverable_id, reach, impressions, likes, comments, saves, shares, engagement_rate, scraped_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (deliverable_id) DO UPDATE SET
       reach = EXCLUDED.reach,
       impressions = EXCLUDED.impressions,
       likes = EXCLUDED.likes,
       comments = EXCLUDED.comments,
       saves = EXCLUDED.saves,
       shares = EXCLUDED.shares,
       engagement_rate = EXCLUDED.engagement_rate,
       scraped_at = NOW()
     RETURNING *`,
    [d.id, stats.reach, stats.impressions, stats.likes, stats.comments, stats.saves, stats.shares, engagementRate]
  );

  return success(res, {
    deliverable_id: d.id,
    stats: upserted[0],
    message: 'Stats refreshed successfully from Instagram',
  });
});

module.exports = { getCampaignEngagement, refreshDeliverableStats };
