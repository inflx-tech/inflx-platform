'use strict';

/**
 * Listing Engine — unit tests for listing.service.js + integration tests for new endpoints.
 *
 * Tests:
 *   - Schema loading and caching
 *   - Phase gating (active vs coming_soon)
 *   - Config accessors (card_config, action_types, quality_rules, listing_steps)
 *   - Super-categories
 *   - Quality score calculation
 *   - GET /brands/me/listing-config
 *   - GET /brands/me/quality-score
 *   - GET /brands/me/listing-preview
 *   - GET /follower/stories
 *   - GET /follower/categories
 *   - GET /category/:super_category/stores
 */

const request = require('supertest');
const app = require('../src/app');
const listingService = require('../src/services/listing.service');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  createFollowerUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');

// ── Unit tests (no DB needed) ────────────────────────────────────────────────

describe('Listing Service — Unit Tests', () => {
  beforeAll(() => {
    listingService.clearSchemaCache();
  });

  test('loadSchema returns restaurant config with new keys', () => {
    const schema = listingService.loadSchema('restaurant');
    expect(schema).toBeTruthy();
    expect(schema.category_key).toBe('restaurant');
    expect(schema.phase).toBe(1);
    expect(schema.status).toBe('active');
    expect(schema.card_config).toBeTruthy();
    expect(schema.card_config.accent).toBe('#dc2626');
    expect(schema.action_types).toBeTruthy();
    expect(schema.quality_rules).toBeInstanceOf(Array);
    expect(schema.listing_steps).toBeInstanceOf(Array);
    expect(schema.listing_steps.length).toBeGreaterThan(0);
  });

  test('loadSchema returns fashion_walkin config with new keys', () => {
    const schema = listingService.loadSchema('fashion_walkin');
    expect(schema.phase).toBe(1);
    expect(schema.status).toBe('active');
    expect(schema.card_config.accent).toBe('#f59e0b');
    expect(schema.super_category).toBe('shop');
  });

  test('loadSchema returns salon at phase 1 / active', () => {
    const schema = listingService.loadSchema('salon');
    expect(schema.phase).toBe(1);
    expect(schema.status).toBe('active');
    expect(schema.card_config).toBeTruthy();
  });

  test('loadSchema returns null for non-existent category', () => {
    const schema = listingService.loadSchema('unicorn_spa');
    expect(schema).toBeNull();
  });

  test('getActivePhaseCategories returns active-phase categories (phase <= LISTING_ENGINE_PHASE && active)', () => {
    const active = listingService.getActivePhaseCategories();
    expect(active.length).toBe(5);
    const keys = active.map(a => a.category_key).sort();
    expect(keys).toEqual(['car_rental', 'fashion', 'fashion_walkin', 'restaurant', 'salon']);
  });

  test('isCategoryActive returns true for active-phase categories, false for unknown', () => {
    expect(listingService.isCategoryActive('restaurant')).toBe(true);
    expect(listingService.isCategoryActive('fashion_walkin')).toBe(true);
    expect(listingService.isCategoryActive('salon')).toBe(true);
    expect(listingService.isCategoryActive('nonexistent')).toBe(false);
  });

  test('getCardConfig returns accent color for restaurant', () => {
    const config = listingService.getCardConfig('restaurant');
    expect(config).toBeTruthy();
    expect(config.accent).toBe('#dc2626');
    expect(config.cta_primary.label).toBe('Order Now');
    expect(config.icon).toBe('🍽️');
  });

  test('getActionTypes returns online_order for restaurant', () => {
    const actions = listingService.getActionTypes('restaurant');
    expect(actions.online_order).toBeTruthy();
    expect(actions.online_order.endpoint).toBe('/follower/orders');
    expect(actions.online_order.cart_scope).toBe('brand');
    expect(actions.online_order.min_order_value_field).toBe('min_order_value');
    expect(actions.online_order.delivery_fee_field).toBe('delivery_fee');
  });

  test('getQualityRules returns 13 rules for restaurant', () => {
    const rules = listingService.getQualityRules('restaurant');
    expect(rules.length).toBe(13);
    expect(rules[0].field).toBe('restaurant_description');
    expect(rules[0].points).toBe(5);
  });

  test('getListingSteps returns 9 steps for restaurant', () => {
    const steps = listingService.getListingSteps('restaurant');
    expect(steps.length).toBe(9);
    expect(steps[0].id).toBe('basics');
    expect(steps[1].id).toBe('location');
    expect(steps[2].id).toBe('hours');
  });

  test('getSuperCategories returns 7 categories', async () => {
    const cats = await listingService.getSuperCategories();
    expect(cats.length).toBe(7);
    expect(cats[0].key).toBe('eat');
    expect(cats[1].key).toBe('shop');
  });

  test('getSubCategories returns sub-categories for eat', () => {
    const subs = listingService.getSubCategories('eat');
    expect(subs.length).toBeGreaterThan(0);
    const keys = subs.map(s => s.category_key);
    expect(keys).toContain('restaurant');
  });

  test('all 10 schemas have card_config, action_types, quality_rules', () => {
    const schemas = ['restaurant', 'fashion_walkin', 'salon', 'bakery', 'florist',
      'packaged_food', 'car_rental', 'function_hall', 'wedding_planner', 'fashion_online'];
    for (const key of schemas) {
      const schema = listingService.loadSchema(key);
      expect(schema).toBeTruthy();
      expect(schema.card_config).toBeTruthy();
      expect(schema.action_types).toBeTruthy();
      expect(schema.quality_rules).toBeInstanceOf(Array);
      expect(schema.quality_rules.length).toBeGreaterThan(0);
      expect(typeof schema.phase).toBe('number');
    }
  });
});

