'use strict';

/**
 * Phase 4 — Block C: Pre-booking flow
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
    .send({ name: 'Test Follower', city: 'Vijayawada', state: 'AP' });
  if (res.status !== 201) throw new Error(`registerFollower failed: ${JSON.stringify(res.body)}`);
  return res.body.data.follower;
}

async function setupPrebookScenario() {
  const { token: brandToken, user: brandUser } = await createBrandUser();
  const brand = await registerBrand(brandToken, { business_name: 'Coffee House', category: 'restaurant' });
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
      razorpay_payment_id: 'pay_prebook_setup',
      razorpay_signature: 'mock_sig',
    });

  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'coffeelover' });
  await approveUser(infUser.id);

  const campRes = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Coffee Promo', total_budget: 100000, brief: 'Try our brews', start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = campRes.body.data.campaign.id;

  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Foodies', goal: 'conversion', assignment_mode: 'handpick', coupon_prefix: 'TESTCPN', formats_json: ['reel'] });
  const sid = setRes.body.data.set.id;

  const offerRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({
      offer_type: 'percentage',
      discount_value: 20,
      availing_modes: ['prebook'],
      prebook_advance: 200, // ₹200 in rupees
    });
  const oid = offerRes.body.data.offer.id;

  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee: 8000, posting_date: '2026-07-20', offer_type: 'percentage' });
  const ci = inviteRes.body.data.campaign_influencer;

  await query(
    `UPDATE campaign_influencers SET coupon_code = 'COFFEE20', commission_pct = 8 WHERE id = $1`,
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
    .send({ typed_name: 'Coffee Lover' });

  await request(app)
    .post(`/v1/contracts/${contractId}/brand-sign`)
    .set('Authorization', `Bearer ${brandToken}`);

  await request(app)
    .post(`/v1/campaigns/${cid}/publish`)
    .set('Authorization', `Bearer ${brandToken}`);

  const { token: followerToken } = await createFollowerUser();
  await registerFollower(followerToken);

  return { brandToken, infToken, followerToken, brand, inf, cid, sid, oid, ci };
}

// ── GET /v1/follower/slots ────────────────────────────────────────────────────

describe('GET /v1/follower/slots', () => {
  it('returns available time slots', async () => {
    const { oid } = await setupPrebookScenario();

    const res = await request(app)
      .get(`/v1/follower/slots?offer_id=${oid}&date=2026-08-01`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.slots)).toBe(true);
    expect(res.body.data.slots.length).toBeGreaterThan(0);
    expect(res.body.data.slots[0]).toHaveProperty('time');
    expect(res.body.data.slots[0]).toHaveProperty('available');
  });

  it('returns 422 if offer_id or date is missing', async () => {
    const res = await request(app).get('/v1/follower/slots?date=2026-08-01');
    expect(res.status).toBe(422);
  });
});

// ── POST /v1/follower/prebook ─────────────────────────────────────────────────

describe('POST /v1/follower/prebook', () => {
  it('returns Razorpay order for advance amount', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPrebookScenario();

    const res = await request(app)
      .post('/v1/follower/prebook')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        booking_date: '2026-08-01',
        booking_time: '20:00',
        guest_count: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.razorpay_order_id).toMatch(/^order_/);
    expect(res.body.data.advance_amount).toBe(20000); // ₹200 in paise
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/v1/follower/prebook').send({});
    expect(res.status).toBe(401);
  });
});

// ── POST /v1/follower/prebook/verify ─────────────────────────────────────────

describe('POST /v1/follower/prebook/verify', () => {
  it('creates booking with reference_code and correct advance', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPrebookScenario();

    const initRes = await request(app)
      .post('/v1/follower/prebook')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        booking_date: '2026-08-01',
        booking_time: '20:00',
        guest_count: 2,
      });

    const verifyRes = await request(app)
      .post('/v1/follower/prebook/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_book_001',
        razorpay_signature: 'mock_sig',
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        booking_date: '2026-08-01',
        booking_time: '20:00',
        guest_count: 2,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.booking_id).toBeDefined();
    expect(verifyRes.body.data.reference_code).toMatch(/^BK/);
    expect(verifyRes.body.data.advance_paid).toBe(20000);
  });

  it('creates follower_bookings row in DB', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPrebookScenario();

    const initRes = await request(app)
      .post('/v1/follower/prebook')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        booking_date: '2026-08-01', booking_time: '19:00', guest_count: 1,
      });

    await request(app)
      .post('/v1/follower/prebook/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_book_002',
        razorpay_signature: 'mock_sig',
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        booking_date: '2026-08-01', booking_time: '19:00', guest_count: 1,
      });

    const { rows } = await query(`SELECT * FROM follower_bookings`);
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('confirmed');
    expect(rows[0].reference_code).toMatch(/^BK/);
  });

  it('returns 404 for unknown Razorpay order', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPrebookScenario();

    const res = await request(app)
      .post('/v1/follower/prebook/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: 'order_nonexistent',
        razorpay_payment_id: 'pay_book_003',
        razorpay_signature: 'mock_sig',
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        booking_date: '2026-08-02', booking_time: '20:00', guest_count: 1,
      });

    expect(res.status).toBe(404);
  });
});
