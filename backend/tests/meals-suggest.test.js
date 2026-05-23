'use strict';

/**
 * meals-suggest.test.js — AI-driven offer suggestions (P-AI-INTEL), mock.
 * Contract: features/meals-ai-suggest/.
 *   - empty menu → 422 (the AI needs real dishes to reference)
 *   - menu present → suggestions inserted as status='suggested', source='ai'
 *   - prices are JOINED from brand_products (AI never sets a price)
 *   - covers multiple party_sizes
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
  // Seed menu directly so we don't depend on a brand-products endpoint.
  const menu = [
    { name: 'Chicken Biryani', price: 300, veg_flag: 'non_veg', section: 'Biryani' },
    { name: 'Veg Biryani',     price: 220, veg_flag: 'veg',     section: 'Biryani' },
    { name: 'Raita',           price: 40,  veg_flag: 'veg',     section: 'Sides' },
    { name: 'Gulab Jamun',     price: 60,  veg_flag: 'veg',     section: 'Dessert' },
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

describe('Meals AI auto-suggest offers', () => {
  test('no menu → VALIDATION_ERROR (AI needs dishes to reference)', async () => {
    const brand = await createBrandUser();
    await registerBrand(brand.token, { business_name: 'Empty', category: 'restaurant' });
    await request(app).put('/v1/meals/config').set(auth(brand.token)).send({ enabled: true }).expect(200);
    const res = await request(app).post('/v1/meals/offer-rules/suggest').set(auth(brand.token)).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('menu present → inserts suggestions with status=suggested, source=ai, prices joined', async () => {
    const { brand, brandId } = await brandWithMenu();
    const res = await request(app).post('/v1/meals/offer-rules/suggest').set(auth(brand.token)).expect(200);
    expect(res.body.data.ai_mode).toBe('mock');
    const sug = res.body.data.suggested;
    expect(sug.length).toBeGreaterThan(0);

    for (const r of sug) {
      expect(r.status).toBe('suggested');
      expect(r.source).toBe('ai');
      // Every item must have a price joined from brand_products (no nulls,
      // no zeros, no AI-invented numbers).
      const items = r.items_json || [];
      expect(items.length).toBeGreaterThan(0);
      for (const it of items) {
        expect(Number(it.price)).toBeGreaterThan(0);
      }
      // base_price equals the sum of joined item prices × qty.
      const expectedBase = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
      expect(Number(r.base_price)).toBe(expectedBase);
    }

    // Visible via the regular list as status=suggested.
    const list = await request(app).get('/v1/meals/offer-rules?status=suggested').set(auth(brand.token)).expect(200);
    expect(list.body.data.offer_rules.length).toBe(sug.length);

    // Owner can Accept one → flips to active.
    const target = sug[0];
    const accepted = (await request(app).patch(`/v1/meals/offer-rules/${target.id}`).set(auth(brand.token))
      .send({ status: 'active' }).expect(200)).body.data.offer_rule;
    expect(accepted.status).toBe('active');
    expect(accepted.accepted_at).toBeTruthy();
  });

  test('covers multiple party sizes (single + duo + trio + family + office expected)', async () => {
    const { brand } = await brandWithMenu();
    const res = await request(app).post('/v1/meals/offer-rules/suggest').set(auth(brand.token)).expect(200);
    const parties = new Set(res.body.data.suggested.map((r) => r.party_size));
    expect(parties.has('family')).toBe(true);
    // The mock emits up to 5 party-sizes; at least 3 distinct should land.
    expect(parties.size).toBeGreaterThanOrEqual(3);
  });
});
