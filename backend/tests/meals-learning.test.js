'use strict';

/**
 * meals-learning.test.js — INFLX Meals learning loop (P6).
 * Contract: features/meals-learning/.
 *   - Accept → meal_restaurant_learnings.discount_appetite (+ freebie_willingness if freebies).
 *   - Reject with reason → meal_restaurant_learnings.rejected_reason (tagged).
 *   - Paid order → meal_customer_preferences upsert (favourite_brand_ids, budget_per_head, spice_pref).
 *   - Second order → favourite union (no dupes), budget rolls.
 *   - Next chat reads the upserted memory back into the prompt.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand, createFollowerUser } = require('./helpers/factories');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const futureDate = (d = 2) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

beforeEach(async () => { await truncateAll(); });

async function makeRestaurantWithFamilyOffer() {
  const brand = await createBrandUser();
  await registerBrand(brand.token, { business_name: 'Spice Route', category: 'restaurant' });
  const brandId = (await request(app).put('/v1/meals/config').set(auth(brand.token))
    .send({ enabled: true, discount_clock: [] }).expect(200)).body.data.config.brand_id;
  const slot = (await request(app).post('/v1/meals/slots').set(auth(brand.token))
    .send({ label: 'Lunch', serve_time: '13:00', cutoff_minutes_before: 120, capacity: 40 }).expect(201)).body.data.slot;
  const ruleSuggested = (await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
    .send({ name: 'Family Mixed Pack', party_size: 'family', offer_kind: 'mixed',
      items_json: [{ name: 'Chicken Biryani', qty: 2, price: 300 }, { name: 'Veg Biryani', qty: 2, price: 220 }],
      base_price: 1040, discount_type: 'flat', discount_value: 90, freebies_json: ['Raita x2'],
      slot_id: slot.id, status: 'suggested' }).expect(201)).body.data.offer_rule;
  return { brand, brandId, ruleSuggested, slotId: slot.id };
}

describe('Meals learning loop (P6) — writes', () => {
  test('Accept writes discount_appetite + freebie_willingness; second Accept on plain rule writes only discount_appetite', async () => {
    const { brand, brandId, ruleSuggested, slotId } = await makeRestaurantWithFamilyOffer();

    // Accept the family rule (has discount + freebies)
    await request(app).patch(`/v1/meals/offer-rules/${ruleSuggested.id}`).set(auth(brand.token))
      .send({ status: 'active' }).expect(200);

    const learn1 = (await query(`SELECT learning_type, key FROM meal_restaurant_learnings WHERE brand_id = $1 ORDER BY learning_type`, [brandId])).rows;
    expect(learn1.map((r) => r.learning_type).sort()).toEqual(['discount_appetite', 'freebie_willingness']);
    expect(learn1.find((r) => r.learning_type === 'discount_appetite').key).toBe('family');

    // A plain solo rule with discount but no freebies → only discount_appetite.
    const solo = (await request(app).post('/v1/meals/offer-rules').set(auth(brand.token))
      .send({ name: 'Solo Pack', party_size: 'single', offer_kind: 'discount',
        items_json: [{ name: 'Chicken Biryani', qty: 1, price: 300 }],
        base_price: 300, discount_type: 'flat', discount_value: 30,
        slot_id: slotId, status: 'suggested' }).expect(201)).body.data.offer_rule;
    await request(app).patch(`/v1/meals/offer-rules/${solo.id}`).set(auth(brand.token))
      .send({ status: 'active' }).expect(200);

    const learn2 = (await query(`SELECT learning_type, key FROM meal_restaurant_learnings WHERE brand_id = $1 AND key = 'single'`, [brandId])).rows;
    expect(learn2.length).toBe(1);
    expect(learn2[0].learning_type).toBe('discount_appetite');
  });

  test('Reject with reason writes rejected_reason with a tagged key', async () => {
    const { brand, brandId, ruleSuggested } = await makeRestaurantWithFamilyOffer();

    await request(app).patch(`/v1/meals/offer-rules/${ruleSuggested.id}`).set(auth(brand.token))
      .send({ status: 'rejected', rejected_reason: 'too thin margin on this one' }).expect(200);

    const learn = (await query(`SELECT learning_type, key, value_json FROM meal_restaurant_learnings WHERE brand_id = $1 AND learning_type = 'rejected_reason'`, [brandId])).rows;
    expect(learn.length).toBe(1);
    expect(learn[0].key).toBe('thin_margin');
    expect(learn[0].value_json.full_text).toMatch(/thin margin/i);
  });

  test('Paid order upserts customer prefs; second order rolls budget + unions favourites; next chat reads it back', async () => {
    const { brand, brandId, ruleSuggested } = await makeRestaurantWithFamilyOffer();
    // Activate the family rule so chat → offers works.
    await request(app).patch(`/v1/meals/offer-rules/${ruleSuggested.id}`).set(auth(brand.token))
      .send({ status: 'active' }).expect(200);

    const follower = await createFollowerUser();
    // First order via the chat → offers → pay chain.
    const chat = (await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'family lunch tomorrow, 2 chicken and 2 veg biryani, medium', brand_id: brandId, slot_date: futureDate(2),
              drop_location: { lat: 17.4239, lng: 78.4080, label: 'Home' } }).expect(200)).body.data;
    expect(chat.stage).toBe('offers');
    await request(app).post('/v1/meals/orders').set(auth(follower.token))
      .send({ meal_offer_id: chat.offers[0].id }).expect(201);

    const prefs1 = (await query(`SELECT spice_pref, budget_per_head, favourite_brand_ids FROM meal_customer_preferences WHERE follower_id IN (SELECT id FROM followers WHERE user_id = $1)`, [follower.user.id])).rows[0];
    expect(prefs1).toBeTruthy();
    expect(prefs1.spice_pref).toBe('medium');
    expect(Number(prefs1.budget_per_head)).toBeCloseTo(950 / 4, 1); // ₹950 over 4 heads (family)
    expect(prefs1.favourite_brand_ids).toEqual(expect.arrayContaining([brandId]));

    // Second order at the same brand — favourites stay unique, budget rolls.
    const chat2 = (await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'family lunch tomorrow, 2 chicken and 2 veg biryani, medium', brand_id: brandId, slot_date: futureDate(2),
              drop_location: { lat: 17.4239, lng: 78.4080, label: 'Home' } }).expect(200)).body.data;
    await request(app).post('/v1/meals/orders').set(auth(follower.token))
      .send({ meal_offer_id: chat2.offers[0].id }).expect(201);

    const prefs2 = (await query(`SELECT budget_per_head, favourite_brand_ids FROM meal_customer_preferences WHERE follower_id IN (SELECT id FROM followers WHERE user_id = $1)`, [follower.user.id])).rows[0];
    expect(prefs2.favourite_brand_ids.length).toBe(1); // no dupes
    expect(Number(prefs2.budget_per_head)).toBe(Number(prefs1.budget_per_head)); // same per-head → rolling stays same

    // Next chat reads the memory back: the AI recommendation reasoning
    // should reference "within your usual budget" + "medium spice" hints
    // from the mock recommender.
    const chat3 = (await request(app).post('/v1/meals/chat').set(auth(follower.token))
      .send({ message: 'family lunch tomorrow, 2 chicken and 2 veg biryani, medium', brand_id: brandId, slot_date: futureDate(2),
              drop_location: { lat: 17.4239, lng: 78.4080, label: 'Home' } }).expect(200)).body.data;
    expect(chat3.recommendation.reasoning).toMatch(/budget|medium spice/i);
  });
});
