'use strict';

const db = require('../config/db');
const apifyService = require('../services/apify.service');

async function run() {
  console.log('[CRON apify-engagement] Running...');

  const { rows: deliverables } = await db.query(
    `SELECT DISTINCT d.id, d.live_url, d.campaign_influencer_id,
            ci.influencer_id, i.followers_count
     FROM deliverables d
     JOIN campaign_influencers ci ON d.campaign_influencer_id = ci.id
     JOIN influencers i ON i.id = ci.influencer_id
     WHERE d.status = 'live'
       AND d.live_url IS NOT NULL
       AND ci.status IN ('active', 'completed')`
  );

  if (deliverables.length === 0) {
    console.log('[CRON apify-engagement] No live deliverables to scrape.');
    return { scraped: 0 };
  }

  let scraped = 0;

  for (const d of deliverables) {
    try {
      const stats = await apifyService.scrapePostEngagement(d.live_url);

      // Calculate engagement rate: ((likes + comments + saves) / followers_count) * 100
      const engagementRate = d.followers_count > 0
        ? parseFloat((((stats.likes + stats.comments + stats.saves) / d.followers_count) * 100).toFixed(2))
        : 0;

      await db.query(
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
           scraped_at = NOW()`,
        [d.id, stats.reach, stats.impressions, stats.likes, stats.comments, stats.saves, stats.shares, engagementRate]
      );

      scraped++;
    } catch (err) {
      console.error(`[CRON apify-engagement] Failed to scrape deliverable ${d.id}:`, err.message);
    }
  }

  console.log(`[CRON apify-engagement] Scraped ${scraped} deliverables`);
  return { scraped };
}

module.exports = { run };
