'use strict';

/**
 * World Rules — Phase 3 (features/phase3-world-rules/, mig 126).
 *
 * Per-world location behaviour for the section engine:
 *   - ABSENT settings row  → legacy rank_only (byte-identical behaviour)
 *   - boundary + coords    → hard radius (haversine <= radius_km)
 *   - boundary, no coords  → hard city match
 *   - empty_fallback       → widen / show_nearest repopulate; show_empty stays honest
 *   - curation surfaces    → boundary NEVER applies when brandId/influencer set
 *
 * FIXTURE NOTE: direct SQL (no campaign API — ledgered truncateAll/tier-CASCADE
 * harness defect). Two fashion shops with real coords: Vijayawada (~16.51,80.65)
 * and Hyderabad (~17.44,78.38) — ~270 km apart. Follower positions arrive as
 * ?lat&lng&city on the public section endpoints.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const ttlCache = require('../src/utils/ttlCache');
const { runRule } = require('../src/services/sectionRules.service');

const get = (path) => request(app).get(path);
const byKey = (sections, key) => sections.find(s => s.key === key);

const VJA = { lat: 16.51, lng: 80.65 };  // Vijayawada
const HYD = { lat: 17.44, lng: 78.38 };  // Hyderabad (~270 km away)
const DEL = { lat: 28.61, lng: 77.21 };  // Delhi (far from both)

let nearBrand, farBrand;

async function seedTwoShops() {
  const mk = async (phone, name, city, { lat, lng }, productName) => {
    const userId = (await query(
      `INSERT INTO users (phone, role, name, status, city)
       VALUES ($1, 'brand', $2, 'approved', $3) RETURNING id`, [phone, name, city]
    )).rows[0].id;
    const brandId = (await query(
      `INSERT INTO brands (user_id, business_name, category, lat, lng)
       VALUES ($1, $2, 'fashion', $3, $4) RETURNING id`, [userId, name, lat, lng]
    )).rows[0].id;
    await query(
      `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, tags)
       VALUES ($1, $2, 500, true, true, '{kurti}')`, [brandId, productName]
    );
    return brandId;
  };
  nearBrand = await mk('+910000000031', 'NearShop', 'Vijayawada', VJA, 'Near Kurti');
  farBrand = await mk('+910000000032', 'FarShop', 'Hyderabad', HYD, 'Far Kurti');
}

async function placeShelves() {
  await query(
    `INSERT INTO section_config
       (screen, scope_type, scope_value, shelf_key, title, shelf_type, rule, item_type, item_limit, position, enabled)
     VALUES ('category', 'vertical', 'fashion', 'wr_products', 'Products', 'products', 'products_in_category', 'products', 20, 1, true),
            ('category', 'vertical', 'fashion', 'wr_shops', 'Shops', 'brands', 'businesses_in_category', 'brands', 20, 2, true)`
  );
}

async function setWorldRules(mode, radiusKm, fallback) {
  await query(
    `INSERT INTO world_rule_settings (world_key, location_mode, radius_km, empty_fallback)
     VALUES ('fashion', $1, $2, $3)
     ON CONFLICT (world_key) DO UPDATE
       SET location_mode = $1, radius_km = $2, empty_fallback = $3, updated_at = now()`,
    [mode, radiusKm, fallback]
  );
}

const fashion = (qs) => get(`/v1/follower/section/category/fashion${qs}`);
const productNames = (res) => (byKey(res.body.data.sections, 'wr_products')?.items || []).map(i => i.name).sort();
const shopNames = (res) => (byKey(res.body.data.sections, 'wr_shops')?.items || []).map(i => i.name).sort();

const cleanOwnRows = async () => {
  await query(`DELETE FROM section_config WHERE shelf_key LIKE 'wr_%'`);
  await query(`DELETE FROM world_rule_settings WHERE world_key = 'fashion'`);
};

beforeEach(async () => {
  await truncateAll();
  // section_config + world_rule_settings survive truncateAll (no users FK) —
  // clear this suite's own rows so each test starts clean.
  await cleanOwnRows();
  ttlCache.clear();
  await seedTwoShops();
  await placeShelves();
});

// NOTE: no afterAll cleanup — the shared pg pool is already ended by the
// harness when file-level afterAll runs. Each suite (this one included)
// defends itself in beforeEach instead; our keys are namespaced (wr_*).

describe('World Rules (Phase 3, mig 126)', () => {
  it('absent settings row → legacy rank_only: everything shows, nearest first', async () => {
    const res = await fashion(`?lat=${VJA.lat}&lng=${VJA.lng}`);
    expect(res.status).toBe(200);
    expect(productNames(res)).toEqual(['Far Kurti', 'Near Kurti']);
    expect(shopNames(res)).toEqual(['FarShop', 'NearShop']);
    const items = byKey(res.body.data.sections, 'wr_products').items;
    expect(items[0].name).toBe('Near Kurti'); // distance still ranks
  });

  it('boundary + coords: hard radius drops the far shop and its products', async () => {
    await setWorldRules('boundary', 50, 'show_empty');
    const res = await fashion(`?lat=${VJA.lat}&lng=${VJA.lng}`);
    expect(productNames(res)).toEqual(['Near Kurti']);
    expect(shopNames(res)).toEqual(['NearShop']);
  });

  it('boundary without coords: hard city match', async () => {
    await setWorldRules('boundary', 50, 'show_empty');
    const res = await fashion(`?city=Hyderabad`);
    expect(productNames(res)).toEqual(['Far Kurti']);
    expect(shopNames(res)).toEqual(['FarShop']);
  });

  it('empty area + show_nearest fallback: repopulates unbounded', async () => {
    await setWorldRules('boundary', 50, 'show_nearest');
    const res = await fashion(`?lat=${DEL.lat}&lng=${DEL.lng}`);
    expect(productNames(res)).toEqual(['Far Kurti', 'Near Kurti']); // nothing within 50km of Delhi → nearest anyway
  });

  it('empty area + show_empty fallback: honest empty shelf', async () => {
    await setWorldRules('boundary', 50, 'show_empty');
    const res = await fashion(`?lat=${DEL.lat}&lng=${DEL.lng}`);
    expect(productNames(res)).toEqual([]);
    expect(shopNames(res)).toEqual([]);
  });

  it('empty area + widen fallback: one retry at 2x radius', async () => {
    // Follower ~100km from Vijayawada (Guntur-ish offset): outside 80km, inside 160km.
    await setWorldRules('boundary', 80, 'widen');
    const res = await fashion(`?lat=17.35&lng=80.55`); // ~95km north of VJA
    expect(productNames(res)).toEqual(['Near Kurti']); // widened 160km reaches VJA, not HYD (~210km)
  });

  it('curation surfaces immune: boundary never applies when brandId is set', async () => {
    await setWorldRules('boundary', 50, 'show_empty');
    // Direct rule call — the business-page path sets ctx.brandId; a viewer in
    // Vijayawada opening FarShop's (Hyderabad) page must still see its products.
    const items = await runRule('library_products', {
      ruleDef: {}, brandId: farBrand, worldRules: { location_mode: 'boundary', radius_km: 50, empty_fallback: 'show_empty' },
      lat: VJA.lat, lng: VJA.lng, city: 'Vijayawada', limit: 20, config: {},
    });
    expect(items.map(i => i.name)).toEqual(['Far Kurti']);
  });

  it('Phase 4a — a section override beats the world default (and only for that section)', async () => {
    // World stays legacy rank_only (no row); ONE shelf opts into a boundary.
    await query(
      `UPDATE section_config
          SET config_json = $1
        WHERE shelf_key = 'wr_shops' AND scope_value = 'fashion'`,
      [JSON.stringify({ world_rules_override: { location_mode: 'boundary', radius_km: 50, empty_fallback: 'show_empty' } })]
    );
    const res = await fashion(`?lat=${VJA.lat}&lng=${VJA.lng}`);
    expect(shopNames(res)).toEqual(['NearShop']);                  // overridden shelf: bounded
    expect(productNames(res)).toEqual(['Far Kurti', 'Near Kurti']); // sibling shelf: world default (rank only)
  });

  it('mode off: location ignored — no distance ranking, no city boost', async () => {
    await setWorldRules('off', null, 'show_nearest');
    const res = await fashion(`?lat=${VJA.lat}&lng=${VJA.lng}`);
    expect(productNames(res)).toEqual(['Far Kurti', 'Near Kurti']); // both present
    const items = byKey(res.body.data.sections, 'wr_products').items;
    expect(items.every(i => i.distance_km === undefined || i.distance_km === null)).toBe(true);
  });
});
