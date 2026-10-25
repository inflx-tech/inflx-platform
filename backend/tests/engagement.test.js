'use strict';

/**
 * The brand website's campaign Analytics read.
 *
 * post-performance-v2 (P1, P11): the old apify-engagement cron, deliverables.live_url and
 * deliverable_stats are retired — nothing had written them since item 12 retired submit-live. The
 * path stays, the shape is new (E11, proved in post-performance-v2.test.js). This suite keeps the
 * door's auth and the legacy case: a campaign with only pre-item-12 deliverables answers the new
 * shape empty, with no error (02-workflow C9).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer } = require('./helpers/factories');

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

    // A pre-item-12 deliverable with a live_url: nothing reads it any more (post-performance-v2 P1).
    const { rows: [deliverable] } = await query(
      `INSERT INTO deliverables (campaign_influencer_id, type, status, live_url)
       VALUES ($1, 'reel', 'live', 'https://instagram.com/p/test123') RETURNING *`,
      [ci.id]
    );

    return { brandToken, infToken, brand, brandUser, inf, infUser, campaign, cs, ci, deliverable };
  }

  // post-performance-v2 (E25): the cron that wrote deliverable_stats is deleted; the daily job now
  // reads proof_stats, and a legacy deliverable is never one of them.
  test('the daily post-stats job never reads a legacy deliverable and never writes deliverable_stats', async () => {
    const { deliverable } = await setup();
    const jobs = require('../src/jobs');
    expect(jobs.apifyEngagementJob).toBeUndefined();
    const out = await jobs.postStatsJob.run();
    expect(out.skipped).toBeUndefined();
    expect(out.ran).toBe(0);
    const { rows } = await query(`SELECT * FROM deliverable_stats WHERE deliverable_id = $1`, [deliverable.id]);
    expect(rows).toHaveLength(0);
  });

  test('GET /brands/me/campaigns/:id/engagement returns the post-performance-v2 shape, empty for a legacy campaign (C9)', async () => {
    const { brandToken, campaign } = await setup();

    const res = await request(app)
      .get(`/v1/brands/me/campaigns/${campaign.id}/engagement`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.campaignId).toBe(campaign.id);
    expect(res.body.data.campaignName).toBe('Engagement Test Campaign');
    expect(res.body.data.totals).toEqual({ views: 0, likes: 0, comments: 0, links: 0, linksRead: 0, waiting: 0, updatedAt: null });
    expect(res.body.data.byCreator).toBeInstanceOf(Array);
    expect(res.body.data.byCreator).toHaveLength(1);
    expect(res.body.data.byCreator[0]).toMatchObject({ handle: '@eng_test_inf', links: 0 });
    expect(res.body.data.bySet).toHaveLength(1);
    expect(res.body.data.links).toEqual([]);
    expect(res.body.data).not.toHaveProperty('by_influencer');
    expect(JSON.stringify(res.body.data)).not.toMatch(/engagement_rate|avg_er/);
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

  // post-performance-v2 (E25): the per-deliverable refresh door is gone, not retired with a sentence.
  test('POST /deliverables/:id/refresh-stats is gone (404)', async () => {
    const { brandToken, deliverable } = await setup();
    const res = await request(app)
      .post(`/v1/deliverables/${deliverable.id}/refresh-stats`)
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.status).toBe(404);
  });
});
