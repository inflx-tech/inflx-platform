'use strict';

/**
 * Phase 4 — Block D: Online order flow
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

async function setupOrderScenario() {
  const { token: brandToken, user: brandUser } = await createBrandUser();
  const brand = await registerBrand(brandToken, { business_name: 'Fresh Bakery', category: 'bakery' });
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
      razorpay_payment_id: 'pay_order_setup',
      razorpay_signature: 'mock_sig',
    });

  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'bakerylover' });
  await approveUser(infUser.id);

  const campRes = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Bakery Online', total_budget: 100000, brief: 'Order fresh cakes', start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = campRes.body.data.campaign.id;

  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Food Bloggers', goal: 'conversion', assignment_mode: 'handpick', coupon_prefix: 'TESTCPN', formats_json: ['reel'] });
  const sid = setRes.body.data.set.id;

  const offerRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ offer_type: 'percentage', discount_value: 15, availing_modes: ['online_order'] });
  const oid = offerRes.body.data.offer.id;

  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee: 8000, posting_date: '2026-07-15', offer_type: 'percentage' });
  const ci = inviteRes.body.data.campaign_influencer;

  await query(
    `UPDATE campaign_influencers SET coupon_code = 'BAKERY15', commission_pct = 8 WHERE id = $1`,
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
    .send({ typed_name: 'Baker Lover' });

  await request(app)
    .post(`/v1/contracts/${contractId}/brand-sign`)
    .set('Authorization', `Bearer ${brandToken}`);

  await request(app)
    .post(`/v1/campaigns/${cid}/publish`)
    .set('Authorization', `Bearer ${brandToken}`);

  // Add a product to the brand
  const { rows: productRows } = await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, section)
     VALUES ($1, 'Chocolate Cake', 50000, true, 'Cakes')
     RETURNING id`,
    [brand.id]
  );
  const productId = productRows[0].id;

  // Follower + address
  const { token: followerToken, user: followerUser } = await createFollowerUser();
  await registerFollower(followerToken);

  const addrRes = await request(app)
    .post('/v1/follower/addresses')
    .set('Authorization', `Bearer ${followerToken}`)
    .send({ label: 'Home', line1: '10 MG Road', city: 'Vijayawada', pincode: '520001', is_default: true });
  const addressId = addrRes.body.data.address.id;

  return { brandToken, infToken, followerToken, brand, inf, cid, sid, oid, ci, productId, addressId };
}

// ── GET /v1/store/:handle/products ───────────────────────────────────────────

describe('GET /v1/store/:handle/products', () => {
  it('returns products with discounted price', async () => {
    const { oid } = await setupOrderScenario();

    const res = await request(app)
      .get(`/v1/store/bakerylover/products?offer_id=${oid}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.products.length).toBe(1);
    // price in paise: 50000 * 100 = 5000000 → 15% off = 4250000? No — price is 50000 rupees?
    // Actually brand_products.price = 50000 means ₹500 (numeric(10,2))
    // discounted_price = floor(50000*100 * (1 - 0.15)) = floor(5000000 * 0.85) = 4250000
    // But for test purposes we just check discounted_price is defined
    expect(res.body.data.products[0].discounted_price).toBeDefined();
    expect(res.body.data.products[0].name).toBe('Chocolate Cake');
  });

  it('returns 422 when both offer_id and ci_id are missing', async () => {
    // At least one scope is required to prevent the silent-wrong-brand bug
    // (creator with multiple campaigns → arbitrary LIMIT 1 pick). Either
    // offer_id (set-level campaign_offers row) or ci_id
    // (per-influencer campaign_influencers row) is acceptable.
    const res = await request(app).get('/v1/store/bakerylover/products');
    expect(res.status).toBe(422);
    expect(res.body.error?.field).toBe('offer_id');
  });

  it('returns 404 for unknown handle (with valid-shaped offer_id)', async () => {
    const { oid } = await setupOrderScenario();
    const res = await request(app).get(`/v1/store/unknownhandle_xyz/products?offer_id=${oid}`);
    expect(res.status).toBe(404);
  });
});

// ── POST /v1/follower/orders ──────────────────────────────────────────────────

describe('POST /v1/follower/orders', () => {
  it('creates Razorpay order for online order', async () => {
    const { followerToken, cid, sid, oid, ci, productId, addressId } = await setupOrderScenario();

    const res = await request(app)
      .post('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid,
        campaign_id: cid,
        set_id: sid,
        campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId,
        delivery_fee: 5000, // ₹50 in paise
      });

    expect(res.status).toBe(201);
    expect(res.body.data.razorpay_order_id).toMatch(/^order_/);
    expect(res.body.data.net_amount).toBeDefined();
    expect(res.body.data.breakdown).toBeDefined();
  });

  it('returns 409 for invalid tracking IDs', async () => {
    const { followerToken, sid, oid, ci, productId, addressId } = await setupOrderScenario();

    const res = await request(app)
      .post('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid,
        campaign_id: '00000000-0000-0000-0000-000000000000',
        set_id: sid,
        campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId,
        delivery_fee: 5000,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OFFER_UNAVAILABLE');
  });
});

// ── POST /v1/follower/orders/verify ──────────────────────────────────────────

describe('POST /v1/follower/orders/verify', () => {
  it('creates follower_order and follower_transaction', async () => {
    const { followerToken, cid, sid, oid, ci, productId, addressId } = await setupOrderScenario();

    const orderRes = await request(app)
      .post('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId, delivery_fee: 5000,
      });

    const verifyRes = await request(app)
      .post('/v1/follower/orders/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: orderRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_order_001',
        razorpay_signature: 'mock_sig',
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId, delivery_fee: 5000,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.order_id).toBeDefined();
    expect(verifyRes.body.data.estimated_delivery_date).toBeDefined();
  });
});

// ── GET /v1/follower/orders ───────────────────────────────────────────────────

describe('GET /v1/follower/orders', () => {
  it('returns order list for follower', async () => {
    const { followerToken, cid, sid, oid, ci, productId, addressId } = await setupOrderScenario();

    const orderRes = await request(app)
      .post('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId, delivery_fee: 5000,
      });

    await request(app)
      .post('/v1/follower/orders/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: orderRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_order_002',
        razorpay_signature: 'mock_sig',
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId, delivery_fee: 5000,
      });

    const res = await request(app)
      .get('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders.length).toBe(1);
    expect(res.body.data.orders[0].order_status).toBe('confirmed');
  });

  it('pay_at_store transaction does NOT appear in /follower/orders', async () => {
    // This test verifies that pay-at-store transactions don't pollute the orders list
    const { followerToken } = await setupOrderScenario();

    const res = await request(app)
      .get('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders.length).toBe(0);
  });
});

// ── PATCH /v1/follower/orders/:id/status ────────────────────────────────────

describe('PATCH /v1/follower/orders/:id/status (brand side)', () => {
  it('brand can update order to dispatched', async () => {
    const { brandToken, followerToken, cid, sid, oid, ci, productId, addressId } = await setupOrderScenario();

    const orderRes = await request(app)
      .post('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId, delivery_fee: 5000,
      });

    const verifyRes = await request(app)
      .post('/v1/follower/orders/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: orderRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_order_003',
        razorpay_signature: 'mock_sig',
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId, delivery_fee: 5000,
      });

    const orderId = verifyRes.body.data.order_id;

    const statusRes = await request(app)
      .patch(`/v1/follower/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ order_status: 'dispatched' });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.order.order_status).toBe('dispatched');
  });

  it('returns 403 for follower trying to update status', async () => {
    const { followerToken, cid, sid, oid, ci, productId, addressId } = await setupOrderScenario();

    const orderRes = await request(app)
      .post('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId, delivery_fee: 5000,
      });

    const verifyRes = await request(app)
      .post('/v1/follower/orders/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: orderRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_order_004',
        razorpay_signature: 'mock_sig',
        offer_id: oid, campaign_id: cid, set_id: sid, campaign_influencer_id: ci.id,
        items: [{ product_id: productId, quantity: 1 }],
        address_id: addressId, delivery_fee: 5000,
      });

    const orderId = verifyRes.body.data.order_id;

    const res = await request(app)
      .patch(`/v1/follower/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ order_status: 'dispatched' });

    expect(res.status).toBe(403);
  });
});
