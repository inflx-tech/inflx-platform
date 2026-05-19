'use strict';

/**
 * Phase 4 — Block G: Commission tracking + brand conversion analytics
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  createFollowerUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

async function approveUser(userId) {
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]);
}

async function registerFollower(token) {
  const res = await request(app)
    .post('/v1/followers/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Ravi', city: 'Vijayawada', state: 'AP' });
  if (res.status !== 201) throw new Error(`registerFollower failed: ${JSON.stringify(res.body)}`);
  return res.body.data.follower;
}

/**
 * Full end-to-end scenario: brand + influencer with contracted offer + follower pays
 */
async function setupCommissionScenario() {
  const { token: brandToken, user: brandUser } = await createBrandUser();
  const brand = await registerBrand(brandToken, { business_name: 'Spice Garden', category: 'restaurant' });
  await approveUser(brandUser.id);

  const topupRes = await request(app)
    .post('/v1/brands/me/wallet/topup')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ amount: 500000 });
  await request(app)
    .post('/v1/brands/me/wallet/topup/verify')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({
      razorpay_order_id: topupRes.body.data.order_id,
      razorpay_payment_id: 'pay_comm_setup',
      razorpay_signature: 'mock_sig',
    });

  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'priyacooks2' });
  await approveUser(infUser.id);

  const campRes = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Summer Commission', total_budget: 100000, brief: 'Summer menu', start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = campRes.body.data.campaign.id;

  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Creators', goal: 'conversion', assignment_mode: 'handpick', coupon_prefix: 'TESTCPN' });
  const sid = setRes.body.data.set.id;

  const offerRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ offer_type: 'percentage', discount_value: 30, availing_modes: ['pay_at_store'] });
  const oid = offerRes.body.data.offer.id;

  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee: 10000, posting_date: '2026-07-15', offer_type: 'percentage' });
  const ci = inviteRes.body.data.campaign_influencer;

  await query(
    `UPDATE campaign_influencers SET coupon_code = 'SUMMER25_PRIYA', commission_pct = 8 WHERE id = $1`,
    [ci.id]
  );

  await request(app)
    .post(`/v1/offers/${ci.id}/accept`)
    .set('Authorization', `Bearer ${infToken}`);

  const contractRes = await request(app)
    .get(`/v1/contracts/${ci.id}`)
    .set('Authorization', `Bearer ${brandToken}`);
  const contractId = contractRes.body.data.contract.id;

  await request(app)
    .post(`/v1/contracts/${contractId}/sign`)
    .set('Authorization', `Bearer ${infToken}`)
    .send({ typed_name: 'Priya Sharma' });

  await request(app)
    .post(`/v1/contracts/${contractId}/brand-sign`)
    .set('Authorization', `Bearer ${brandToken}`);

  await request(app)
    .post(`/v1/campaigns/${cid}/publish`)
    .set('Authorization', `Bearer ${brandToken}`);

  // Follower pays
  const { token: followerToken } = await createFollowerUser();
  await registerFollower(followerToken);

  const initRes = await request(app)
    .post('/v1/follower/pay-at-store')
    .set('Authorization', `Bearer ${followerToken}`)
    .send({ offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id, bill_amount: 100000 });

  await request(app)
    .post('/v1/follower/pay-at-store/verify')
    .set('Authorization', `Bearer ${followerToken}`)
    .send({
      razorpay_order_id: initRes.body.data.razorpay_order_id,
      razorpay_payment_id: 'pay_commission_001',
      razorpay_signature: 'mock_sig',
      offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
      bill_amount: 100000,
    });

  return { brandToken, infToken, followerToken, brand, inf, cid, sid, oid, ci };
}

// ── GET /v1/influencers/me/commissions ────────────────────────────────────────

