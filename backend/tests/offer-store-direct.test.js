'use strict';

/**
 * QA — offer-engine store-direct purchase (Sub-contract D2).
 * A follower buys a brand-store-published offer with NO influencer:
 * no tracking IDs, ZERO commission, full brand margin. Verifies the new
 * /follower/store-offer pay+verify endpoints + the follower_transactions row.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createFollowerUser, registerBrand } = require('./helpers/factories');

beforeEach(async () => { await truncateAll(); });

async function approve(userId) { await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]); }

async function makeBrand() {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token, { business_name: 'Spice Garden', category: 'restaurant' });
  await approve(user.id);
  return { token, brandId: brand.id };
}

async function makeStoreOffer(token, { publish = true } = {}) {
  const res = await request(app).post('/v1/brands/me/offers').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Store 15% Off', offer_type: 'discount', offer_config_json: { sub_type: 'pct', value: 15, scope: 'store', products: [] }, availing_modes: ['pay_at_store'] });
  const id = res.body.data.offer.id;
  await request(app).patch(`/v1/brands/me/offers/${id}`).set('Authorization', `Bearer ${token}`)
    .send({ status: 'active', published_to_store: !!publish });
  return id;
}

async function makeFollower() {
  const { token } = await createFollowerUser();
  const reg = await request(app).post('/v1/followers/register').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Follower', city: 'Vijayawada', state: 'AP' });
  return { token, followerId: reg.body.data.follower.id };
}

const pay = (token, body) => request(app).post('/v1/follower/store-offer/pay').set('Authorization', `Bearer ${token}`).send(body);
const verify = (token, body) => request(app).post('/v1/follower/store-offer/verify').set('Authorization', `Bearer ${token}`).send(body);

describe('store-direct purchase', () => {
  it('buys a published store offer with discount, ZERO commission, no influencer', async () => {
    const { token: bTok, brandId } = await makeBrand();
    const offerId = await makeStoreOffer(bTok, { publish: true });
    const { token: fTok } = await makeFollower();

    const init = await pay(fTok, { brand_id: brandId, brand_offer_id: offerId, bill_amount: 1000 });
    expect(init.status).toBe(201);
    expect(init.body.data.discount_amount).toBe(150);          // 15% of 1000
    expect(init.body.data.amount_to_charge).toBe(850);
    expect(init.body.data.breakdown.influencer_commission).toBe(0);

    const ver = await verify(fTok, { razorpay_order_id: init.body.data.razorpay_order_id, razorpay_payment_id: 'pay_store_001' });
    expect(ver.status).toBe(200);
    expect(ver.body.data.transaction_id).toBeDefined();

    const { rows } = await query(
      `SELECT campaign_id, set_id, campaign_influencer_id, offer_id, brand_offer_id,
              offer_source, influencer_commission, net_amount, discount_amount, status
         FROM follower_transactions WHERE id = $1`,
      [ver.body.data.transaction_id]
    );
    const tx = rows[0];
    expect(tx.campaign_id).toBeNull();
    expect(tx.set_id).toBeNull();
    expect(tx.campaign_influencer_id).toBeNull();
    expect(tx.offer_id).toBeNull();
    expect(tx.brand_offer_id).toBe(offerId);
    expect(tx.offer_source).toBe('store');
    expect(parseFloat(tx.influencer_commission)).toBe(0);
    expect(parseFloat(tx.net_amount)).toBe(850);
    expect(parseFloat(tx.discount_amount)).toBe(150);
    expect(tx.status).toBe('completed');
  });

  it('rejects an unpublished offer → 409 OFFER_UNAVAILABLE', async () => {
    const { token: bTok, brandId } = await makeBrand();
    const offerId = await makeStoreOffer(bTok, { publish: false });
    const { token: fTok } = await makeFollower();
    const res = await pay(fTok, { brand_id: brandId, brand_offer_id: offerId, bill_amount: 1000 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OFFER_UNAVAILABLE');
  });

  it('rejects an offer from another brand → 409', async () => {
    const a = await makeBrand();
    const { token: bTokB } = await makeBrand();
    const foreignOffer = await makeStoreOffer(bTokB, { publish: true });
    const { token: fTok } = await makeFollower();
    const res = await pay(fTok, { brand_id: a.brandId, brand_offer_id: foreignOffer, bill_amount: 1000 });
    expect(res.status).toBe(409);
  });

  it('requires bill_amount and brand_offer_id', async () => {
    const { token: bTok, brandId } = await makeBrand();
    await makeStoreOffer(bTok, { publish: true });
    const { token: fTok } = await makeFollower();
    const res = await pay(fTok, { brand_id: brandId, bill_amount: 1000 });
    expect(res.status).toBe(422);
  });
});
