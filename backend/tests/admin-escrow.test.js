'use strict';

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer, createAdminUser } = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

describe('Admin Escrow Management', () => {
  async function setup() {
    const { token: financeToken } = await createAdminUser('finance');
    const { token: reviewerToken } = await createAdminUser('reviewer');

    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'admin_test_inf' });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'Admin Test Campaign', 'live', 500000) RETURNING *`,
      [brand.id]
    );
    const { rows: [cs] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'active', 100000) RETURNING *`,
      [cs.id, inf.id]
    );
    const { rows: [escrowEntry] } = await query(
      `INSERT INTO escrow_entries
         (campaign_influencer_id, tranche_number, amount, platform_fee_amount, net_to_influencer,
          status, trigger_event, triggered_at)
       VALUES ($1, 3, 500000, 40000, 460000, 'queued', 'day_30_post_live', NOW() - INTERVAL '31 days')
       RETURNING *`,
      [ci.id]
    );

    return { financeToken, reviewerToken, brand, brandUser, inf, infUser, campaign, cs, ci, escrowEntry };
  }

  test('GET /admin/escrow returns all escrow entries', async () => {
    const { financeToken, escrowEntry } = await setup();

    const res = await request(app)
      .get('/v1/admin/escrow')
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.escrow_entries).toBeInstanceOf(Array);
    expect(res.body.data.escrow_entries.length).toBeGreaterThanOrEqual(1);
    const entry = res.body.data.escrow_entries.find(e => e.id === escrowEntry.id);
    expect(entry).toBeTruthy();
    expect(entry.campaign_name).toBe('Admin Test Campaign');
  });

  test('GET /admin/escrow filters by status', async () => {
    const { financeToken } = await setup();

    const res = await request(app)
      .get('/v1/admin/escrow?status=queued')
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(200);
    res.body.data.escrow_entries.forEach(e => {
      expect(e.status).toBe('queued');
    });
  });

  test('POST /admin/escrow/:id/release releases a queued tranche (finance admin)', async () => {
    const { financeToken, escrowEntry, inf } = await setup();

    const res = await request(app)
      .post(`/v1/admin/escrow/${escrowEntry.id}/release`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ override_reason: 'Manual release for testing' });

    expect(res.status).toBe(200);
    expect(res.body.data.escrow_entry.status).toBe('released');

    // Verify influencer wallet credited
    const { rows: [updatedInf] } = await query(
      `SELECT wallet_balance FROM influencers WHERE id = $1`,
      [inf.id]
    );
    expect(parseFloat(updatedInf.wallet_balance)).toBe(460000);
  });

  test('POST /admin/escrow/:id/release returns 403 for reviewer role', async () => {
    const { reviewerToken, escrowEntry } = await setup();

    const res = await request(app)
      .post(`/v1/admin/escrow/${escrowEntry.id}/release`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ override_reason: 'Unauthorized release' });

    expect(res.status).toBe(403);
  });

  test('POST /admin/escrow/:id/release requires override_reason', async () => {
    const { financeToken, escrowEntry } = await setup();

    const res = await request(app)
      .post(`/v1/admin/escrow/${escrowEntry.id}/release`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({});

    expect(res.status).toBe(422);
  });

  test('GET /admin/stats returns platform statistics', async () => {
    const { financeToken } = await setup();

    const res = await request(app)
      .get('/v1/admin/stats')
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('pending_approvals');
    expect(res.body.data).toHaveProperty('active_brands');
    expect(res.body.data).toHaveProperty('escrow_locked');
    expect(res.body.data).toHaveProperty('escrow_queued');
    expect(res.body.data).toHaveProperty('platform_revenue_this_month');
  });
});
