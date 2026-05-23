'use strict';

/**
 * meals-p2.test.js — INFLX Meals restaurant management + dashboard (P2).
 * Contract: features/meals-restaurant-web/.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const { createBrandUser, registerBrand, createFollowerUser } = require('./helpers/factories');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const futureDate = (d = 2) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

beforeEach(async () => { await truncateAll(); });

async function brandWithSlot() {
  const brand = await createBrandUser();
  await registerBrand(brand.token, { business_name: 'Spice Route', category: 'restaurant' });
  await request(app).put('/v1/meals/config').set(auth(brand.token)).send({ enabled: true }).expect(200);
  const slot = (await request(app).post('/v1/meals/slots').set(auth(brand.token))
    .send({ label: 'Lunch', serve_time: '13:00', cutoff_minutes_before: 120, capacity: 40 }).expect(201))
    .body.data.slot;
  return { brand, slot };
}

describe('Meals P2 — restaurant management + dashboard', () => {
  test('config + slots reads', async () => {
    const { brand } = await brandWithSlot();
    const cfg = await request(app).get('/v1/meals/config').set(auth(brand.token)).expect(200);
    expect(cfg.body.data.config.enabled).toBe(true);
    const slots = await request(app).get('/v1/meals/slots').set(auth(brand.token)).expect(200);
    expect(slots.body.data.slots.length).toBe(1);
  });

  test('offer-rule list + accept/reject lifecycle', async () => {
    const { brand, slot } = await brandWithSlot();
    const rule = (await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
      .send({ name: 'Family Pack', party_size: 'family', offer_kind: 'mixed', base_price: 1000,
        discount_type: 'flat', discount_value: 100, slot_id: slot.id, status: 'suggested' }).expect(201))
      .body.data.offer_rule;
    expect(rule.status).toBe('suggested');

    // list filtered by party_size
    const list = await request(app).get('/v1/meals/offer-rules?party_size=family').set(auth(brand.token)).expect(200);
    expect(list.body.data.offer_rules.length).toBe(1);

    // accept → active + accepted_at set
    const accepted = (await request(app).patch(`/v1/meals/offer-rules/${rule.id}`).set(auth(brand.token))
      .send({ status: 'active' }).expect(200)).body.data.offer_rule;
    expect(accepted.status).toBe('active');
    expect(accepted.accepted_at).toBeTruthy();

    // reject with reason
    const rejected = (await request(app).patch(`/v1/meals/offer-rules/${rule.id}`).set(auth(brand.token))
      .send({ status: 'rejected', rejected_reason: 'too thin' }).expect(200)).body.data.offer_rule;
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejected_reason).toBe('too thin');
  });

  test('dashboard reflects a paid order: stats, prep, order-book', async () => {
    const { brand, slot } = await brandWithSlot();
    await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
      .send({ name: 'Family Pack', party_size: 'family', offer_kind: 'mixed',
        items_json: [{ name: 'Chicken Biryani', qty: 2, price: 300 }, { name: 'Veg Biryani', qty: 2, price: 220 }],
        base_price: 1040, discount_type: 'flat', discount_value: 90, slot_id: slot.id, status: 'active' }).expect(201);

    // A customer orders.
    const follower = await createFollowerUser();
    const brandId = (await request(app).get('/v1/meals/config').set(auth(brand.token)).expect(200)).body.data.config.brand_id;
    const intent = (await request(app).post('/v1/meals/intents').set(auth(follower.token))
      .send({ brand_id: brandId, party_size: 'family', slot_label: 'Lunch', slot_date: futureDate(2) }).expect(201)).body.data.intent;
    const offers = (await request(app).post(`/v1/meals/intents/${intent.id}/offers`).set(auth(follower.token)).expect(200)).body.data.offers;
    await request(app).post('/v1/meals/orders').set(auth(follower.token)).send({ meal_offer_id: offers[0].id }).expect(201);

    const dash = (await request(app).get(`/v1/meals/dashboard?slot_date=${futureDate(2)}`).set(auth(brand.token)).expect(200)).body.data;
    expect(dash.stats.confirmed).toBe(1);
    expect(Number(dash.stats.revenue)).toBe(950);
    expect(dash.stats.meals).toBe(4); // 2 chicken + 2 veg
    expect(dash.orders.length).toBe(1);
    const chicken = dash.prep_summary.find((p) => p.name === 'Chicken Biryani');
    expect(chicken.qty).toBe(2);
  });
});
