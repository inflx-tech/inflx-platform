'use strict';

/**
 * Phase 4 — Block E: Enquiry lead flow
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

async function setupEnquiryScenario() {
  const { token: brandToken, user: brandUser } = await createBrandUser();
  const brand = await registerBrand(brandToken, { business_name: 'Grand Venue', category: 'function_hall' });
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
      razorpay_payment_id: 'pay_enquiry_setup',
      razorpay_signature: 'mock_sig',
    });

  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'weddingplanner' });
  await approveUser(infUser.id);

  const campRes = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Wedding Season', total_budget: 100000, brief: 'Showcase our venue', start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = campRes.body.data.campaign.id;

  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Creators', goal: 'conversion', assignment_mode: 'handpick', coupon_prefix: 'TESTCPN' });
  const sid = setRes.body.data.set.id;

  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee: 20000, posting_date: '2026-08-01' });
  const ci = inviteRes.body.data.campaign_influencer;

  await query(
    `UPDATE campaign_influencers SET coupon_code = 'VENUE10', commission_pct = 5 WHERE id = $1`,
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
    .send({ typed_name: 'Wedding Planner' });

  await request(app)
    .post(`/v1/contracts/${contractId}/brand-sign`)
    .set('Authorization', `Bearer ${brandToken}`);

  const { token: followerToken } = await createFollowerUser();
  await registerFollower(followerToken);

  return { brandToken, infToken, followerToken, brand, inf, cid, sid, ci };
}

// ── POST /v1/follower/enquiry ────────────────────────────────────────────────

describe('POST /v1/follower/enquiry', () => {
  it('creates enquiry lead and returns enquiry_id', async () => {
    const { followerToken, brand, cid, sid, ci } = await setupEnquiryScenario();

    const res = await request(app)
      .post('/v1/follower/enquiry')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        brand_id: brand.id,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        form_data: {
          event_date: '2026-12-12',
          guest_count: '100-300',
          budget_range: '₹1L-₹3L',
          notes: 'Garden wedding preferred',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.enquiry_id).toBeDefined();
    expect(res.body.data.status).toBe('submitted');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/v1/follower/enquiry').send({});
    expect(res.status).toBe(401);
  });

  it('returns 422 if brand_id is missing', async () => {
    const { followerToken, cid, sid, ci } = await setupEnquiryScenario();
    const res = await request(app)
      .post('/v1/follower/enquiry')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id, form_data: {} });
    expect(res.status).toBe(422);
  });
});

// ── GET /v1/brands/me/enquiries ──────────────────────────────────────────────

describe('GET /v1/brands/me/enquiries', () => {
  it('returns all enquiries for the brand', async () => {
    const { brandToken, followerToken, brand, cid, sid, ci } = await setupEnquiryScenario();

    await request(app)
      .post('/v1/follower/enquiry')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        brand_id: brand.id, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        form_data: { notes: 'Test enquiry' },
      });

    const res = await request(app)
      .get('/v1/brands/me/enquiries')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.enquiries.length).toBe(1);
    expect(res.body.data.enquiries[0].status).toBe('submitted');
  });

  it('filters by status query param', async () => {
    const { brandToken, followerToken, brand, cid, sid, ci } = await setupEnquiryScenario();

    await request(app)
      .post('/v1/follower/enquiry')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        brand_id: brand.id, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        form_data: { notes: 'Test' },
      });

    const res = await request(app)
      .get('/v1/brands/me/enquiries?status=submitted')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.enquiries.length).toBe(1);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/v1/brands/me/enquiries');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /v1/brands/me/enquiries/:id ────────────────────────────────────────

describe('PATCH /v1/brands/me/enquiries/:id', () => {
  it('brand can update enquiry status to responded', async () => {
    const { brandToken, followerToken, brand, cid, sid, ci } = await setupEnquiryScenario();

    const enquiryRes = await request(app)
      .post('/v1/follower/enquiry')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        brand_id: brand.id, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        form_data: { notes: 'Need venue for wedding' },
      });

    const enquiryId = enquiryRes.body.data.enquiry_id;

    const res = await request(app)
      .patch(`/v1/brands/me/enquiries/${enquiryId}`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ status: 'responded' });

    expect(res.status).toBe(200);
    expect(res.body.data.enquiry.status).toBe('responded');
  });

  it('converted status with deal_value triggers influencer commission', async () => {
    const { brandToken, followerToken, infToken, brand, cid, sid, ci } = await setupEnquiryScenario();

    const enquiryRes = await request(app)
      .post('/v1/follower/enquiry')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        brand_id: brand.id, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        form_data: { notes: 'Venue for 200 guests' },
      });

    const enquiryId = enquiryRes.body.data.enquiry_id;

    // Before conversion, check pending_balance
    const earningsBefore = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);
    const pendingBefore = parseFloat(earningsBefore.body.data.pending_balance);

    // Convert with deal_value = 500000 paise (₹5000)
    const res = await request(app)
      .patch(`/v1/brands/me/enquiries/${enquiryId}`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ status: 'converted', deal_value: 500000 });

    expect(res.status).toBe(200);
    expect(res.body.data.enquiry.commission_triggered).toBe(true);

    // Influencer commission = 5% of 500000 = 25000
    const earningsAfter = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);
    const pendingAfter = parseFloat(earningsAfter.body.data.pending_balance);
    expect(pendingAfter - pendingBefore).toBeCloseTo(25000, 0);
  });

  it('returns 404 for unknown enquiry', async () => {
    const { brandToken } = await setupEnquiryScenario();
    const res = await request(app)
      .patch('/v1/brands/me/enquiries/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ status: 'responded' });
    expect(res.status).toBe(404);
  });
});
