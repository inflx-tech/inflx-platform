'use strict';

const db = require('../config/db');
const env = require('../config/env');

/**
 * Get full engagement analytics for a campaign (brand view).
 */
async function getCampaignEngagement(campaignId) {
  // Verify campaign exists
  const { rows: campRows } = await db.query(
    `SELECT c.id, c.name, c.start_date, c.end_date
     FROM campaigns c
     WHERE c.id = $1`,
    [campaignId]
  );
  if (!campRows[0]) return null;
  const campaign = campRows[0];

  // Get all influencers + their deliverables + stats for this campaign
  const { rows: infRows } = await db.query(
    `SELECT
       ci.id AS campaign_influencer_id,
       i.id AS influencer_id,
       u.name,
       i.instagram_handle AS handle,
       i.followers_count,
       ds.reach, ds.impressions, ds.likes, ds.comments, ds.saves, ds.shares,
       ds.engagement_rate, ds.scraped_at,
       d.id AS deliverable_id, d.type AS deliverable_type, d.live_url, d.status AS deliverable_status
     FROM campaign_sets cs
     JOIN campaign_influencers ci ON ci.set_id = cs.id
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u ON u.id = i.user_id
     LEFT JOIN deliverables d ON d.campaign_influencer_id = ci.id AND d.status = 'live'
     LEFT JOIN deliverable_stats ds ON ds.deliverable_id = d.id
     WHERE cs.campaign_id = $1`,
    [campaignId]
  );

  // Aggregate by influencer
  const influencerMap = {};
  for (const row of infRows) {
    if (!influencerMap[row.influencer_id]) {
      influencerMap[row.influencer_id] = {
        influencer_id: row.influencer_id,
        name: row.name,
        handle: `@${row.handle}`,
        followers: parseInt(row.followers_count) || 0,
        reach: 0, impressions: 0, likes: 0, comments: 0, saves: 0, shares: 0,
        engagement_rate: parseFloat(row.engagement_rate) || 0,
        benchmark_er: env.CATEGORY_BENCHMARK_ER,
        deliverables: [],
      };
    }
    const inf = influencerMap[row.influencer_id];

    if (row.reach) inf.reach       += parseInt(row.reach);
    if (row.impressions) inf.impressions += parseInt(row.impressions);
    if (row.likes) inf.likes       += parseInt(row.likes);
    if (row.comments) inf.comments    += parseInt(row.comments);
    if (row.saves) inf.saves       += parseInt(row.saves);
    if (row.shares) inf.shares      += parseInt(row.shares);
    if (row.engagement_rate) inf.engagement_rate = parseFloat(row.engagement_rate);

    if (row.deliverable_id) {
      inf.deliverables.push({
        type: row.deliverable_type,
        live_url: row.live_url,
        stats: row.reach ? {
          reach: parseInt(row.reach),
          impressions: parseInt(row.impressions),
          likes: parseInt(row.likes),
          comments: parseInt(row.comments),
          saves: parseInt(row.saves),
          shares: parseInt(row.shares),
          engagement_rate: parseFloat(row.engagement_rate),
        } : null,
      });
    }
  }

  const byInfluencer = Object.values(influencerMap);

  // Totals
  const totalReach       = byInfluencer.reduce((s, i) => s + i.reach, 0);
  const totalImpressions = byInfluencer.reduce((s, i) => s + i.impressions, 0);
  const blendedEr        = byInfluencer.length > 0
    ? parseFloat((byInfluencer.reduce((s, i) => s + i.engagement_rate, 0) / byInfluencer.length).toFixed(2))
    : 0;

  // daily_reach: aggregate by scraped_at date
  // When APIFY_MOCK, generate 12 mock days if no real data
  let dailyReach = [];
  const { rows: dailyRows } = await db.query(
    `SELECT DATE(ds.scraped_at) AS date, SUM(ds.reach) AS reach
     FROM deliverable_stats ds
     JOIN deliverables d ON d.id = ds.deliverable_id
     JOIN campaign_influencers ci ON ci.id = d.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     WHERE cs.campaign_id = $1
     GROUP BY DATE(ds.scraped_at)
     ORDER BY DATE(ds.scraped_at)`,
    [campaignId]
  );

  if (dailyRows.length > 0) {
    dailyReach = dailyRows.map(r => ({ date: r.date, reach: parseInt(r.reach) }));
  } else if (env.APIFY_MOCK) {
    // Generate 12 days of mock data for chart rendering
    const startDate = campaign.start_date ? new Date(campaign.start_date) : new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dailyReach.push({
        date: d.toISOString().split('T')[0],
        reach: Math.floor(3000 + Math.random() * 8000),
      });
    }
  }

  return {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    date_range: { start: campaign.start_date, end: campaign.end_date },
    totals: {
      total_reach: totalReach,
      total_impressions: totalImpressions,
      blended_er: blendedEr,
      category_benchmark_er: env.CATEGORY_BENCHMARK_ER,
    },
    daily_reach: dailyReach,
    by_influencer: byInfluencer,
  };
}

module.exports = { getCampaignEngagement };
