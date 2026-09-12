'use strict';

const ITEM4_DAY = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10); // item 4: sets need a posting date ≥ 7 days out
/**
 * Phase 4 — Block C (date_range): pre-booking with pickup/return dates.
 *
 * Mirrors prebook.test.js. Tests the new POST /follower/prebook-daterange
 * (+ /verify) endpoints introduced atomically with migration 033. Uses the
 * same end-to-end campaign/contract scaffolding as prebook.test.js — only
 * the body shape and asserted fields differ.
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

async function setupDaterangeScenario() {
  const { token: brandToken, user: brandUser } = await createBrandUser();
  const brand = await registerBrand(brandToken, { business_name: 'City Wheels', category: 'car_rental' });
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
      razorpay_payment_id: 'pay_dr_setup',
      razorpay_signature: 'mock_sig',
    });

  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'roadtripper' });
  await approveUser(infUser.id);

  const campRes = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Weekend Wheels', total_budget: 100000, brief: 'Rent for the weekend', start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = campRes.body.data.campaign.id;

  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Travel Vloggers', goal: 'conversion', assignment_mode: 'handpick', coupon_prefix: 'TESTCPN', formats_json: [{ type: 'reel', count: 1 }] });
  const sid = setRes.body.data.set.id;

  const offerRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({
      offer_type: 'percentage',
      discount_value: 10,
      availing_modes: ['prebook'],
      prebook_advance: 300, // car rental token
    });
  const oid = offerRes.body.data.offer.id;

  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee: 6000, posting_date: '2026-07-20', offer_type: 'percentage' });
  const ci = inviteRes.body.data.campaign_influencer;

  await query(
    `UPDATE campaign_influencers SET coupon_code = 'WHEELS10', commission_pct = 8 WHERE id = $1`,
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
    .send({ typed_name: 'Road Tripper' });

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

// ── POST /v1/follower/prebook-daterange ──────────────────────────────────────

describe('POST /v1/follower/prebook-daterange', () => {
  it('returns Razorpay order for advance amount (token)', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupDaterangeScenario();

    const res = await request(app)
      .post('/v1/follower/prebook-daterange')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        pickup_date: '2026-08-10',
        return_date: '2026-08-12',
        duration_days: 2,
        pickup_type: 'garage',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.razorpay_order_id).toMatch(/^order_/);
    expect(res.body.data.advance_amount).toBeGreaterThan(0);
  });

  it('returns 422 when pickup_date or return_date is missing', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupDaterangeScenario();

    const res = await request(app)
      .post('/v1/follower/prebook-daterange')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        pickup_date: '2026-08-10',
        // return_date intentionally omitted
      });

    expect(res.status).toBe(422);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/v1/follower/prebook-daterange').send({});
    expect(res.status).toBe(401);
  });
});

// ── POST /v1/follower/prebook-daterange/verify ───────────────────────────────

describe('POST /v1/follower/prebook-daterange/verify', () => {
  it('creates booking with booking_type=date_range and the four daterange columns populated', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupDaterangeScenario();

    const initRes = await request(app)
      .post('/v1/follower/prebook-daterange')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        pickup_date: '2026-08-10', return_date: '2026-08-12',
        duration_days: 2, pickup_type: 'doorstep',
      });

    const verifyRes = await request(app)
      .post('/v1/follower/prebook-daterange/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_dr_001',
        razorpay_signature: 'mock_sig',
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.booking_id).toBeDefined();
    expect(verifyRes.body.data.booking_type).toBe('date_range');
    expect(verifyRes.body.data.reference_code).toMatch(/^BK/);
    expect(verifyRes.body.data.pickup_date).toBe('2026-08-10');
    expect(verifyRes.body.data.return_date).toBe('2026-08-12');
    expect(verifyRes.body.data.duration_days).toBe(2);
    expect(verifyRes.body.data.pickup_type).toBe('doorstep');
  });

  it('writes a follower_bookings row with booking_date / booking_time NULL and date_range columns set', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupDaterangeScenario();

    const initRes = await request(app)
      .post('/v1/follower/prebook-daterange')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        pickup_date: '2026-08-10', return_date: '2026-08-12',
        duration_days: 2, pickup_type: 'garage',
      });

    await request(app)
      .post('/v1/follower/prebook-daterange/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_dr_002',
        razorpay_signature: 'mock_sig',
      });

    const { rows } = await query(`SELECT * FROM follower_bookings`);
    expect(rows.length).toBe(1);
    expect(rows[0].booking_type).toBe('date_range');
    expect(rows[0].booking_date).toBeNull();
    expect(rows[0].booking_time).toBeNull();
    expect(rows[0].duration_days).toBe(2);
    expect(rows[0].pickup_type).toBe('garage');
    expect(rows[0].status).toBe('confirmed');
    expect(rows[0].reference_code).toMatch(/^BK/);
  });

  it('returns 404 for unknown Razorpay order', async () => {
    const { followerToken } = await setupDaterangeScenario();

    const res = await request(app)
      .post('/v1/follower/prebook-daterange/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: 'order_nonexistent_dr',
        razorpay_payment_id: 'pay_dr_003',
        razorpay_signature: 'mock_sig',
      });

    expect(res.status).toBe(404);
  });
});

// ── Existing /v1/follower/prebook now writes booking_type ────────────────────

describe('POST /v1/follower/prebook (booking_type write-through)', () => {
  it('defaults booking_type to "table" when client does not specify', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupDaterangeScenario();

    const initRes = await request(app)
      .post('/v1/follower/prebook')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        booking_date: '2026-08-01', booking_time: '20:00', guest_count: 2,
      });

    await request(app)
      .post('/v1/follower/prebook/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_bt_001',
        razorpay_signature: 'mock_sig',
        // booking_type intentionally omitted — should default to 'table'
      });

    const { rows } = await query(`SELECT booking_type FROM follower_bookings`);
    expect(rows.length).toBe(1);
    expect(rows[0].booking_type).toBe('table');
  });

  it('honours client-supplied booking_type=slot', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupDaterangeScenario();

    const initRes = await request(app)
      .post('/v1/follower/prebook')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        booking_date: '2026-08-01', booking_time: '13:00', guest_count: 1,
      });

    await request(app)
      .post('/v1/follower/prebook/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_bt_002',
        razorpay_signature: 'mock_sig',
        booking_type: 'slot',
      });

    const { rows } = await query(`SELECT booking_type FROM follower_bookings`);
    expect(rows.length).toBe(1);
    expect(rows[0].booking_type).toBe('slot');
  });
});
