'use strict';

/**
 * meals-p1.test.js — INFLX Meals P1 thin vertical slice (E2E).
 * Contract: features/meals-p1-vertical-slice/.
 *
 * Walks the whole chain for one restaurant:
 *   brand: enable config → create slot → create offer rules
 *   follower: intent → compute offers → lock+pay → track
 *   brand: mark delivered
 * Plus: no-match path, cutoff-passed rejection, role gates.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const { createBrandUser, registerBrand, createFollowerUser } = require('./helpers/factories');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// A slot_date far enough ahead that the cutoff is always in the future.
function futureDate(days = 2) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

async function setupRestaurant() {
  const brand = await createBrandUser();
  await registerBrand(brand.token, { business_name: 'Spice Route Kitchen', category: 'restaurant' });

  // P1 isolates BASE pricing (no discount clock) — the clock's time-decay
  // is exercised in P3's engine tests.
  await request(app).put('/v1/meals/config').set(auth(brand.token))
    .send({ enabled: true, delivery_radius_km: 5, discount_clock: [] })
    .expect(200);

  const slotRes = await request(app).post('/v1/meals/slots').set(auth(brand.token))
    .send({ label: 'Lunch', serve_time: '13:00', cutoff_minutes_before: 120, capacity: 40 })
    .expect(201);
  const slotId = slotRes.body.data.slot.id;

  // Two family offers at different prices → deterministic cheapest-first.
  await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
    .send({
      name: 'Family Mixed Pack', party_size: 'family', offer_kind: 'mixed',
      items_json: [{ name: 'Chicken Biryani', qty: 2, price: 300 }, { name: 'Veg Biryani', qty: 2, price: 220 }],
      base_price: 1040, discount_type: 'flat', discount_value: 90,
      freebies_json: ['Raita x2'], slot_id: slotId, status: 'active',
    }).expect(201);

  await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
    .send({
      name: 'Veg Family Feast', party_size: 'family', offer_kind: 'free_addon',
      items_json: [{ name: 'Veg Biryani', qty: 4, price: 220 }],
      base_price: 880, freebies_json: ['Gulab Jamun x4'], slot_id: slotId, status: 'active',
    }).expect(201);

  return { brand, slotId };
}

beforeEach(async () => { await truncateAll(); });

describe('Meals P1 — vertical slice', () => {
  test('happy path: setup → intent → offers → pay → track → deliver', async () => {
    const { brand } = await setupRestaurant();
    const follower = await createFollowerUser();

    // Resolve brand_id from its public store-less path: re-register returns id.
    // The brand row id is what offer rules carry; fetch it via a fresh intent.
    const brandRow = await request(app).put('/v1/meals/config').set(auth(brand.token)).send({}).expect(200);
    const brandId = brandRow.body.data.config.brand_id;

    // Customer states an intent for a family lunch tomorrow.
    const intentRes = await request(app).post('/v1/meals/intents').set(auth(follower.token))
      .send({
        brand_id: brandId, party_size: 'family', veg_count: 2, nonveg_count: 2,
        items_json: [{ name: 'Chicken Biryani', qty: 2 }, { name: 'Veg Biryani', qty: 2 }],
        spice_level: 'medium', slot_label: 'Lunch', slot_date: futureDate(2),
        drop_location: { label: 'Home', address: 'Jubilee Hills' },
      }).expect(201);
    const intentId = intentRes.body.data.intent.id;
    expect(intentRes.body.data.intent.status).toBe('open');

    // Compute the deterministic shortlist.
    const offersRes = await request(app).post(`/v1/meals/intents/${intentId}/offers`).set(auth(follower.token)).expect(200);
    expect(offersRes.body.data.intent_status).toBe('offered');
    const offers = offersRes.body.data.offers;
    expect(offers.length).toBe(2);
    // Cheapest first: Veg Family Feast (880) before Family Mixed Pack (1040-90=950).
    // pg returns numeric columns as strings — compare numerically.
    expect(Number(offers[0].price)).toBe(880);
    expect(Number(offers[1].price)).toBe(950);
    expect(offers[0].rank).toBe(1);
    expect(offers[0].ai_recommended).toBe(true);
    expect(offers[1].ai_recommended).toBe(false);

    // Lock + pay the recommended (cheapest) offer.
    const orderRes = await request(app).post('/v1/meals/orders').set(auth(follower.token))
      .send({ meal_offer_id: offers[0].id }).expect(201);
    const order = orderRes.body.data.order;
    expect(order.status).toBe('paid');
    expect(Number(order.amount)).toBe(880);
    expect(order.paid_at).toBeTruthy();
    expect(order.cutoff_at).toBeTruthy();

    // Track it.
    const trackRes = await request(app).get(`/v1/meals/orders/${order.id}`).set(auth(follower.token)).expect(200);
    expect(trackRes.body.data.order.id).toBe(order.id);

    // Restaurant marks it delivered.
    const delRes = await request(app).post(`/v1/meals/orders/${order.id}/deliver`).set(auth(brand.token)).expect(200);
    expect(delRes.body.data.order.status).toBe('delivered');
  });

  test('no match → empty shortlist, intent status no_match', async () => {
    const { brand } = await setupRestaurant();
    const follower = await createFollowerUser();
    const brandId = (await request(app).put('/v1/meals/config').set(auth(brand.token)).send({}).expect(200))
      .body.data.config.brand_id;

    // Office party size has no active rules → no match.
    const intentRes = await request(app).post('/v1/meals/intents').set(auth(follower.token))
      .send({ brand_id: brandId, party_size: 'office', slot_label: 'Lunch', slot_date: futureDate(2) }).expect(201);
    const offersRes = await request(app)
      .post(`/v1/meals/intents/${intentRes.body.data.intent.id}/offers`).set(auth(follower.token)).expect(200);
    expect(offersRes.body.data.intent_status).toBe('no_match');
    expect(offersRes.body.data.offers).toEqual([]);
  });

  test('pay after cutoff is rejected', async () => {
    const { brand } = await setupRestaurant();
    const follower = await createFollowerUser();
    const brandId = (await request(app).put('/v1/meals/config').set(auth(brand.token)).send({}).expect(200))
      .body.data.config.brand_id;

    // slot_date in the past → cutoff already passed.
    const past = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const intentRes = await request(app).post('/v1/meals/intents').set(auth(follower.token))
      .send({ brand_id: brandId, party_size: 'family', slot_label: 'Lunch', slot_date: past }).expect(201);
    const offersRes = await request(app)
      .post(`/v1/meals/intents/${intentRes.body.data.intent.id}/offers`).set(auth(follower.token)).expect(200);
    const offerId = offersRes.body.data.offers[0].id;

    const res = await request(app).post('/v1/meals/orders').set(auth(follower.token))
      .send({ meal_offer_id: offerId }).expect(409);
    expect(res.body.error.code).toBe('OFFER_EXPIRED');
  });

  test('role gates: follower cannot create offer rules; brand cannot create intents', async () => {
    const { brand } = await setupRestaurant();
    const follower = await createFollowerUser();

    await request(app).post('/v1/meals/offer-rules').set(auth(follower.token))
      .send({ name: 'x', party_size: 'single', offer_kind: 'discount' }).expect(403);

    await request(app).post('/v1/meals/intents').set(auth(brand.token))
      .send({ party_size: 'single' }).expect(403);
  });
});
