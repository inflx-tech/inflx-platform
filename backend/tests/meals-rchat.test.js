'use strict';

/**
 * meals-rchat.test.js — restaurant chat for offer creation (P-RCHAT), mock.
 * Contract: features/meals-rchat/.
 *   - empty menu → 422
 *   - "family pack with 2 chicken + 2 veg biryani, ₹90 off, free raita"
 *     → status='suggested' offer rule with items priced from brand_products,
 *     owner's discount preserved, free-add-on detected, AI never sets prices.
 *   - missing party_size → stage='clarify'.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand } = require('./helpers/factories');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeEach(async () => { await truncateAll(); });

async function brandWithMenu() {
  const brand = await createBrandUser();
  await registerBrand(brand.token, { business_name: 'Spice Route', category: 'restaurant' });
  const brandId = (await request(app).put('/v1/meals/config').set(auth(brand.token))
    .send({ enabled: true, discount_clock: [] }).expect(200)).body.data.config.brand_id;
  const menu = [
    { name: 'Chicken Biryani', price: 300, veg_flag: 'non_veg', section: 'Biryani' },
    { name: 'Veg Biryani',     price: 220, veg_flag: 'veg',     section: 'Biryani' },
    { name: 'Raita',           price: 40,  veg_flag: 'veg',     section: 'Sides' },
  ];
  for (const m of menu) {
    await query(
      `INSERT INTO brand_products (brand_id, name, price, veg_flag, section, is_active)
       VALUES ($1::uuid, $2::varchar, $3::numeric, $4::veg_flag, $5::varchar, true)`,
      [brandId, m.name, m.price, m.veg_flag, m.section]
    );
  }
  return { brand, brandId };
}

describe('Meals restaurant-chat — natural-language offer creation', () => {
  test('no menu → VALIDATION_ERROR', async () => {
    const brand = await createBrandUser();
    await registerBrand(brand.token, { business_name: 'Empty', category: 'restaurant' });
    await request(app).put('/v1/meals/config').set(auth(brand.token)).send({ enabled: true }).expect(200);
    const r = await request(app).post('/v1/meals/restaurant-chat').set(auth(brand.token))
      .send({ message: 'family pack' }).expect(422);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('missing party size → clarify', async () => {
    const { brand } = await brandWithMenu();
    const r = await request(app).post('/v1/meals/restaurant-chat').set(auth(brand.token))
      .send({ message: 'chicken biryani with free raita, 10% off' }).expect(200);
    expect(r.body.data.stage).toBe('clarify');
    expect(r.body.data.question).toMatch(/party size/i);
  });

  test('plain English → suggested offer with prices joined, owner discount preserved', async () => {
    const { brand } = await brandWithMenu();
    const r = await request(app).post('/v1/meals/restaurant-chat').set(auth(brand.token))
      .send({ message: 'family pack with 2 chicken biryani and 2 veg biryani, 90 off, free raita' }).expect(200);
    expect(r.body.data.stage).toBe('built');
    const rule = r.body.data.offer_rule;
    expect(rule.status).toBe('suggested');
    expect(rule.source).toBe('custom');
    expect(rule.party_size).toBe('family');
    // Items priced from brand_products — never invented.
    const items = rule.items_json || [];
    expect(items.length).toBe(2);
    for (const it of items) expect(Number(it.price)).toBeGreaterThan(0);
    // base = 2*300 + 2*220 = 1040 (joined from brand_products)
    expect(Number(rule.base_price)).toBe(1040);
    // owner-stated discount preserved
    expect(rule.discount_type).toBe('flat');
    expect(Number(rule.discount_value)).toBe(90);
    // freebie detected
    expect((rule.freebies_json || []).some((f) => /raita/i.test(f))).toBe(true);
    // mixed kind (has both discount + freebie)
    expect(rule.offer_kind).toBe('mixed');
  });

  test('rainy-day trigger + radius captured', async () => {
    const { brand } = await brandWithMenu();
    const r = await request(app).post('/v1/meals/restaurant-chat').set(auth(brand.token))
      .send({ message: 'duo combo for 2 with 1 chicken biryani and 1 veg biryani, ₹50 off, if raining, within 3 km' }).expect(200);
    expect(r.body.data.stage).toBe('built');
    const rule = r.body.data.offer_rule;
    expect(rule.party_size).toBe('duo');
    expect(rule.trigger_json.weather).toBe('rain');
    expect(rule.trigger_json.max_km).toBe(3);
    expect(rule.offer_kind).toBe('custom'); // trigger present → custom
  });
});
