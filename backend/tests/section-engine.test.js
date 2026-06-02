'use strict';

/**
 * Section Engine — Phase A (features/follower-section-engine/)
 *
 * Proves the backend-driven { sections:[...] } feeds:
 *   - config-driven shelves render in order; disabled shelves are omitted
 *   - rules rank + populate (biggest_discounts, brands, nav tiles)
 *   - every actionable item carries the 4-ID tracking block
 *   - product rails (top_by_sales) ship omitted (no fabricated data)
 *   - graceful 404 on unknown creator
 *   - existing feeds unaffected (regression)
 *
 * FIXTURE NOTE: the live-offer scenario is seeded by DIRECT SQL, not the
 * campaign/wallet/contract API. The shared test harness's truncateAll wipes
 * the admin-seeded subscription_tiers (TRUNCATE users CASCADE follows the
 * subscription_tiers.updated_by → users FK), which 500s campaign-create — a
 * pre-existing fixture defect in the backend-test-debt, unrelated to this
 * read-path feature. Direct seeding needs none of that admin-config, so this
 * suite is robust to it. Requests run anonymously with ?city= (the engine is
 * public; auth only adds personalization, which these tests don't assert).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const ttlCache = require('../src/utils/ttlCache');

const CITY = 'Vijayawada';
const HANDLE = 'sectioncreator';

beforeEach(async () => {
  await truncateAll();
  ttlCache.clear(); // process-global memo — clear so reseeded data isn't shadowed
});

// Seed one live (campaign_influencer × offer): restaurant brand + influencer in
// Vijayawada, 25% offer, expiring in 10 days. Mirrors the canonical live-offer
// chain the rules query (co.is_active + ci.status + c.status).
async function seedLiveOffer() {
  const brandUser = (await query(
    `INSERT INTO users (phone, role, name, status, city)
     VALUES ('+910000000001', 'brand', 'Brand Owner', 'approved', $1) RETURNING id`, [CITY]
  )).rows[0].id;
  const brandId = (await query(
    `INSERT INTO brands (user_id, business_name, category)
     VALUES ($1, 'Spice Garden', 'restaurant') RETURNING id`, [brandUser]
  )).rows[0].id;

  const infUser = (await query(
    `INSERT INTO users (phone, role, name, status, city)
     VALUES ('+910000000002', 'influencer', 'Section Creator', 'approved', $1) RETURNING id`, [CITY]
  )).rows[0].id;
  const infId = (await query(
    `INSERT INTO influencers (user_id, instagram_handle, followers_count)
     VALUES ($1, $2, 5000) RETURNING id`, [infUser, HANDLE]
  )).rows[0].id;

  const campId = (await query(
    `INSERT INTO campaigns (brand_id, name, status, start_date, end_date)
     VALUES ($1, 'Section Campaign', 'active', '2026-06-01', '2026-12-31') RETURNING id`, [brandId]
  )).rows[0].id;
  const setId = (await query(
    `INSERT INTO campaign_sets (campaign_id, name, goal)
     VALUES ($1, 'Creators', 'conversion') RETURNING id`, [campId]
  )).rows[0].id;
  await query(
    `INSERT INTO campaign_influencers (set_id, influencer_id, status, offer_expires_at, created_at)
     VALUES ($1, $2, 'active', now() + interval '10 days', now())`, [setId, infId]
  );
  const offerId = (await query(
    `INSERT INTO campaign_offers (campaign_id, set_id, offer_type, discount_value, is_active, availing_modes)
     VALUES ($1, $2, 'percentage', 25, true, '{pay_at_store}') RETURNING id`, [campId, setId]
  )).rows[0].id;

  return { brandId, infId, campId, setId, offerId };
}

const byKey = (sections, key) => sections.find(s => s.key === key);
const get = (path) => request(app).get(path);

// ── HOME ─────────────────────────────────────────────────────────────────────

describe('GET /v1/follower/home', () => {
  it('returns config-driven sections in position order', async () => {
    await seedLiveOffer();
    const res = await get(`/v1/follower/home?city=${CITY}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { sections } = res.body.data;
    expect(Array.isArray(sections)).toBe(true);
    expect(sections[0].key).toBe('stories');
    expect(sections[1].key).toBe('browse_category');
  });

  it('renders the 7 nav verticals from config_json', async () => {
    await seedLiveOffer();
    const res = await get(`/v1/follower/home?city=${CITY}`);
    const nav = byKey(res.body.data.sections, 'browse_category');
    expect(nav.type).toBe('nav_tiles');
    expect(nav.items.length).toBe(7);
    expect(nav.items.map(i => i.key)).toContain('dining');
  });

  it('omits disabled shelves (new_this_week, product rail)', async () => {
    await seedLiveOffer();
    const res = await get(`/v1/follower/home?city=${CITY}`);
    const keys = res.body.data.sections.map(s => s.key);
    expect(keys).not.toContain('new_this_week');
    expect(keys).not.toContain('top_in:dining:products'); // top_by_sales seeded disabled
  });

  it('biggest_discounts ranks the live offer with a full 4-ID tracking block', async () => {
    const { offerId, infId } = await seedLiveOffer();
    const res = await get(`/v1/follower/home?city=${CITY}`);
    const shelf = byKey(res.body.data.sections, 'biggest_discounts');
    expect(shelf).toBeTruthy();
    const item = shelf.items.find(i => i.id === offerId);
    expect(item).toBeTruthy();
    expect(item.discount_value).toBe(25);
    expect(item.tracking).toBeTruthy();
    expect(item.tracking.oid).toBe(offerId);
    expect(item.tracking.iid).toBe(infId);
    expect(item.tracking.url).toContain(`/s/${HANDLE}`);
    expect(item.tracking.url).toContain(`oid=${offerId}`);
  });

  it('interpolates {city} into shelf titles', async () => {
    await seedLiveOffer();
    const res = await get(`/v1/follower/home?city=${CITY}`);
    const hot = byKey(res.body.data.sections, 'whats_hot');
    expect(hot.title).toBe("What's Hot in Vijayawada");
  });

  it('deals_ending_soon surfaces the offer expiring in 10 days', async () => {
    const { offerId } = await seedLiveOffer();
    const res = await get(`/v1/follower/home?city=${CITY}`);
    const shelf = byKey(res.body.data.sections, 'deals_ending_soon');
    expect(shelf.items.some(i => i.id === offerId)).toBe(true);
  });
});

// ── CATEGORY ─────────────────────────────────────────────────────────────────

describe('GET /v1/follower/section/category/:key', () => {
  it('returns the per-vertical template with a populated brand shelf', async () => {
    const { brandId } = await seedLiveOffer();
    const res = await get(`/v1/follower/section/category/dining?city=${CITY}`);
    expect(res.status).toBe(200);
    const popular = byKey(res.body.data.sections, 'popular_businesses');
    expect(popular.type).toBe('brands');
    expect(popular.items.some(i => i.id === brandId)).toBe(true);
  });
});

// ── OFFERS ───────────────────────────────────────────────────────────────────

describe('GET /v1/follower/section/offers', () => {
  it('returns the offers template incl all_offers', async () => {
    const { offerId } = await seedLiveOffer();
    const res = await get(`/v1/follower/section/offers?city=${CITY}`);
    expect(res.status).toBe(200);
    const all = byKey(res.body.data.sections, 'all_offers');
    expect(all).toBeTruthy();
    expect(all.items.some(i => i.id === offerId)).toBe(true);
  });
});

// ── CREATOR ──────────────────────────────────────────────────────────────────

describe('GET /v1/follower/section/creator/:handle', () => {
  it('returns the creator-store template populated for the creator', async () => {
    const { offerId } = await seedLiveOffer();
    const res = await get(`/v1/follower/section/creator/${HANDLE}`);
    expect(res.status).toBe(200);
    const promotes = byKey(res.body.data.sections, 'what_promotes');
    expect(promotes.items.some(i => i.id === offerId)).toBe(true);
  });

  it('404s on an unknown creator handle', async () => {
    const res = await get('/v1/follower/section/creator/nobody-here');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ── REGRESSION ───────────────────────────────────────────────────────────────

describe('regression — existing feeds unaffected', () => {
  it('GET /v1/follower/home-feed still returns 200', async () => {
    await seedLiveOffer();
    const res = await get(`/v1/follower/home-feed?city=${CITY}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
