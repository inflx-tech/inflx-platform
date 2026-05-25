'use strict';

/**
 * features + entitlements — Phase A10 backend tests.
 *
 * Covers:
 *   • features CRUD (admin endpoints)
 *   • tier_features upsert (bulk)
 *   • subscription_prices CRUD
 *   • entitlements service (getEntitlements, hasFeature, quotaFor)
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query, pool } = require('./helpers/db');
const { createBrandUser, registerBrand, createAdminUser } = require('./helpers/factories');
const entitlements = require('../src/services/entitlements.service');

beforeEach(async () => {
  await truncateAll();
  entitlements.bustCatalogCache();

  // Reset features catalog + tier_features + subscription_prices to seed values.
  // (truncateAll skips these admin-config tables; we reset explicitly so
  // each test starts from a known catalog.)
  await query(`DELETE FROM tier_features`);
  await query(`DELETE FROM subscription_prices`);
  await query(`DELETE FROM features`);
  await query(`DELETE FROM subscription_tiers`);
  await query(
    `INSERT INTO subscription_tiers
       (tier_key, name, monthly_price_inr, max_campaigns, max_sets_per_campaign, max_influencers_per_cycle, max_products, is_enterprise, sort_order)
     VALUES
       ('free',   'Free',       0.00, 1, 1,  5,  10, false, 1),
       ('growth', 'Growth',  2499.00, 3, 3, 25, 100, false, 2),
       ('pro',    'Pro',     9999.00, 10, 10, 100, 500, false, 3)`
  );
  await query(
    `INSERT INTO features (feature_key, label, category, feature_type, default_quota, sort_order, description) VALUES
       ('bulk_outreach',  'Bulk outreach',  'influencer', 'boolean', NULL, 1, 'test feature'),
       ('active_campaigns','Active campaigns','campaigns','quota',   1,    2, 'test feature'),
       ('discover_filter','Discover filter','influencer','config',  NULL, 3, 'test feature')`
  );
});

afterAll(async () => { await pool.end().catch(() => {}); });

describe('admin /v1/admin/features', () => {
  test('GET lists catalog rows', async () => {
    const admin = await createAdminUser('superadmin');
    const res = await request(app).get('/v1/admin/features').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.features).toHaveLength(3);
  });

  test('POST creates a new feature (superadmin)', async () => {
    const admin = await createAdminUser('superadmin');
    const res = await request(app).post('/v1/admin/features')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ feature_key: 'new_test_feature', label: 'New', category: 'support', feature_type: 'boolean' });
    expect(res.status).toBe(201);
    expect(res.body.data.feature.feature_key).toBe('new_test_feature');
  });

  test('POST rejects invalid slug', async () => {
    const admin = await createAdminUser('superadmin');
    const res = await request(app).post('/v1/admin/features')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ feature_key: 'Bad-Slug', label: 'x', category: 'support', feature_type: 'boolean' });
    expect(res.status).toBe(422);
  });

  test('PATCH updates label + is_enforced', async () => {
    const admin = await createAdminUser('superadmin');
    const res = await request(app).patch('/v1/admin/features/bulk_outreach')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ label: 'Bulk Outreach v2', is_enforced: true });
    expect(res.status).toBe(200);
    expect(res.body.data.feature.label).toBe('Bulk Outreach v2');
    expect(res.body.data.feature.is_enforced).toBe(true);
  });

  test('non-admin GET returns 403', async () => {
    const brand = await createBrandUser();
    const res = await request(app).get('/v1/admin/features').set('Authorization', `Bearer ${brand.token}`);
    expect(res.status).toBe(403);
  });
});

describe('admin /v1/admin/tiers/:tier_key/features', () => {
  test('GET returns all catalog features with per-tier inclusion', async () => {
    const admin = await createAdminUser('superadmin');
    const res = await request(app).get('/v1/admin/tiers/free/features').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.features).toHaveLength(3);
    // No tier_features rows yet → included=false for all
    expect(res.body.data.features.every(f => f.included === false)).toBe(true);
  });

  test('PUT bulk upsert includes features + quotas + config', async () => {
    const admin = await createAdminUser('superadmin');
    const res = await request(app).put('/v1/admin/tiers/growth/features')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ items: [
        { feature_key: 'bulk_outreach',    included: true },
        { feature_key: 'active_campaigns', included: true, quota_value: 3 },
        { feature_key: 'discover_filter',  included: true, config: { area_scope: 'state', niches_limit: 10 } },
      ] });
    expect(res.status).toBe(200);
    // Verify persistence
    const get = await request(app).get('/v1/admin/tiers/growth/features').set('Authorization', `Bearer ${admin.token}`);
    const m = Object.fromEntries(get.body.data.features.map(f => [f.feature_key, f]));
    expect(m.bulk_outreach.included).toBe(true);
    expect(parseFloat(m.active_campaigns.quota_value)).toBe(3);
    expect(m.discover_filter.config.area_scope).toBe('state');
  });
});

describe('admin /v1/admin/tiers/:tier_key/prices', () => {
  test('POST creates monthly price', async () => {
    const admin = await createAdminUser('superadmin');
    const res = await request(app).post('/v1/admin/tiers/growth/prices')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ billing_period: 'monthly', price_inr: 2499 });
    expect(res.status).toBe(201);
    expect(res.body.data.price.billing_period).toBe('monthly');
    expect(parseFloat(res.body.data.price.price_inr)).toBe(2499);
  });

  test('POST upserts on conflict (tier + period unique)', async () => {
    const admin = await createAdminUser('superadmin');
    await request(app).post('/v1/admin/tiers/growth/prices')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ billing_period: 'monthly', price_inr: 2499 });
    const res = await request(app).post('/v1/admin/tiers/growth/prices')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ billing_period: 'monthly', price_inr: 2999 });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.price.price_inr)).toBe(2999);
  });
});

describe('entitlements.service', () => {
  test('getEntitlements returns map keyed by feature_key', async () => {
    const bu = await createBrandUser();
    const br = await registerBrand(bu.token);
    const r = await entitlements.getEntitlements(pool, br.id);
    expect(r.tier_key).toBe('free'); // lazy default
    expect(r.entitlements.has('bulk_outreach')).toBe(true);
    expect(r.entitlements.get('bulk_outreach').included).toBe(false); // no tier_features row
  });

  test('included = true after upsert', async () => {
    const bu = await createBrandUser();
    const br = await registerBrand(bu.token);
    // Lazy-create active subscription on growth tier so the brand's effective tier is growth
    const { rows: tierRows } = await query(`SELECT id FROM subscription_tiers WHERE tier_key='growth'`);
    await query(`INSERT INTO brand_subscriptions (brand_id, tier_id, status, current_cycle_start, current_cycle_end) VALUES ($1, $2, 'active', current_date, current_date + 30)`, [br.id, tierRows[0].id]);
    // Mark bulk_outreach as included on growth
    const { rows: fRows } = await query(`SELECT id FROM features WHERE feature_key='bulk_outreach'`);
    await query(`INSERT INTO tier_features (tier_id, feature_id, included) VALUES ($1, $2, true)`, [tierRows[0].id, fRows[0].id]);
    entitlements.bustCatalogCache();
    const r = await entitlements.getEntitlements(pool, br.id);
    expect(r.tier_key).toBe('growth');
    expect(r.entitlements.get('bulk_outreach').included).toBe(true);
  });

  test('hasFeature returns true for non-enforced features (display-only)', async () => {
    const bu = await createBrandUser();
    const br = await registerBrand(bu.token);
    // is_enforced is false by default → hasFeature should return true regardless of tier_features
    const r = await entitlements.hasFeature(pool, br.id, 'bulk_outreach');
    expect(r).toBe(true);
  });

  test('hasFeature respects is_enforced + included when wired', async () => {
    const bu = await createBrandUser();
    const br = await registerBrand(bu.token);
    // Mark feature enforced. Brand has no tier_features row → not included.
    await query(`UPDATE features SET is_enforced = true WHERE feature_key = 'bulk_outreach'`);
    entitlements.bustCatalogCache();
    const r = await entitlements.hasFeature(pool, br.id, 'bulk_outreach');
    expect(r).toBe(false);
  });
});
