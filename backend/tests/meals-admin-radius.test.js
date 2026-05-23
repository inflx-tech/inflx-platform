'use strict';

/**
 * meals-admin-radius.test.js — admin platform radius + ADDRESS-FIRST chat.
 * Contract: features/meals-admin-radius/.
 *   - admin GET/PUT settings (radius_km + tolerance + lead minutes)
 *   - chat without drop_location → stage='address_required' + saved addresses
 *   - chat WITH drop_location inside radius → offers
 *   - chat WITH drop_location outside the brand's range (in-store) → out_of_range
 *   - cross-restaurant routing honours the PLATFORM radius (not per-brand)
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand, createFollowerUser, createAdminUser } = require('./helpers/factories');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const futureDate = (d = 2) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

beforeEach(async () => { await truncateAll(); });

async function restaurantAt({ lat, lng, name = 'R' }) {
  const brand = await createBrandUser();
  await registerBrand(brand.token, { business_name: name, category: 'restaurant' });
  const brandId = (await request(app).put('/v1/meals/config').set(auth(brand.token))
    .send({ enabled: true, discount_clock: [] }).expect(200)).body.data.config.brand_id;
  await query(`UPDATE brands SET lat=$1, lng=$2 WHERE id=$3`, [lat, lng, brandId]);
  const slot = (await request(app).post('/v1/meals/slots').set(auth(brand.token))
    .send({ label: 'Lunch', serve_time: '13:00', cutoff_minutes_before: 120, capacity: 40 }).expect(201)).body.data.slot;
  await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
    .send({ name: 'Family Pack', party_size: 'family', offer_kind: 'mixed',
      base_price: 1000, discount_type: 'flat', discount_value: 100, slot_id: slot.id, status: 'active' }).expect(201);
  return { brand, brandId };
}

describe('Meals admin radius + address-first', () => {
  test('admin GET/PUT settings round-trip', async () => {
    const admin = await createAdminUser();
    const def = (await request(app).get('/v1/admin/meals/settings').set(auth(admin.token)).expect(200)).body.data.settings;
    expect(Number(def.radius_km)).toBe(5);
    expect(def.radius_tolerance_m).toBe(500);
    const updated = (await request(app).put('/v1/admin/meals/settings').set(auth(admin.token))
      .send({ radius_km: 8, radius_tolerance_m: 200 }).expect(200)).body.data.settings;
    expect(Number(updated.radius_km)).toBe(8);
    expect(updated.radius_tolerance_m).toBe(200);
  });

  test('chat without drop_location → stage=address_required (no offers yet)', async () => {
    const { brandId } = await restaurantAt({ lat: 17.4239, lng: 78.4080, name: 'Spice Route' });
    const follower = await createFollowerUser();
    const res = await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'family lunch tomorrow, 2 chicken and 2 veg biryani, medium', brand_id: brandId })
      .expect(200);
    expect(res.body.data.stage).toBe('address_required');
    expect(res.body.data.question).toMatch(/where should we deliver/i);
    expect(Array.isArray(res.body.data.saved_addresses)).toBe(true);
    expect(res.body.data.use_current_location).toBe(true);
  });

  test('chat WITH drop_location inside the platform radius → offers', async () => {
    const { brandId } = await restaurantAt({ lat: 17.4239, lng: 78.4080, name: 'Spice Route' });
    const follower = await createFollowerUser();
    const drop = { lat: 17.4250, lng: 78.4090, label: 'Home', address: 'Jubilee Hills' };
    const res = await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'family lunch tomorrow, 2 chicken and 2 veg biryani, medium', brand_id: brandId, drop_location: drop })
      .expect(200);
    expect(res.body.data.stage).toBe('offers');
    expect(res.body.data.offers.length).toBeGreaterThan(0);
  });

  test('in-store chat: drop_location outside brand range → stage=out_of_range', async () => {
    // Admin shrinks the radius to 1 km for a deterministic out-of-range check.
    const admin = await createAdminUser();
    await request(app).put('/v1/admin/meals/settings').set(auth(admin.token))
      .send({ radius_km: 1, radius_tolerance_m: 0 }).expect(200);

    const { brandId } = await restaurantAt({ lat: 17.4239, lng: 78.4080, name: 'Spice Route' });
    const follower = await createFollowerUser();
    const farDrop = { lat: 17.5000, lng: 78.5000, label: 'Far' }; // > 8 km from brand
    const res = await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'family lunch tomorrow, 2 chicken 2 veg biryani, medium', brand_id: brandId, drop_location: farDrop })
      .expect(200);
    expect(res.body.data.stage).toBe('out_of_range');
  });

  test('cross-restaurant routing honours PLATFORM radius (not per-brand)', async () => {
    // Two restaurants. Drop near restaurant A only. Without any brand_id,
    // routing must include only A even though B's old per-brand radius
    // would have admitted it — the platform radius is what decides now.
    const admin = await createAdminUser();
    await request(app).put('/v1/admin/meals/settings').set(auth(admin.token))
      .send({ radius_km: 2, radius_tolerance_m: 0 }).expect(200);

    const near = await restaurantAt({ lat: 17.4239, lng: 78.4080, name: 'Near' });
    const far  = await restaurantAt({ lat: 17.5000, lng: 78.5000, name: 'Far' });

    const follower = await createFollowerUser();
    const drop = { lat: 17.4240, lng: 78.4082, label: 'Home' };
    const res = await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'family lunch tomorrow, 2 chicken 2 veg biryani, medium', drop_location: drop, slot_date: futureDate(2) })
      .expect(200);
    expect(res.body.data.stage).toBe('offers');
    const brandIds = res.body.data.offers.map((o) => o.brand_id);
    expect(brandIds).toContain(near.brandId);
    expect(brandIds).not.toContain(far.brandId);
  });
});
