'use strict';

/**
 * Food World — flywheel auto-surface (Slice 2).
 * Contract: features/food-flywheel-autosurface.
 *
 * A custom dish typed by Restaurant A (captured in pending_dishes) must appear
 * as a SUGGESTION to Restaurant B's typeahead, grouped by normalized name with
 * a restaurant count, WITHOUT polluting the canonical master_dishes. Canonical
 * suggestions still work; names already canonical are not duplicated as custom.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand } = require('./helpers/factories');

beforeEach(async () => { await truncateAll(); });

async function restaurant(name) {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token, { business_name: name, category: 'restaurant' });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  return { token, brand };
}

async function seedPending(brandId, raw, norm, section) {
  await query(
    `INSERT INTO pending_dishes (brand_id, raw_name, norm_name, section, status)
     VALUES ($1,$2,$3,$4,'pending')`,
    [brandId, raw, norm, section]
  );
}

describe('Food flywheel — custom dishes surface to other restaurants', () => {
  it('A custom dish typed by Restaurant A appears in Restaurant B typeahead', async () => {
    const a = await restaurant('Resto A');
    const b = await restaurant('Resto B');
    await seedPending(a.brand.id, 'Volcano Paneer Loaded', 'volcano paneer loaded', 'Specials');

    const res = await request(app)
      .get('/v1/brands/me/dishes/search?q=volcano%20paneer')
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(200);
    const custom = res.body.data.matches.find(m => m.is_custom && /volcano paneer loaded/i.test(m.name));
    expect(custom).toBeTruthy();
    expect(custom.id).toBeNull();
    expect(custom.restaurant_count).toBe(1);
  });

  it('groups the same custom across restaurants with a count', async () => {
    const a = await restaurant('Resto A');
    const b = await restaurant('Resto B');
    const c = await restaurant('Resto C');
    await seedPending(a.brand.id, 'Volcano Paneer Loaded', 'volcano paneer loaded', 'Specials');
    await seedPending(b.brand.id, 'volcano paneer loaded', 'volcano paneer loaded', 'Wraps');

    const res = await request(app)
      .get('/v1/brands/me/dishes/search?q=volcano%20paneer')
      .set('Authorization', `Bearer ${c.token}`);
    const custom = res.body.data.matches.filter(m => m.is_custom && m.norm_name === 'volcano paneer loaded');
    expect(custom).toHaveLength(1);            // grouped, not duplicated
    expect(custom[0].restaurant_count).toBe(2);
  });

  it('canonical suggestions still work and are not duplicated by customs', async () => {
    const a = await restaurant('Resto A');
    const b = await restaurant('Resto B');
    // A typed a custom that is actually canonical ("Idli" exists in master_dishes seed)
    await seedPending(a.brand.id, 'Idli', 'idli', 'Tiffins');

    const res = await request(app)
      .get('/v1/brands/me/dishes/search?q=idli')
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(200);
    const matches = res.body.data.matches;
    expect(matches.some(m => !m.is_custom && /idli/i.test(m.name))).toBe(true);   // canonical present
    expect(matches.some(m => m.is_custom && m.norm_name === 'idli')).toBe(false); // not duplicated as custom
  });
});
