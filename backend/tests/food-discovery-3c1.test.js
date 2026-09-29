'use strict';

/**
 * Food World Slice 3C-1 — food home discovery backend.
 * Contract: features/food-world-slice3c1-discovery.
 *
 * Covers the three backend changes this slice carries:
 *   1. etaFromDistanceKm — distance-derived ETA (replaces restaurant-set ETA).
 *   2. restaurants_with_featured — Type B rule: restaurants + nested featured
 *      dishes (is_featured first by featured_sort, fallback first N in-stock),
 *      with header rating / free_delivery / cuisines / ETA; excludes empty.
 *   3. brand_products.mrp surfaced in getProductDetail + listing payload.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand } = require('./helpers/factories');
const { runRule, etaFromDistanceKm } = require('../src/services/sectionRules.service');

beforeEach(async () => { await truncateAll(); });

async function restaurant(name, lat, lng, listingData = {}) {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token, { business_name: name, category: 'restaurant' });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  await query(`UPDATE brands SET lat=$2, lng=$3, listing_data=$4 WHERE id=$1`,
    [brand.id, lat, lng, JSON.stringify(listingData)]);
  return brand;
}
async function addDish(brandId, name, price, opts = {}) {
  const { rows } = await query(
    `INSERT INTO brand_products (brand_id, name, price, mrp, is_active, pushed_to_store,
                                 is_featured, featured_sort, veg_flag, badge)
     VALUES ($1,$2,$3,$4,true,true,$5,$6,$7,$8) RETURNING id`,
    [brandId, name, price, opts.mrp ?? null, opts.featured === true, opts.sort ?? 0,
     opts.veg || 'na', opts.badge || null]);
  return rows[0].id;
}
async function review(brandId, rating) {
  await query(
    `INSERT INTO restaurant_reviews (brand_id, rating, status) VALUES ($1,$2,'published')`,
    [brandId, rating]);
}

describe('etaFromDistanceKm — distance-derived ETA', () => {
  it('computes a 5-min-rounded range from distance; null when no distance', () => {
    expect(etaFromDistanceKm(0)).toEqual({ min: 10, max: 15 });
    expect(etaFromDistanceKm(2.0)).toEqual({ min: 15, max: 20 });   // 10 + 4 = 14 → 15
    expect(etaFromDistanceKm(4.0)).toEqual({ min: 20, max: 25 });   // 10 + 8 = 18 → 20
    expect(etaFromDistanceKm(null)).toEqual({ min: null, max: null });
    expect(etaFromDistanceKm(undefined)).toEqual({ min: null, max: null });
  });
});

describe('restaurants_with_featured — Type B rule', () => {
  it('returns restaurants with nested featured dishes (featured first), excludes empty, carries header', async () => {
    const a = await restaurant('Swagruha tiffins', 16.501, 80.641,
      { free_delivery: true, cuisines: ['South Indian'] });
    await review(a.id, 5); await review(a.id, 4);              // avg 4.5
    // featured (sort) should outrank a non-featured newer dish
    await addDish(a.id, 'Idli 2PC', 51, { featured: true, sort: 1, veg: 'veg', badge: 'Popular' });
    await addDish(a.id, 'Vada 4 PC', 65, { featured: true, sort: 0, veg: 'veg', mrp: 79 });
    await addDish(a.id, 'Random Special', 90, { featured: false, veg: 'veg' });

    // a restaurant with NO in-store dish must be excluded
    await restaurant('Empty Kitchen', 16.502, 80.642, {});

    const items = await runRule('restaurants_with_featured', { lat: 16.50, lng: 80.64, limit: 10 });

    const swag = items.find((r) => r.name === 'Swagruha tiffins');
    expect(swag).toBeTruthy();
    expect(items.find((r) => r.name === 'Empty Kitchen')).toBeFalsy();

    // header
    expect(swag.entity_type).toBe('brand');
    expect(Number(swag.rating)).toBe(4.5);
    expect(swag.free_delivery).toBe(true);
    expect(swag.cuisines).toContain('South Indian');
    expect(swag.eta_min).not.toBeNull();
    expect(swag.eta_max).toBeGreaterThan(swag.eta_min);

    // nested featured dishes, featured_sort first → Vada (sort 0) before Idli (sort 1)
    const names = swag.products.map((p) => p.name);
    expect(names.indexOf('Vada 4 PC')).toBeLessThan(names.indexOf('Idli 2PC'));
    const vada = swag.products.find((p) => p.name === 'Vada 4 PC');
    expect(vada.mrp).toBe(79);            // struck MRP carried
    expect(vada.brand.id).toBe(a.id);     // brand ref for nav
  });

  it('falls back to in-stock dishes when none are featured', async () => {
    const b = await restaurant('Kalyani Chickens', 16.50, 80.64, {});
    await addDish(b.id, 'Chicken Breast', 224, { veg: 'non_veg' });
    await addDish(b.id, 'Chicken Biryani', 311, { veg: 'non_veg' });

    const items = await runRule('restaurants_with_featured', { lat: 16.50, lng: 80.64, limit: 10 });
    const kal = items.find((r) => r.name === 'Kalyani Chickens');
    expect(kal).toBeTruthy();
    expect(kal.products.length).toBe(2);   // fallback fill — not empty
  });
});

