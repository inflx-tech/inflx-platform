'use strict';

/**
 * Phase 4 — Block A
 * Tests: follower register/profile, follow/unfollow, store, business store,
 *        category listing, address management
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

// ── helpers ──────────────────────────────────────────────────────────────────

async function approveUser(userId) {
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]);
}

async function registerFollower(token, overrides = {}) {
  const res = await request(app)
    .post('/v1/followers/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Follower', city: 'Vijayawada', state: 'Andhra Pradesh', ...overrides });
  if (res.status !== 201) throw new Error(`registerFollower failed: ${JSON.stringify(res.body)}`);
  return res.body.data.follower;
}

/**
 * Sets up brand + influencer + published campaign with one offer.
 * Returns all IDs needed for store tests.
 */
async function setupStoreScenario() {
  // Brand
  const { token: brandToken, user: brandUser } = await createBrandUser();
  const brand = await registerBrand(brandToken, {
    business_name: 'Spice Garden',
    category: 'restaurant',
  });
  await approveUser(brandUser.id);
  // Set brand user city
  await query(`UPDATE users SET city = 'Vijayawada' WHERE id = $1`, [brandUser.id]);

  // Fund wallet
  const topupRes = await request(app)
    .post('/v1/brands/me/wallet/topup')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ amount: 500000 });
  await request(app)
    .post('/v1/brands/me/wallet/topup/verify')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({
      razorpay_order_id: topupRes.body.data.order_id,
      razorpay_payment_id: 'pay_store_setup',
      razorpay_signature: 'mock_sig',
    });

  // Influencer
  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'priyacooks' });
  await approveUser(infUser.id);

  // Campaign
  const campRes = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Summer Promo', total_budget: 100000, brief: 'Showcase our special menu' });
  const cid = campRes.body.data.campaign.id;

  // Set
  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Food Creators', goal: 'conversion', assignment_mode: 'handpick' });
  const sid = setRes.body.data.set.id;

  // Offer
  const offerRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({
      offer_type: 'percentage',
      discount_value: 30,
      availing_modes: ['pay_at_store', 'prebook'],
    });
  const oid = offerRes.body.data.offer.id;

  // Invite
  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee: 10000, posting_date: '2026-07-15' });
  const ci = inviteRes.body.data.campaign_influencer;

  // Set coupon + commission on CI
  await query(
    `UPDATE campaign_influencers SET coupon_code = 'SUMMER25_PRIYA', commission_pct = 8 WHERE id = $1`,
    [ci.id]
  );

  // Accept + sign contract to get to 'contracted' status
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

  // Publish campaign
  await request(app)
    .post(`/v1/campaigns/${cid}/publish`)
    .set('Authorization', `Bearer ${brandToken}`);

  return {
    brandToken, infToken, brandUser, infUser, brand, inf, cid, sid, oid, ci: { ...ci, id: ci.id },
  };
}

// ── POST /v1/followers/register ───────────────────────────────────────────────

describe('POST /v1/followers/register', () => {
  it('creates a follower profile', async () => {
    const { token } = await createFollowerUser();
    const res = await request(app)
      .post('/v1/followers/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ravi Kumar', city: 'Vijayawada', state: 'Andhra Pradesh' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.follower).toBeDefined();
    expect(res.body.data.follower.id).toBeDefined();
  });

  it('is idempotent — second call returns existing profile', async () => {
    const { token } = await createFollowerUser();
    await registerFollower(token);
    const res = await request(app)
      .post('/v1/followers/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ravi Kumar', city: 'Vijayawada', state: 'Andhra Pradesh' });
    expect(res.status).toBe(201);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/v1/followers/register').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for brand role', async () => {
    const { token } = await createBrandUser();
    const res = await request(app)
      .post('/v1/followers/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', city: 'Y', state: 'Z' });
    expect(res.status).toBe(403);
  });
});

// ── GET /v1/followers/me ──────────────────────────────────────────────────────

