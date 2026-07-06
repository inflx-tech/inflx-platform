'use strict';

/**
 * Banner-Gateway hide-when-empty — Phase 2 (features/phase2-banner-hide-empty/).
 *
 * A rule-driven banner (library_products + presentation_type='banner') is a
 * gateway: tap re-runs the rule. Phase 2 drops the banner from the feed when
 * its rule matches NOTHING in the current context, instead of rendering a
 * dead-end shell. Unresolved (deleted/hidden) library rules also drop.
 * Static image frames (rule='static', content in config.tiles) must NEVER be
 * dropped — their items[] is empty by design.
 *
 * FIXTURE NOTE: direct SQL seeding (same rationale as section-engine.test.js —
 * the campaign-create API path is broken by the truncateAll/subscription_tiers
 * CASCADE, a ledgered harness defect). Anonymous requests; the engine is public.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const ttlCache = require('../src/utils/ttlCache');

const get = (path) => request(app).get(path);
const byKey = (sections, key) => sections.find(s => s.key === key);

const cleanOwnRows = async () => {
  await query(`DELETE FROM section_config WHERE shelf_key IN
    ('banner_match','banner_dry','banner_unresolved','static_frame','biz_banner')`);
};

beforeEach(async () => {
  await truncateAll();
  // section_config survives truncateAll (no users FK) — clear our own rows.
  await cleanOwnRows();
  ttlCache.clear();
});

// NOTE: no afterAll cleanup — the shared pg pool is already ended by the
// harness when file-level afterAll runs. beforeEach self-cleaning covers reruns.

async function seedFashionProduct() {
  const brandUser = (await query(
    `INSERT INTO users (phone, role, name, status, city)
     VALUES ('+910000000021', 'brand', 'Charvitha Fashions', 'approved', 'Vijayawada') RETURNING id`
  )).rows[0].id;
  const brandId = (await query(
    `INSERT INTO brands (user_id, business_name, category)
     VALUES ($1, 'Charvitha Fashions', 'fashion_walkin') RETURNING id`, [brandUser]
  )).rows[0].id;
  await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, tags)
     VALUES ($1, 'Red Kurti', 250, true, true, '{kurti}')`, [brandId]
  );
  return { brandId };
}

async function seedLibraryRule(name, ruleJson) {
  return (await query(
    `INSERT INTO section_library (business_type, name, rule_json, status)
     VALUES ('ALL', $1, $2, 'active') RETURNING id`, [name, JSON.stringify(ruleJson)]
  )).rows[0].id;
}

async function placeBanner(shelfKey, position, libraryId) {
  await query(
    `INSERT INTO section_config
       (screen, scope_type, scope_value, shelf_key, title, shelf_type, rule, item_limit, position, enabled, config_json)
     VALUES ('home', 'global', NULL, $1, $2, 'tiles', 'library_products', 8, $3, true, $4)`,
    [shelfKey, shelfKey, position, JSON.stringify({
      presentation_type: 'banner',
      library_section_id: libraryId,
      banner: { headline: shelfKey },
    })]
  );
}

describe('Banner-Gateway hide-when-empty (Phase 2)', () => {
  it('keeps a banner whose rule matches products; drops dry and unresolved ones', async () => {
    await seedFashionProduct();
    const matching = await seedLibraryRule('Kurtis under 300', { tags: ['kurti'], price_max: 300 });
    const dry = await seedLibraryRule('Nothing matches', { tags: ['no-such-tag'] });

    await placeBanner('banner_match', 90, matching);
    await placeBanner('banner_dry', 91, dry);
    await placeBanner('banner_unresolved', 92, '00000000-0000-0000-0000-000000000000');

    const res = await get('/v1/follower/home');
    expect(res.status).toBe(200);
    const { sections } = res.body.data;

    const kept = byKey(sections, 'banner_match');
    expect(kept).toBeDefined();
    expect(kept.type).toBe('banner_gateway');       // same shell shape as before
    expect(kept.items).toEqual([]);                 // gateway never pre-fills
    expect(kept.config.banner.headline).toBe('banner_match');

    expect(byKey(sections, 'banner_dry')).toBeUndefined();        // rule matches nothing → hidden
    expect(byKey(sections, 'banner_unresolved')).toBeUndefined(); // deleted rule → hidden
  });

  it('never drops a static image frame (rule=static, items empty by design)', async () => {
    await query(
      `INSERT INTO section_config
         (screen, scope_type, scope_value, shelf_key, title, shelf_type, rule, item_limit, position, enabled, config_json)
       VALUES ('home', 'global', NULL, 'static_frame', 'Static frame', 'tiles', 'static', 8, 93, true, $1)`,
      [JSON.stringify({ style: 'fullbleed', tiles: [{ image_url: 'https://example.com/x.jpg' }] })]
    );
    const res = await get('/v1/follower/home');
    expect(res.status).toBe(200);
    const frame = byKey(res.body.data.sections, 'static_frame');
    expect(frame).toBeDefined();
    expect(frame.type).toBe('tiles');
  });

  it('hides an empty banner only in the context where it is dry (business scope)', async () => {
    const { brandId } = await seedFashionProduct();
    // Second brand with NO kurtis — the same banner must hide on ITS page.
    const otherUser = (await query(
      `INSERT INTO users (phone, role, name, status, city)
       VALUES ('+910000000022', 'brand', 'UrbanThread', 'approved', 'Vijayawada') RETURNING id`
    )).rows[0].id;
    const otherBrand = (await query(
      `INSERT INTO brands (user_id, business_name, category)
       VALUES ($1, 'UrbanThread', 'fashion_walkin') RETURNING id`, [otherUser]
    )).rows[0].id;
    await query(
      `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, tags)
       VALUES ($1, 'Linen Shirt', 900, true, true, '{shirt}')`, [otherBrand]
    );

    const lib = await seedLibraryRule('Kurtis under 300', { tags: ['kurti'], price_max: 300 });
    await query(
      `INSERT INTO section_config
         (screen, scope_type, scope_value, shelf_key, title, shelf_type, rule, item_limit, position, enabled, config_json)
       VALUES ('business', 'global', NULL, 'biz_banner', 'Kurtis under 300', 'tiles', 'library_products', 8, 90, true, $1)`,
      [JSON.stringify({ presentation_type: 'banner', library_section_id: lib, banner: { headline: 'Kurtis under 300' } })]
    );

    const withKurtis = await get(`/v1/follower/business/${brandId}/sections`);
    expect(withKurtis.status).toBe(200);
    expect(byKey(withKurtis.body.data.sections, 'biz_banner')).toBeDefined();

    const withoutKurtis = await get(`/v1/follower/business/${otherBrand}/sections`);
    expect(withoutKurtis.status).toBe(200);
    expect(byKey(withoutKurtis.body.data.sections, 'biz_banner')).toBeUndefined();
  });
});
