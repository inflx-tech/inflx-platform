'use strict';

/**
 * Food World Slice 3 — dish-group discovery (tap a tile → nearby restaurants).
 * Contract: features/food-dish-groups.
 *
 * Verifies the core "tap → populate correct restaurants" functionality:
 * a Biryani group returns restaurants serving member biryanis OR a keyword-
 * matched custom biryani, near the user, ordered by distance; excludes
 * restaurants that don't serve biryani; carries varieties + from-price.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand } = require('./helpers/factories');

beforeEach(async () => { await truncateAll(); });

async function restaurant(name, lat, lng) {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token, { business_name: name, category: 'restaurant' });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  await query(`UPDATE brands SET lat=$2, lng=$3 WHERE id=$1`, [brand.id, lat, lng]);
  return brand;
}
async function addDish(brandId, name, price, masterDishId) {
  await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, master_dish_id)
     VALUES ($1,$2,$3,true,true,$4)`,
    [brandId, name, price, masterDishId || null]);
}
async function masterId(name) {
  const { rows } = await query(`SELECT id FROM master_dishes WHERE name=$1 LIMIT 1`, [name]);
  return rows[0]?.id;
}

// Build the "Biryani" group with the given member dish ids + keyword.
async function biryaniGroup(memberIds) {
  const { rows } = await query(
    `INSERT INTO dish_groups (name, keyword, status) VALUES ('Biryani','biryani','active') RETURNING id`);
  const gid = rows[0].id;
  for (const m of memberIds) {
    await query(`INSERT INTO dish_group_dishes (dish_group_id, master_dish_id) VALUES ($1,$2)`, [gid, m]);
  }
  return gid;
}

describe('Dish-group discovery — tap a tile → nearby restaurants', () => {
  it('returns restaurants serving the group (members OR keyword), nearest first, excludes others', async () => {
    const chk = await masterId('Chicken Biryani');
    const mut = await masterId('Mutton Biryani');
    const veg = await masterId('Veg Biryani');
    const dosa = await masterId('Plain Dosa');
    expect(chk && mut && veg && dosa).toBeTruthy();

    // Near point ~ (16.50, 80.64)
    const a = await restaurant('Biryani House', 16.501, 80.641);   // nearest — 2 biryanis (member)
    const b = await restaurant('Far Biryani',  16.62, 80.78);      // farther — 1 biryani (member)
    const c = await restaurant('Dosa Corner',  16.502, 80.642);    // near but NO biryani
    const d = await restaurant('Custom Dum',   16.503, 80.643);    // near — CUSTOM biryani (keyword)

    await addDish(a.id, 'Chicken Biryani', 220, chk);
    await addDish(a.id, 'Mutton Biryani', 320, mut);
    await addDish(b.id, 'Veg Biryani', 180, veg);
    await addDish(c.id, 'Plain Dosa', 60, dosa);
    await addDish(d.id, 'Hyderabadi Special Biryani', 250, null);  // no master_dish_id → keyword catch

    const gid = await biryaniGroup([chk, mut, veg]);

    const res = await request(app)
      .get(`/v1/follower/dish-groups/${gid}/restaurants?lat=16.50&lng=80.64`);
    expect(res.status).toBe(200);
    const list = res.body.data.restaurants;
    const names = list.map(r => r.business_name);

    expect(names).toContain('Biryani House');
    expect(names).toContain('Far Biryani');
    expect(names).toContain('Custom Dum');     // caught by keyword
    expect(names).not.toContain('Dosa Corner'); // serves no biryani

    // nearest first
    expect(names[0]).toBe('Biryani House');
    expect(names.indexOf('Far Biryani')).toBeGreaterThan(names.indexOf('Biryani House'));

    // varieties + from-price on the nearest
    const house = list.find(r => r.business_name === 'Biryani House');
    expect(house.varieties.sort()).toEqual(['Chicken Biryani', 'Mutton Biryani']);
    expect(house.from_price).toBe(220);
    expect(house.distance_km).toBeGreaterThanOrEqual(0);
  });

  it('lists active dish-group tiles', async () => {
    const chk = await masterId('Chicken Biryani');
    await biryaniGroup([chk]);
    const res = await request(app).get('/v1/follower/dish-groups');
    expect(res.status).toBe(200);
    expect(res.body.data.groups.some(g => g.name === 'Biryani')).toBe(true);
  });

  it('empty group (no members, no keyword) returns no restaurants', async () => {
    const { rows } = await query(
      `INSERT INTO dish_groups (name, status) VALUES ('Empty','active') RETURNING id`);
    const res = await request(app).get(`/v1/follower/dish-groups/${rows[0].id}/restaurants?lat=16.5&lng=80.6`);
    expect(res.status).toBe(200);
    expect(res.body.data.restaurants).toEqual([]);
  });
});
