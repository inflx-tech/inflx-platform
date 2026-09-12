'use strict';

const ITEM4_DAY = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10); // item 4: sets need a posting date ≥ 7 days out
/**
 * Phase 4 — Block F: Follower home feed
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

async function registerFollower(token, city = 'Vijayawada') {
  const res = await request(app)
    .post('/v1/followers/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Follower', city, state: 'AP' });
  if (res.status !== 201) throw new Error(`registerFollower failed: ${JSON.stringify(res.body)}`);
  return res.body.data.follower;
}

async function setupFeedScenario() {
  // Brand in Vijayawada
  const { token: brandToken, user: brandUser } = await createBrandUser();
  const brand = await registerBrand(brandToken, { business_name: 'Spice Garden', category: 'restaurant' });
  await approveUser(brandUser.id);
  await query(`UPDATE users SET city = 'Vijayawada' WHERE id = $1`, [brandUser.id]);

  const topupRes = await request(app)
    .post('/v1/brands/me/wallet/topup')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ amount: 500000 });
  await request(app)
    .post('/v1/brands/me/wallet/topup/verify')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({
      razorpay_order_id: topupRes.body.data.order_id,
      razorpay_payment_id: 'pay_feed_setup',
      razorpay_signature: 'mock_sig',
    });

  // Influencer
  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'feedinfluencer' });
  await approveUser(infUser.id);

  const campRes = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Feed Test Campaign', total_budget: 100000, brief: 'Test', start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = campRes.body.data.campaign.id;

  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Creators', goal: 'conversion', assignment_mode: 'handpick', coupon_prefix: 'TESTCPN', formats_json: [{ type: 'reel', count: 1 }] });
  const sid = setRes.body.data.set.id;

  const offerRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ offer_type: 'percentage', discount_value: 20, availing_modes: ['pay_at_store'] });
  const oid = offerRes.body.data.offer.id;

  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee: 10000, posting_date: '2026-07-15', offer_type: 'percentage' });
  const ci = inviteRes.body.data.campaign_influencer;

  await query(
    `UPDATE campaign_influencers SET coupon_code = 'FEED20', commission_pct = 8 WHERE id = $1`,
    [ci.id]
  );

  await request(app)
    .post(`/v1/offers/${ci.id}/accept`)
    .set('Authorization', `Bearer ${infToken}`);

  const contractRes = await request(app)
    .get(`/v1/contracts/${ci.id}`)
    .set('Authorization', `Bearer ${brandToken}`);
  const contractId = contractRes.body.data.contract.id;

  // Brand "Approve & Send": draft → pending_influencer (required before signing)
  await request(app)
    .post(`/v1/contracts/${contractId}/approve`)
    .set('Authorization', `Bearer ${brandToken}`);

  await request(app)
    .post(`/v1/contracts/${contractId}/sign`)
    .set('Authorization', `Bearer ${infToken}`)
    .send({ typed_name: 'Feed Influencer' });

  await request(app)
    .post(`/v1/contracts/${contractId}/brand-sign`)
    .set('Authorization', `Bearer ${brandToken}`);

  await request(app)
    .post(`/v1/campaigns/${cid}/publish`)
    .set('Authorization', `Bearer ${brandToken}`);

  // Follower in Vijayawada
  const { token: followerToken } = await createFollowerUser();
  await registerFollower(followerToken, 'Vijayawada');

  return { brandToken, infToken, followerToken, brand, inf, cid, sid, oid, ci };
}

// ── GET /v1/follower/feed ─────────────────────────────────────────────────────

describe('GET /v1/follower/feed', () => {
  it('returns feed items for follower', async () => {
    const { followerToken } = await setupFeedScenario();

    const res = await request(app)
      .get('/v1/follower/feed')
      .set('Authorization', `Bearer ${followerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.feed)).toBe(true);
  });

  it('shows followed influencers offers in feed', async () => {
    const { followerToken, inf } = await setupFeedScenario();

    // Follow the influencer
    await request(app)
      .post('/v1/follower/follows')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ influencer_id: inf.id });

    const res = await request(app)
      .get('/v1/follower/feed')
      .set('Authorization', `Bearer ${followerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.feed.some(item => item.influencer_id === inf.id)).toBe(true);
  });

  it('shows nearby offers (same city) in feed', async () => {
    const { followerToken } = await setupFeedScenario();
    // Follower is in Vijayawada, brand is in Vijayawada

    const res = await request(app)
      .get('/v1/follower/feed')
      .set('Authorization', `Bearer ${followerToken}`);

    expect(res.status).toBe(200);
    // At least the nearby offer appears
    expect(res.body.data.feed.length).toBeGreaterThan(0);
  });

  it('feed items have required fields', async () => {
    const { followerToken, inf } = await setupFeedScenario();

    await request(app)
      .post('/v1/follower/follows')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ influencer_id: inf.id });

    const res = await request(app)
      .get('/v1/follower/feed')
      .set('Authorization', `Bearer ${followerToken}`);

    const item = res.body.data.feed[0];
    expect(item.influencer_id).toBeDefined();
    expect(item.brand_name).toBeDefined();
    expect(item.offer).toBeDefined();
    expect(item.coupon_code).toBeDefined();
  });

  it('is publicly accessible without auth and returns a location-based feed', async () => {
    // Product decision 2026-05-19: browsing the feed needs NO sign-in
    // (sign-in is required only to complete a purchase). Anonymous →
    // location-based feed via client-supplied ?city. (Resolves carve
    // backend-defect-follower-feed-noauth-500 — was 500 on no-auth.)
    await setupFeedScenario(); // publishes a Vijayawada conversion offer

    const res = await request(app).get('/v1/follower/feed?city=Vijayawada');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.feed)).toBe(true);
    // Location-scoped: the Vijayawada offer surfaces for an anonymous,
    // location-based request.
    expect(res.body.data.feed.length).toBeGreaterThan(0);
  });
});