describe('GET /v1/followers/me', () => {
  it('returns follower profile', async () => {
    const { token } = await createFollowerUser();
    await registerFollower(token);

    const res = await request(app)
      .get('/v1/followers/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.follower).toBeDefined();
    expect(res.body.data.addresses).toBeDefined();
  });

  it('returns 403 for brand role', async () => {
    const { token } = await createBrandUser();
    const res = await request(app)
      .get('/v1/followers/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ── POST /v1/follower/follows ─────────────────────────────────────────────────

describe('POST /v1/follower/follows', () => {
  it('follows an influencer', async () => {
    const { token: followerToken } = await createFollowerUser();
    await registerFollower(followerToken);

    const { token: infToken } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken);

    const res = await request(app)
      .post('/v1/follower/follows')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ influencer_id: inf.id });

    expect(res.status).toBe(200);
    expect(res.body.data.following).toBe(true);
  });

  it('is idempotent — following twice returns { following: true } without error', async () => {
    const { token: followerToken } = await createFollowerUser();
    await registerFollower(followerToken);
    const { token: infToken } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken);

    await request(app)
      .post('/v1/follower/follows')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ influencer_id: inf.id });

    const res = await request(app)
      .post('/v1/follower/follows')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ influencer_id: inf.id });

    expect(res.status).toBe(200);
    expect(res.body.data.following).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/v1/follower/follows').send({ influencer_id: 'x' });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /v1/follower/follows/:influencer_id ────────────────────────────────

describe('DELETE /v1/follower/follows/:influencer_id', () => {
  it('unfollows an influencer', async () => {
    const { token: followerToken } = await createFollowerUser();
    await registerFollower(followerToken);
    const { token: infToken } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken);

    await request(app)
      .post('/v1/follower/follows')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ influencer_id: inf.id });

    const res = await request(app)
      .delete(`/v1/follower/follows/${inf.id}`)
      .set('Authorization', `Bearer ${followerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.following).toBe(false);
  });

  it('returns { following: false } even if not following (idempotent)', async () => {
    const { token: followerToken } = await createFollowerUser();
    await registerFollower(followerToken);
    const { token: infToken } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken);

    const res = await request(app)
      .delete(`/v1/follower/follows/${inf.id}`)
      .set('Authorization', `Bearer ${followerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.following).toBe(false);
  });
});

// ── GET /v1/store/:handle ─────────────────────────────────────────────────────

