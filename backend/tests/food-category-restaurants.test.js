'use strict';

/**
 * Food Discovery Cleanup — category-tile discovery endpoint.
 * Contract: features/food-discovery-cleanup.
 *
 * GET /follower/category-restaurants?name= → restaurants serving a Home-Builder
 * category tile. Matches by keyword on dish name; reuses a same-named dish_group's
 * members when one exists. Excludes restaurants that don't serve it.
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
     VALUES ($1,$2,$3,true,true,$4)`, [brandId, name, price, masterDishId || null]);
}

describe('category-restaurants — craving tile → restaurants', () => {
  it('returns restaurants whose dishes match the tile name; excludes others', async () => {
    const pz = await restaurant('Pizza House', 16.501, 80.641);
    await addDish(pz.id, 'Margherita Pizza', 199);
    await addDish(pz.id, 'Farmhouse Pizza', 249);
    const ds = await restaurant('Dosa Corner', 16.502, 80.642);
    await addDish(ds.id, 'Plain Dosa', 64);

    const res = await request(app).get('/v1/follower/category-restaurants?name=Pizza&lat=16.50&lng=80.64');
    expect(res.status).toBe(200);
    const names = res.body.data.restaurants.map(r => r.business_name);
    expect(names).toContain('Pizza House');
    expect(names).not.toContain('Dosa Corner');
    const ph = res.body.data.restaurants.find(r => r.business_name === 'Pizza House');
    expect(ph.from_price).toBe(199);
    expect(ph.varieties.some(v => /Pizza/.test(v))).toBe(true);
    expect(ph.eta_min_mins).not.toBeNull();
  });

  it('uses a same-named dish_group\'s members for precise matching', async () => {
    // master dish that is NOT named "pizza" but is a member of the Pizza group
    const { rows: md } = await query(
      `SELECT id FROM master_dishes WHERE name='Margherita' LIMIT 1`);
    let memberId = md[0]?.id;
    if (!memberId) {
      const { rows } = await query(
        `INSERT INTO master_dishes (cuisine, section, name) VALUES ('Italian','Pizza','Margherita') RETURNING id`);
      memberId = rows[0].id;
    }
    const { rows: g } = await query(
      `INSERT INTO dish_groups (name, keyword, status) VALUES ('Pizza','pizza','active') RETURNING id`);
    await query(`INSERT INTO dish_group_dishes (dish_group_id, master_dish_id) VALUES ($1,$2)`, [g[0].id, memberId]);

    const pz = await restaurant('Italiano', 16.50, 80.64);
    await addDish(pz.id, 'Classic Margherita', 220, memberId); // name has no "pizza" — matched via member

    const res = await request(app).get('/v1/follower/category-restaurants?name=Pizza&lat=16.50&lng=80.64');
    expect(res.status).toBe(200);
    expect(res.body.data.restaurants.map(r => r.business_name)).toContain('Italiano');
  });

  it('422 when name is missing', async () => {
    const res = await request(app).get('/v1/follower/category-restaurants');
    expect(res.status).toBe(422);
  });
});
