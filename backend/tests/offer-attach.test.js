'use strict';

/**
 * QA — offer-engine-campaign-attach (Sub-contract C, backend).
 * Asserts features/offer-engine-campaign-attach/02-workflow.md against a real DB:
 * attaching a library offer (brand_offers) to an influencer via invite /
 * updateInfluencer, server-side snapshot, goal-derived allocation, the relaxed
 * engagement rule, and zero regression to the existing inline invite paths.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
  // Precondition: a subscription tier must exist for a brand to create campaigns
  // (quotaCheck). This local test DB doesn't seed subscription_tiers (prod does),
  // so provision an unlimited enterprise tier — the factory's registerBrand
  // auto-attaches it. Fixture alignment, not assertion weakening.
  await query(
    `INSERT INTO subscription_tiers (tier_key, name, monthly_price_inr, is_enterprise, active)
     SELECT 'enterprise', 'Enterprise', 0, true, true
      WHERE NOT EXISTS (SELECT 1 FROM subscription_tiers WHERE tier_key = 'enterprise')`
  );
});

async function approve(userId) { await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]); }

let infSeq = 0;
async function makeInfluencer() {
  infSeq += 1;
  const { token, user } = await createInfluencerUser();
  const inf = await registerInfluencer(token, { instagram_handle: `attach_inf_${infSeq}_${Date.now()}` });
  await approve(user.id);
  return inf.id;
}

async function createOffer(token, { activate = true } = {}) {
  const res = await request(app)
    .post('/v1/brands/me/offers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Lib 20% Off', offer_type: 'discount', offer_config_json: { sub_type: 'pct', value: 20, scope: 'store', products: [] } });
  expect(res.status).toBe(201);
  const id = res.body.data.offer.id;
  if (activate) {
    await request(app).patch(`/v1/brands/me/offers/${id}`).set('Authorization', `Bearer ${token}`).send({ status: 'active' });
  }
  return id;
}

async function setup() {
  const { token, user } = await createBrandUser();
  await registerBrand(token);
  await approve(user.id);
  const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [user.id]);

  const camp = await request(app).post('/v1/campaigns').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Attach Campaign', total_budget: 50000, start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = camp.body.data.campaign.id;

  const convSet = await request(app).post(`/v1/campaigns/${cid}/sets`).set('Authorization', `Bearer ${token}`)
    .send({ name: 'Conv Set', goal: 'conversion', assignment_mode: 'handpick', coupon_prefix: 'SAVE' });
  const engSet = await request(app).post(`/v1/campaigns/${cid}/sets`).set('Authorization', `Bearer ${token}`)
    .send({ name: 'Eng Set', goal: 'engagement', assignment_mode: 'handpick', set_budget: 20000 });

  const offerId = await createOffer(token);
  return { token, brandId: brand.id, cid, convSid: convSet.body.data.set.id, engSid: engSet.body.data.set.id, offerId };
}

const invite = (token, cid, sid, body) =>
  request(app).post(`/v1/campaigns/${cid}/sets/${sid}/invite`).set('Authorization', `Bearer ${token}`).send(body);

describe('attach library offer (conversion)', () => {
  it('1: conversion + brand_offer_id → 201, commissioned, config snapshotted from library', async () => {
    const { token, cid, convSid, offerId } = await setup();
    const res = await invite(token, cid, convSid, { influencer_id: await makeInfluencer(), brand_offer_id: offerId });
    expect(res.status).toBe(201);
    const ci = res.body.data.campaign_influencer;
    expect(ci.brand_offer_id).toBe(offerId);
    expect(ci.allocation).toBe('commissioned');
    expect(ci.offer_type).toBe('discount');               // snapshot, library vocab
    expect(ci.offer_config_json.value).toBe(20);          // snapshot config
  });
});

describe('attach library offer (engagement) — relaxed rule', () => {
  it('2: engagement + brand_offer_id → 201, promotional, no coupon/commission', async () => {
    const { token, cid, engSid, offerId } = await setup();
    const res = await invite(token, cid, engSid, { influencer_id: await makeInfluencer(), brand_offer_id: offerId });
    expect(res.status).toBe(201);
    const ci = res.body.data.campaign_influencer;
    expect(ci.allocation).toBe('promotional');
    expect(ci.offer_type).toBe('discount');
    expect(ci.coupon_code).toBeNull();
    expect(ci.commission_pct).toBeNull();
  });

  it('3: engagement + brand_offer_id + commission_pct → 422', async () => {
    const { token, cid, engSid, offerId } = await setup();
    const res = await invite(token, cid, engSid, { influencer_id: await makeInfluencer(), brand_offer_id: offerId, commission_pct: 10 });
    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('commission_pct');
  });
});

describe('ownership / lifecycle guards', () => {
  it('4: brand_offer_id from another brand → 404', async () => {
    const a = await setup();
    const { token: tokenB, user: userB } = await createBrandUser();
    await registerBrand(tokenB); await approve(userB.id);
    const foreignOffer = await createOffer(tokenB);
    const res = await invite(a.token, a.cid, a.convSid, { influencer_id: await makeInfluencer(), brand_offer_id: foreignOffer });
    expect(res.status).toBe(404);
  });

  it('5: archived brand_offer_id → 422', async () => {
    const { token, cid, convSid, offerId } = await setup();
    await request(app).delete(`/v1/brands/me/offers/${offerId}`).set('Authorization', `Bearer ${token}`); // soft-archive
    const res = await invite(token, cid, convSid, { influencer_id: await makeInfluencer(), brand_offer_id: offerId });
    expect(res.status).toBe(422);
  });
});

describe('regression — inline paths unchanged', () => {
  it('6: inline conversion offer (no brand_offer_id) → 201, commissioned, client config preserved', async () => {
    const { token, cid, convSid } = await setup();
    const res = await invite(token, cid, convSid, {
      influencer_id: await makeInfluencer(),
      offer_type: 'Discount',
      offer_config_json: { sub_type: 'pct', value: 35, scope: 'store', products: [] },
    });
    expect(res.status).toBe(201);
    const ci = res.body.data.campaign_influencer;
    expect(ci.brand_offer_id).toBeNull();
    expect(ci.allocation).toBe('commissioned');
    expect(ci.offer_type).toBe('Discount');     // client value preserved
    expect(ci.offer_config_json.value).toBe(35);
  });

  it('7: engagement with no offer → 201, no offer, allocation null', async () => {
    const { token, cid, engSid } = await setup();
    const res = await invite(token, cid, engSid, { influencer_id: await makeInfluencer() });
    expect(res.status).toBe(201);
    const ci = res.body.data.campaign_influencer;
    expect(ci.brand_offer_id).toBeNull();
    expect(ci.allocation).toBeNull();
    expect(ci.offer_type).toBeNull();
  });

  it('conversion with no offer → 422 (unchanged)', async () => {
    const { token, cid, convSid } = await setup();
    const res = await invite(token, cid, convSid, { influencer_id: await makeInfluencer() });
    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('offer_type');
  });
});

describe('updateInfluencer attach', () => {
  it('8: PATCH a draft CI with brand_offer_id → snapshot + allocation', async () => {
    const { token, cid, engSid, offerId } = await setup();
    const inv = await invite(token, cid, engSid, { influencer_id: await makeInfluencer() });
    const ciId = inv.body.data.campaign_influencer.id;
    const res = await request(app)
      .patch(`/v1/campaigns/${cid}/sets/${engSid}/influencers/${ciId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ brand_offer_id: offerId });
    expect(res.status).toBe(200);
    const ci = res.body.data.campaign_influencer;
    expect(ci.brand_offer_id).toBe(offerId);
    expect(ci.allocation).toBe('promotional');
    expect(ci.offer_type).toBe('discount');
    expect(ci.offer_config_json.value).toBe(20);
  });
});