describe('GET /v1/store/:influencer_handle', () => {
  it('returns influencer profile and active offers (no auth required)', async () => {
    const { inf, oid, cid, sid } = await setupStoreScenario();

    const res = await request(app).get('/v1/store/priyacooks');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.influencer).toBeDefined();
    expect(res.body.data.influencer.instagram_handle).toBe('priyacooks');
    expect(Array.isArray(res.body.data.offers)).toBe(true);
    expect(res.body.data.offers.length).toBeGreaterThan(0);
  });

  it('returns tracking_ids in response', async () => {
    const { cid, sid, oid, ci } = await setupStoreScenario();

    const res = await request(app).get('/v1/store/priyacooks');

    expect(res.status).toBe(200);
    expect(res.body.data.tracking).toBeDefined();
    expect(res.body.data.tracking.campaign_id).toBe(cid);
    expect(res.body.data.tracking.offer_id).toBe(oid);
    expect(res.body.data.tracking.campaign_influencer_id).toBe(ci.id);
  });

  it('validates tracking params when provided', async () => {
    const { cid, sid, oid, ci } = await setupStoreScenario();

    const res = await request(app)
      .get(`/v1/store/priyacooks?cid=${cid}&sid=${sid}&oid=${oid}&iid=${ci.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tracking.campaign_id).toBe(cid);
  });

  it('returns 404 for unknown handle', async () => {
    const res = await request(app).get('/v1/store/unknownhandle_xyz_99');
    expect(res.status).toBe(404);
  });

  it('returns coupon_code and commission_pct on offers', async () => {
    await setupStoreScenario();

    const res = await request(app).get('/v1/store/priyacooks');
    const offer = res.body.data.offers[0];

    expect(offer.coupon_code).toBe('SUMMER25_PRIYA');
    expect(parseFloat(offer.commission_pct)).toBe(8);
  });
});

// ── GET /v1/business/:brand_id ────────────────────────────────────────────────

describe('GET /v1/business/:brand_id', () => {
  it('returns brand store with active offers grouped by influencer', async () => {
    const { brand, cid } = await setupStoreScenario();

    const res = await request(app).get(`/v1/business/${brand.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.brand).toBeDefined();
    expect(Array.isArray(res.body.data.influencers)).toBe(true);
  });

  it('returns 404 for unknown brand', async () => {
    const res = await request(app).get('/v1/business/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

// ── GET /v1/category/:category_key ───────────────────────────────────────────

describe('GET /v1/category/:category_key', () => {
  it('returns active offers for a category', async () => {
    await setupStoreScenario();

    const res = await request(app).get('/v1/category/restaurant');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.offers)).toBe(true);
  });

  it('filters by city when provided', async () => {
    await setupStoreScenario();

    const res = await request(app).get('/v1/category/restaurant?city=Vijayawada');
    expect(res.status).toBe(200);
    expect(res.body.data.offers.length).toBeGreaterThan(0);
  });

  it('returns empty when city does not match', async () => {
    await setupStoreScenario();

    const res = await request(app).get('/v1/category/restaurant?city=Mumbai');
    expect(res.status).toBe(200);
    expect(res.body.data.offers.length).toBe(0);
  });
});

// ── Follower Addresses ────────────────────────────────────────────────────────

describe('Follower address management', () => {
  it('POST /v1/follower/addresses creates an address', async () => {
    const { token } = await createFollowerUser();
    await registerFollower(token);

    const res = await request(app)
      .post('/v1/follower/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home', line1: '10 MG Road', city: 'Vijayawada', pincode: '520001', is_default: true });

    expect(res.status).toBe(201);
    expect(res.body.data.address.id).toBeDefined();
    expect(res.body.data.address.is_default).toBe(true);
  });

  it('GET /v1/follower/addresses returns address list', async () => {
    const { token } = await createFollowerUser();
    await registerFollower(token);

    await request(app)
      .post('/v1/follower/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home', line1: '10 MG Road', city: 'Vijayawada', pincode: '520001', is_default: true });

    const res = await request(app)
      .get('/v1/follower/addresses')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.addresses.length).toBe(1);
  });

  it('setting a new default unsets old default', async () => {
    const { token } = await createFollowerUser();
    await registerFollower(token);

    await request(app)
      .post('/v1/follower/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home', line1: 'Address 1', city: 'Vijayawada', pincode: '520001', is_default: true });

    await request(app)
      .post('/v1/follower/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Work', line1: 'Address 2', city: 'Vijayawada', pincode: '520002', is_default: true });

    const res = await request(app)
      .get('/v1/follower/addresses')
      .set('Authorization', `Bearer ${token}`);

    const defaults = res.body.data.addresses.filter(a => a.is_default);
    expect(defaults.length).toBe(1);
    expect(defaults[0].label).toBe('Work');
  });

  it('PATCH /v1/follower/addresses/:id updates address', async () => {
    const { token } = await createFollowerUser();
    await registerFollower(token);

    const addRes = await request(app)
      .post('/v1/follower/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home', line1: '10 MG Road', city: 'Vijayawada', pincode: '520001' });

    const addrId = addRes.body.data.address.id;

    const res = await request(app)
      .patch(`/v1/follower/addresses/${addrId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Hyderabad' });

    expect(res.status).toBe(200);
    expect(res.body.data.address.city).toBe('Hyderabad');
  });
});
