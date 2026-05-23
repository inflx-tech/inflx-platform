'use strict';

/**
 * meals-p3.test.js — engine integration through the live endpoints (P3).
 * Contract: features/meals-engine/.
 *   - discount-clock decay changes the computed offer price
 *   - capacity reached → SLOT_FULL
 *   - cross-restaurant routing ranks nearer restaurant first
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand, createFollowerUser } = require('./helpers/factories');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const futureDate = (d = 2) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

beforeEach(async () => { await truncateAll(); });

async function makeRestaurant({ clock = [], radius = 5, capacity = 40, lat = null, lng = null } = {}) {
  const brand = await createBrandUser();
  await registerBrand(brand.token, { business_name: 'R', category: 'restaurant' });
  await request(app).put('/v1/meals/config').set(auth(brand.token))
    .send({ enabled: true, delivery_radius_km: radius, max_discount_pct: 25, discount_clock: clock }).expect(200);
  const slot = (await request(app).post('/v1/meals/slots').set(auth(brand.token))
    .send({ label: 'Lunch', serve_time: '13:00', cutoff_minutes_before: 120, capacity }).expect(201)).body.data.slot;
  const brandId = (await request(app).get('/v1/meals/config').set(auth(brand.token)).expect(200)).body.data.config.brand_id;
  if (lat != null) await query(`UPDATE brands SET lat = $1, lng = $2 WHERE id = $3`, [lat, lng, brandId]);
  return { brand, slot, brandId };
}

describe('Meals P3 — deterministic engine', () => {
  test('discount-clock decay reduces the computed price', async () => {
    // 1-day-before rung = 20%; rule adds 10% flat → 30%, capped at 25% → 750.
    const { brand, slot, brandId } = await makeRestaurant({ clock: [{ unit: 'day', n: 1, pct: 20 }] });
    await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
      .send({ name: 'Family Pack', party_size: 'family', offer_kind: 'mixed', base_price: 1000,
        discount_type: 'flat', discount_value: 100, slot_id: slot.id, status: 'active' }).expect(201);

    const follower = await createFollowerUser();
    const intent = (await request(app).post('/v1/meals/intents').set(auth(follower.token))
      .send({ brand_id: brandId, party_size: 'family', slot_label: 'Lunch', slot_date: futureDate(2) }).expect(201)).body.data.intent;
    const offers = (await request(app).post(`/v1/meals/intents/${intent.id}/offers`).set(auth(follower.token)).expect(200)).body.data.offers;
    expect(Number(offers[0].price)).toBe(750);
  });

  test('capacity reached → SLOT_FULL on the next order', async () => {
    const { brand, slot, brandId } = await makeRestaurant({ capacity: 1 });
    await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
      .send({ name: 'Solo', party_size: 'single', offer_kind: 'discount', base_price: 300, slot_id: slot.id, status: 'active' }).expect(201);

    async function order(follower) {
      const intent = (await request(app).post('/v1/meals/intents').set(auth(follower.token))
        .send({ brand_id: brandId, party_size: 'single', slot_label: 'Lunch', slot_date: futureDate(2) }).expect(201)).body.data.intent;
      const offers = (await request(app).post(`/v1/meals/intents/${intent.id}/offers`).set(auth(follower.token)).expect(200)).body.data.offers;
      return request(app).post('/v1/meals/orders').set(auth(follower.token)).send({ meal_offer_id: offers[0].id });
    }

    const f1 = await createFollowerUser();
    const f2 = await createFollowerUser();
    await order(f1).then((r) => expect(r.status).toBe(201));
    const second = await order(f2);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('SLOT_FULL');
  });

  test('cross-restaurant routing ranks the nearer restaurant first', async () => {
    // Two restaurants, equal price; drop location sits on A → A nearer.
    const near = await makeRestaurant({ lat: 17.4239, lng: 78.4080 });
    const far = await makeRestaurant({ lat: 17.4350, lng: 78.4200 });
    for (const r of [near, far]) {
      await request(app).post('/v1/meals/offer-rules').set(auth(r.brand.token))
        .send({ name: 'Trio', party_size: 'trio', offer_kind: 'mixed', base_price: 700, slot_id: r.slot.id, status: 'active' }).expect(201);
    }

    const follower = await createFollowerUser();
    // brand_id omitted → cross-restaurant routing by drop location.
    const intent = (await request(app).post('/v1/meals/intents').set(auth(follower.token))
      .send({ party_size: 'trio', slot_label: 'Lunch', slot_date: futureDate(2),
        drop_location: { lat: 17.4239, lng: 78.4080, label: 'Home' } }).expect(201)).body.data.intent;
    const offers = (await request(app).post(`/v1/meals/intents/${intent.id}/offers`).set(auth(follower.token)).expect(200)).body.data.offers;
    expect(offers.length).toBe(2);
    expect(offers[0].brand_id).toBe(near.brandId);
  });
});
