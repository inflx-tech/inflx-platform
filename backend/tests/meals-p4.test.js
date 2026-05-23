'use strict';

/**
 * meals-p4.test.js — customer journey the mobile screens drive (P4).
 * Contract: features/meals-customer-mobile/.
 *   - public store endpoint feeds the in-store Offers tab (C0)
 *   - chat → offers → pay-before-cutoff → track → deliver (C1–C5)
 * Backend logic is runtime-verified here; the RN screens + Maestro flow
 * are the UI layer over exactly these endpoints.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const { createBrandUser, registerBrand, createFollowerUser } = require('./helpers/factories');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const futureDate = (d = 2) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

beforeEach(async () => { await truncateAll(); });

async function restaurant() {
  const brand = await createBrandUser();
  await registerBrand(brand.token, { business_name: 'Spice Route Kitchen', category: 'restaurant' });
  await request(app).put('/v1/meals/config').set(auth(brand.token)).send({ enabled: true, discount_clock: [] }).expect(200);
  const slot = (await request(app).post('/v1/meals/slots').set(auth(brand.token))
    .send({ label: 'Lunch', serve_time: '13:00', cutoff_minutes_before: 120, capacity: 40 }).expect(201)).body.data.slot;
  await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
    .send({ name: 'Family Mixed Pack', party_size: 'family', offer_kind: 'mixed',
      items_json: [{ name: 'Chicken Biryani', qty: 2, price: 300 }, { name: 'Veg Biryani', qty: 2, price: 220 }],
      base_price: 1040, discount_type: 'flat', discount_value: 90, freebies_json: ['Raita x2'],
      slot_id: slot.id, status: 'active' }).expect(201);
  const brandId = (await request(app).get('/v1/meals/config').set(auth(brand.token)).expect(200)).body.data.config.brand_id;
  return { brand, brandId };
}

describe('Meals P4 — customer journey (backend the mobile drives)', () => {
  test('C0: public store endpoint lists active offers grouped by party size', async () => {
    const { brandId } = await restaurant();
    // No auth header → public browse must still work.
    const res = await request(app).get(`/v1/meals/store/${brandId}`).expect(200);
    const d = res.body.data;
    expect(d.brand.business_name).toBe('Spice Route Kitchen');
    expect(d.slots.length).toBe(1);
    expect(d.offers.length).toBe(1);
    expect(Number(d.offers[0].price)).toBe(950); // 1040 − 90 flat
    expect(d.offers_by_party.family.length).toBe(1);
  });

  test('C1–C5: chat → offers → pay-before-cutoff → track → deliver', async () => {
    const { brand, brandId } = await restaurant();
    const follower = await createFollowerUser();

    // C1+C2+C3: chat extracts intent and returns offers + recommendation.
    const chat = (await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'family lunch tomorrow, 2 chicken and 2 veg biryani, medium', brand_id: brandId, slot_date: futureDate(2),
              drop_location: { lat: 17.4239, lng: 78.4080, label: 'Home' } })
      .expect(200)).body.data;
    expect(chat.stage).toBe('offers');
    const offer = chat.offers[0];
    expect(Number(offer.price)).toBe(950);
    expect(chat.recommendation.recommended_offer_id).toBe(offer.id);

    // C4: pay-before-cutoff locks the order.
    const order = (await request(app).post('/v1/meals/orders').set(auth(follower.token))
      .send({ meal_offer_id: offer.id }).expect(201)).body.data.order;
    expect(order.status).toBe('paid');
    expect(Number(order.amount)).toBe(950);

    // C5: track + restaurant delivers.
    const track = (await request(app).get(`/v1/meals/orders/${order.id}`).set(auth(follower.token)).expect(200)).body.data.order;
    expect(track.id).toBe(order.id);
    const delivered = (await request(app).post(`/v1/meals/orders/${order.id}/deliver`).set(auth(brand.token)).expect(200)).body.data.order;
    expect(delivered.status).toBe('delivered');
  });
});