// ── Integration tests (require DB) ──────────────────────────────────────────

describe('Listing Engine — Integration Tests', () => {
  let brandToken;
  let brandUser;
  let followerToken;

  beforeEach(async () => {
    await truncateAll();

    // Create and approve a restaurant brand
    const brandData = await createBrandUser();
    brandToken = brandData.token;
    brandUser = brandData.user;
    await registerBrand(brandToken, { business_name: 'Test Restaurant', category: 'restaurant' });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);

    // Create follower
    const followerData = await createFollowerUser();
    followerToken = followerData.token;
    await request(app)
      .post('/v1/followers/register')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ name: 'Test Follower', city: 'Vijayawada', state: 'AP' });
  });

  // ── Brand listing endpoints ──────────────────────────────────────────────

  test('GET /brands/me/listing-config returns full config', async () => {
    const res = await request(app)
      .get('/v1/brands/me/listing-config')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.config).toBeTruthy();
    expect(res.body.data.config.category_key).toBe('restaurant');
    expect(res.body.data.listing_engine_active).toBe(true);
    expect(res.body.data.config.listing_steps.length).toBe(9);
    expect(res.body.data.config.card_config.accent).toBe('#dc2626');
  });

  test('GET /brands/me/quality-score returns score with breakdown', async () => {
    const res = await request(app)
      .get('/v1/brands/me/quality-score')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.score).toBe('number');
    expect(res.body.data.breakdown).toBeInstanceOf(Array);
    expect(res.body.data.suggestions).toBeInstanceOf(Array);
  });

  test('GET /brands/me/listing-preview returns preview data', async () => {
    // Add a product first
    await request(app)
      .post('/v1/brands/me/products')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ name: 'Butter Chicken', price: 299, veg_flag: 'non_veg', section: 'Main Course' });

    const res = await request(app)
      .get('/v1/brands/me/listing-preview')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.brand).toBeTruthy();
    expect(res.body.data.card_config).toBeTruthy();
    expect(res.body.data.action_types).toBeTruthy();
    expect(res.body.data.quality_score).toBeTruthy();
    expect(res.body.data.products.length).toBe(1);
  });

  // ── Follower listing endpoints ───────────────────────────────────────────

  test('GET /follower/stories returns stories array', async () => {
    const res = await request(app)
      .get('/v1/follower/stories')
      .set('Authorization', `Bearer ${followerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stories).toBeInstanceOf(Array);
  });

  test('GET /follower/categories returns super-categories with deal counts', async () => {
    const res = await request(app)
      .get('/v1/follower/categories')
      .set('Authorization', `Bearer ${followerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.categories).toBeInstanceOf(Array);
    expect(res.body.data.categories.length).toBe(7);
    expect(res.body.data.categories[0].key).toBe('eat');
  });

  test('GET /category/:super_category/stores returns stores', async () => {
    const res = await request(app)
      .get('/v1/category/eat/stores')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.stores).toBeInstanceOf(Array);
    expect(res.body.data.super_category).toBeTruthy();
  });

  test('GET /category/unknown/stores returns 404', async () => {
    const res = await request(app)
      .get('/v1/category/unknown_cat/stores')
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  // ── Quality score improves with products ─────────────────────────────────

  test('Quality score increases when products are added', async () => {
    // Score before adding products
    const before = await request(app)
      .get('/v1/brands/me/quality-score')
      .set('Authorization', `Bearer ${brandToken}`);

    const scoreBefore = before.body.data.score;

    // Add 10 products — restaurant quality rule 9 (items:'menu_items',
    // min:10, +15pts) is the smallest product-credit threshold
    // (listing.service.js calculateQualityScore:246 productCount>=rule.min).
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/v1/brands/me/products')
        .set('Authorization', `Bearer ${brandToken}`)
        .send({ name: `Item ${i}`, price: 100 + i * 50, veg_flag: 'veg', section: 'Starters' });
    }

    // Score after
    const after = await request(app)
      .get('/v1/brands/me/quality-score')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(after.body.data.score).toBeGreaterThan(scoreBefore);
  });
});