describe('GET /v1/influencers/me/commissions', () => {
  it('returns commission list for influencer', async () => {
    const { infToken } = await setupCommissionScenario();

    const res = await request(app)
      .get('/v1/influencers/me/commissions')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.commissions)).toBe(true);
    expect(res.body.data.commissions.length).toBe(1);
  });

  it('commission has required fields', async () => {
    const { infToken } = await setupCommissionScenario();

    const res = await request(app)
      .get('/v1/influencers/me/commissions')
      .set('Authorization', `Bearer ${infToken}`);

    const comm = res.body.data.commissions[0];
    expect(comm.transaction_id).toBeDefined();
    expect(comm.sale_id_display).toMatch(/^#INFLX-/);
    expect(comm.commission_amount).toBe(5600); // 8% of 70000
    expect(comm.status).toBe('pending');
    expect(comm.days_until_confirmed).toBeGreaterThan(0);
    expect(comm.coupon_code).toBe('SUMMER25_PRIYA');
  });

  it('filters by status=pending returns only pending', async () => {
    const { infToken } = await setupCommissionScenario();

    const res = await request(app)
      .get('/v1/influencers/me/commissions?status=pending')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.commissions.every(c => c.status === 'pending')).toBe(true);
  });

  it('returns summary totals', async () => {
    const { infToken } = await setupCommissionScenario();

    const res = await request(app)
      .get('/v1/influencers/me/commissions')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary.pending_commission).toBe(5600);
    expect(res.body.data.summary.total_commission_earned).toBe(5600);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/v1/influencers/me/commissions');
    expect(res.status).toBe(401);
  });

  it('returns 403 for brand', async () => {
    const { brandToken } = await setupCommissionScenario();
    const res = await request(app)
      .get('/v1/influencers/me/commissions')
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.status).toBe(403);
  });
});

// ── GET /v1/brands/me/campaigns/:id/conversions ───────────────────────────────

describe('GET /v1/brands/me/campaigns/:id/conversions', () => {
  it('returns campaign conversion analytics', async () => {
    const { brandToken, cid } = await setupCommissionScenario();

    const res = await request(app)
      .get(`/v1/brands/me/campaigns/${cid}/conversions`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.campaign_id).toBe(cid);
    expect(res.body.data.totals).toBeDefined();
    expect(res.body.data.totals.total_sales).toBe(1);
    expect(res.body.data.totals.total_revenue).toBe(70000); // net_amount
  });

  it('returns by_channel breakdown', async () => {
    const { brandToken, cid } = await setupCommissionScenario();

    const res = await request(app)
      .get(`/v1/brands/me/campaigns/${cid}/conversions`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.body.data.by_channel).toBeDefined();
    expect(res.body.data.by_channel.pay_at_store).toBeDefined();
    expect(res.body.data.by_channel.pay_at_store.count).toBe(1);
  });

  it('returns by_influencer breakdown', async () => {
    const { brandToken, cid } = await setupCommissionScenario();

    const res = await request(app)
      .get(`/v1/brands/me/campaigns/${cid}/conversions`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(Array.isArray(res.body.data.by_influencer)).toBe(true);
    expect(res.body.data.by_influencer.length).toBe(1);
    expect(res.body.data.by_influencer[0].coupon_code).toBe('SUMMER25_PRIYA');
    expect(res.body.data.by_influencer[0].sales_count).toBe(1);
  });

  it('returns 403 for another brand', async () => {
    const { cid } = await setupCommissionScenario();
    const { token: otherToken } = await createBrandUser();
    await registerBrand(otherToken);
    const res = await request(app)
      .get(`/v1/brands/me/campaigns/${cid}/conversions`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

// ── GET /v1/influencers/me/earnings (updated with commission_summary) ─────────

describe('GET /v1/influencers/me/earnings — Phase 4 additions', () => {
  it('includes pending_balance in earnings response', async () => {
    const { infToken } = await setupCommissionScenario();

    const res = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pending_balance).toBeDefined();
    // T1 released to wallet, follower commission to pending_balance
    expect(parseFloat(res.body.data.pending_balance)).toBeGreaterThan(0);
  });

  it('includes commission_summary', async () => {
    const { infToken } = await setupCommissionScenario();

    const res = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.body.data.commission_summary).toBeDefined();
    expect(res.body.data.commission_summary.pending).toBe(5600);
    expect(res.body.data.commission_summary.confirmed).toBe(0);
    expect(res.body.data.commission_summary.total).toBe(5600);
  });
});
