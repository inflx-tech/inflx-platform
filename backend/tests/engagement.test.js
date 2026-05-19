'use strict';

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer } = require('./helpers/factories');
const { run: runEngagementJob } = require('../src/jobs/apify-engagement.job');

beforeEach(async () => {
  await truncateAll();
});

describe('Engagement Analytics', () => {
  async function setup() {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'eng_test_inf' });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);
    // Set followers for engagement rate calculation
    await query(`UPDATE influencers SET followers_count = 180000 WHERE id = $1`, [inf.id]);

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'Engagement Test Campaign', 'live', 1000000) RETURNING *`,
      [brand.id]
    );
    const { rows: [cs] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set 1', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'active', 100000) RETURNING *`,
      [cs.id, inf.id]
    );

    // Create a live deliverable
    const { rows: [deliverable] } = await query(
      `INSERT INTO deliverables (campaign_influencer_id, type, status, live_url)
       VALUES ($1, 'reel', 'live', 'https://instagram.com/p/test123') RETURNING *`,
      [ci.id]
    );

    return { brandToken, infToken, brand, brandUser, inf, infUser, campaign, cs, ci, deliverable };
  }

  test('apify-engagement cron creates deliverable_stats rows', async () => {
    const { deliverable } = await setup();

    const result = await runEngagementJob();
    expect(result.scraped).toBe(1);

    const { rows: [stats] } = await query(
      `SELECT * FROM deliverable_stats WHERE deliverable_id = $1`,
      [deliverable.id]
    );
    expect(stats).toBeTruthy();
    expect(parseInt(stats.reach)).toBe(41000);
    expect(parseInt(stats.likes)).toBe(9800);
    expect(parseInt(stats.shares)).toBe(319);
  });

  test('GET /brands/me/campaigns/:id/engagement returns correct structure', async () => {
    const { brandToken, campaign } = await setup();

    // Run engagement job first to populate stats
    await runEngagementJob();

    const res = await request(app)
      .get(`/v1/brands/me/campaigns/${campaign.id}/engagement`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.campaign_id).toBe(campaign.id);
    expect(res.body.data.campaign_name).toBe('Engagement Test Campaign');
    expect(res.body.data.totals).toBeDefined();
    // engagement.service.js:151-163 — totals shape: total_likes/
    // total_comments/total_views/avg_er + by_set/by_influencer
    // (no category_benchmark_er / daily_reach in this analytics version)
    expect(res.body.data.totals.total_likes).toBeDefined();
    expect(res.body.data.totals.total_comments).toBeDefined();
    expect(res.body.data.totals.total_views).toBeDefined();
    expect(res.body.data.totals.avg_er).toBeDefined();
    expect(res.body.data.by_influencer).toBeInstanceOf(Array);
    expect(res.body.data.by_influencer.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.by_set).toBeInstanceOf(Array);
  });

  test('GET /brands/me/campaigns/:id/engagement returns 404 for unknown campaign', async () => {
    const { brandToken } = await setup();

    const res = await request(app)
      .get('/v1/brands/me/campaigns/00000000-0000-0000-0000-000000000000/engagement')
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.status).toBe(404);
  });

  test('GET /brands/me/campaigns/:id/engagement returns 403 for influencer', async () => {
    const { infToken, campaign } = await setup();

    const res = await request(app)
      .get(`/v1/brands/me/campaigns/${campaign.id}/engagement`)
      .set('Authorization', `Bearer ${infToken}`);
    expect(res.status).toBe(403);
  });
});
