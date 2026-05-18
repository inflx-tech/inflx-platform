'use strict';

/**
 * Phase 4 — Block B: Pay-at-store flow
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

// ── helpers ───────────────────────────────────────────────────────────────────

async function approveUser(userId) {
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]);
}

async function registerFollower(token, overrides = {}) {
  const res = await request(app)
    .post('/v1/followers/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Follower', city: 'Vijayawada', state: 'AP', ...overrides });
  if (res.status !== 201) throw new Error(`registerFollower failed: ${JSON.stringify(res.body)}`);
  return res.body.data.follower;
}

/**
 * Sets up the full scenario needed for pay-at-store:
 * brand + influencer (contracted) + campaign published + follower registered
 */
async function setupPayAtStoreScenario() {
  // Brand
  const { token: brandToken, user: brandUser } = await createBrandUser();
  const brand = await registerBrand(brandToken, { business_name: 'Spice Garden', category: 'restaurant' });
  await approveUser(brandUser.id);

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
      razorpay_payment_id: 'pay_setup_001',
      razorpay_signature: 'mock_sig',
    });

  // Influencer
  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'priyacooks' });
  await approveUser(infUser.id);

  // Campaign + set + offer + invite + accept + sign
  const campRes = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Summer Promo', total_budget: 100000, brief: 'Show our menu', start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = campRes.body.data.campaign.id;

  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Food Creators', goal: 'conversion', assignment_mode: 'handpick', coupon_prefix: 'TESTCPN' });
  const sid = setRes.body.data.set.id;

  const offerRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ offer_type: 'percentage', discount_value: 30, availing_modes: ['pay_at_store'] });
  const oid = offerRes.body.data.offer.id;

  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee: 10000, posting_date: '2026-07-15' });
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

  // Follower
  const { token: followerToken, user: followerUser } = await createFollowerUser();
  await registerFollower(followerToken);

  return { brandToken, infToken, followerToken, brand, inf, cid, sid, oid, ci };
}

// ── POST /v1/follower/pay-at-store ─────────────────────────────────────────────

describe('POST /v1/follower/pay-at-store', () => {
  it('returns Razorpay order with correct discount calculation', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPayAtStoreScenario();

    const res = await request(app)
      .post('/v1/follower/pay-at-store')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        bill_amount: 100000, // ₹1000 in paise
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.razorpay_order_id).toMatch(/^order_/);
    // 30% off ₹1000 = ₹300 discount, net = ₹700
    expect(res.body.data.discount_amount).toBe(30000);
    expect(res.body.data.net_amount).toBe(70000);
    expect(res.body.data.original_amount).toBe(100000);
  });

  it('returns commission breakdown', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPayAtStoreScenario();

    const res = await request(app)
      .post('/v1/follower/pay-at-store')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        bill_amount: 100000,
      });

    expect(res.status).toBe(201);
    // 8% of 70000 = 5600
    expect(res.body.data.breakdown.influencer_commission).toBe(5600);
    // 8% of 70000 = 5600 (default platform fee)
    expect(res.body.data.breakdown.platform_fee).toBe(5600);
    expect(res.body.data.breakdown.brand_net).toBe(70000 - 5600 - 5600); // 58800
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/v1/follower/pay-at-store').send({});
    expect(res.status).toBe(401);
  });

  it('returns 403 for brand role', async () => {
    const { brandToken, cid, sid, oid, ci } = await setupPayAtStoreScenario();
    const res = await request(app)
      .post('/v1/follower/pay-at-store')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id, bill_amount: 100000 });
    expect(res.status).toBe(403);
  });

  it('returns 409 OFFER_UNAVAILABLE for wrong campaign_id', async () => {
    const { followerToken, sid, oid, ci } = await setupPayAtStoreScenario();
    const res = await request(app)
      .post('/v1/follower/pay-at-store')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid,
        campaign_id: '00000000-0000-0000-0000-000000000000',
        set_id: sid,
        campaign_influencer_id: ci.id,
        bill_amount: 100000,
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OFFER_UNAVAILABLE');
  });

  it('returns 422 if bill_amount is missing', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPayAtStoreScenario();
    const res = await request(app)
      .post('/v1/follower/pay-at-store')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id });
    expect(res.status).toBe(422);
  });
});

