'use strict';

/**
 * meals-x1.test.js — INFLX Meals AI chat brain (X1), deterministic (AI_MOCK).
 * Contract: features/meals-ai/.
 *   - missing party size → one meaningful clarify question
 *   - full message → intent + engine-priced offers + AI recommendation
 *   - AI returns STRUCTURE; prices come from the engine
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const { createBrandUser, registerBrand, createFollowerUser } = require('./helpers/factories');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const futureDate = (d = 2) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

beforeEach(async () => { await truncateAll(); });

async function restaurantWithFamilyOffer() {
  const brand = await createBrandUser();
  await registerBrand(brand.token, { business_name: 'Spice Route', category: 'restaurant' });
  await request(app).put('/v1/meals/config').set(auth(brand.token)).send({ enabled: true, discount_clock: [] }).expect(200);
  const slot = (await request(app).post('/v1/meals/slots').set(auth(brand.token))
    .send({ label: 'Lunch', serve_time: '13:00', cutoff_minutes_before: 120, capacity: 40 }).expect(201)).body.data.slot;
  await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
    .send({ name: 'Family Mixed Pack', party_size: 'family', offer_kind: 'mixed',
      base_price: 1040, discount_type: 'flat', discount_value: 90, slot_id: slot.id, status: 'active' }).expect(201);
  const brandId = (await request(app).get('/v1/meals/config').set(auth(brand.token)).expect(200)).body.data.config.brand_id;
  return { brand, brandId };
}

describe('Meals X1 — AI chat brain (mock)', () => {
  test('missing party size → clarify question', async () => {
    const follower = await createFollowerUser();
    const res = await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'lunch tomorrow, biryani please' }).expect(200);
    expect(res.body.data.stage).toBe('clarify');
    expect(res.body.data.question).toMatch(/how many people/i);
  });

  test('full message → offers + AI recommendation; prices from engine', async () => {
    const { brandId } = await restaurantWithFamilyOffer();
    const follower = await createFollowerUser();
    const res = await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'family lunch tomorrow, 2 chicken and 2 veg biryani, medium spicy', brand_id: brandId, slot_date: futureDate(2),
              drop_location: { lat: 17.4239, lng: 78.4080, label: 'Home' } })
      .expect(200);

    expect(res.body.data.stage).toBe('offers');
    expect(res.body.data.intent.party_size).toBe('family');
    const offers = res.body.data.offers;
    expect(offers.length).toBeGreaterThan(0);
    expect(Number(offers[0].price)).toBe(950); // engine: 1040 − 90 flat, empty clock
    // AI recommends a real offer id (structure), never a price.
    expect(res.body.data.recommendation.recommended_offer_id).toBe(offers[0].id);
  });

  test('no match → simple no-match message (decision 2)', async () => {
    const { brandId } = await restaurantWithFamilyOffer();
    const follower = await createFollowerUser();
    const res = await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'office lunch for 12 people tomorrow, chicken biryani', brand_id: brandId, slot_date: futureDate(2),
              drop_location: { lat: 17.4239, lng: 78.4080, label: 'Home' } })
      .expect(200);
    expect(res.body.data.stage).toBe('no_match');
  });
});