// ── POST /v1/follower/pay-at-store/verify ────────────────────────────────────

describe('POST /v1/follower/pay-at-store/verify (end-to-end money flow)', () => {
  it('creates follower_transaction and returns reference_code', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPayAtStoreScenario();

    const initRes = await request(app)
      .post('/v1/follower/pay-at-store')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id, bill_amount: 100000 });

    const verifyRes = await request(app)
      .post('/v1/follower/pay-at-store/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_test_001',
        razorpay_signature: 'mock_sig',
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        bill_amount: 100000,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.transaction_id).toBeDefined();
    expect(verifyRes.body.data.reference_code).toMatch(/^INFLX-/);
    expect(verifyRes.body.data.net_amount).toBe(70000);
  });

  it('credits influencer pending_balance (8% of 70000 = 5600 paise)', async () => {
    const { followerToken, infToken, cid, sid, oid, ci, inf } = await setupPayAtStoreScenario();

    const initRes = await request(app)
      .post('/v1/follower/pay-at-store')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id, bill_amount: 100000 });

    await request(app)
      .post('/v1/follower/pay-at-store/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_test_001',
        razorpay_signature: 'mock_sig',
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        bill_amount: 100000,
      });

    // Check pending_balance via earnings endpoint
    const earningsRes = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    expect(earningsRes.status).toBe(200);
    // pending_balance should include follower commission (5600 paise = ₹56 stored as 5600)
    expect(parseFloat(earningsRes.body.data.pending_balance)).toBeGreaterThan(0);
  });

  it('commission goes to pending_balance NOT wallet_balance', async () => {
    const { followerToken, infToken, cid, sid, oid, ci } = await setupPayAtStoreScenario();

    // Get wallet_balance before
    const earningsBefore = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);
    const walletBefore = parseFloat(earningsBefore.body.data.wallet_balance);

    const initRes = await request(app)
      .post('/v1/follower/pay-at-store')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id, bill_amount: 100000 });

    await request(app)
      .post('/v1/follower/pay-at-store/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_test_002',
        razorpay_signature: 'mock_sig',
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        bill_amount: 100000,
      });

    const earningsAfter = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    // wallet_balance should NOT increase from follower commission
    expect(parseFloat(earningsAfter.body.data.wallet_balance)).toBe(walletBefore);
  });

  it('follower_transaction row has status=completed and return_window set', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPayAtStoreScenario();

    const initRes = await request(app)
      .post('/v1/follower/pay-at-store')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id, bill_amount: 100000 });

    const verifyRes = await request(app)
      .post('/v1/follower/pay-at-store/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: initRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_test_003',
        razorpay_signature: 'mock_sig',
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        bill_amount: 100000,
      });

    const txId = verifyRes.body.data.transaction_id;
    const { rows } = await query(
      `SELECT * FROM follower_transactions WHERE id = $1`,
      [txId]
    );
    expect(rows[0].status).toBe('completed');
    expect(rows[0].return_window_ends_at).not.toBeNull();
    expect(rows[0].coupon_code_used).toBe('SUMMER25_PRIYA');
  });

  it('returns 404 for unknown Razorpay order', async () => {
    const { followerToken, cid, sid, oid, ci } = await setupPayAtStoreScenario();

    const res = await request(app)
      .post('/v1/follower/pay-at-store/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: 'order_nonexistent_xyz',
        razorpay_payment_id: 'pay_test_004',
        razorpay_signature: 'mock_sig',
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        bill_amount: 100000,
      });

    expect(res.status).toBe(404);
  });
});
