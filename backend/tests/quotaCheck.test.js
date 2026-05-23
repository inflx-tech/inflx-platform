'use strict';

/**
 * quotaCheck.test.js — Phase A4 of the INFLX 3-Layer Revenue Model.
 *
 * Tests the per-action quota middleware:
 *   • Free-tier brand hits 422 QUOTA_EXCEEDED at exactly limit+1
 *   • Enterprise tier (-1) bypasses all quotas
 *   • Lazy-create of brand_subscriptions row on first quota check
 *   • Error payload shape {action, used, limit, current_tier, upgrade_to}
 *
 * Test brands are registered with factory `registerBrand` which auto-
 * upserts enterprise tier by default; quota-targeted tests downgrade
 * via setBrandTier(brand_id, 'free').
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query, pool } = require('./helpers/db');
const { createBrandUser, registerBrand, setBrandTier } = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
  // Re-seed subscription_tiers (admin-config preserved by truncateAll but
  // a prior test could have PATCHed values — reset to canonical seed).
  await query(`DELETE FROM subscription_tiers`);
  await query(
    `INSERT INTO subscription_tiers
       (tier_key, name, monthly_price_inr, max_campaigns, max_sets_per_campaign, max_influencers_per_cycle, max_products, is_enterprise, sort_order)
     VALUES
       ('free',       'Free',           0.00,  1,  1,   5,  10, false, 1),
       ('growth',     'Growth',      2499.00,  3,  3,  25, 100, false, 2),
       ('pro',        'Pro',         9999.00, 10, 10, 100, 500, false, 3),
       ('enterprise', 'Enterprise', 29999.00, -1, -1,  -1,  -1, true,  4)`
  );
});

// Per-worker pool cleanup is handled centrally by tests/jest.afterEnv.js.

// ── Free-tier product wall ───────────────────────────────────────────────────
describe('quotaCheck — createProduct on free tier (10-product wall)', () => {
  test('11th product → 422 QUOTA_EXCEEDED with rich payload', async () => {
    const u  = await createBrandUser();
    const br = await registerBrand(u.token);    // auto-enterprise
    await setBrandTier(br.id, 'free');           // downgrade to free for this test

    // Approve so requireApproved passes (factory leaves brand pending).
    await query(`UPDATE users SET status='approved' WHERE id=(SELECT user_id FROM brands WHERE id=$1)`, [br.id]);

    // Create 10 products — all should succeed.
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post('/v1/brands/me/products')
        .set('Authorization', `Bearer ${u.token}`)
        .send({ name: `Product ${i}`, price: 100, type: 'product' });
      expect(res.status).toBe(201);
    }

    // 11th must hit the wall.
    const res = await request(app)
      .post('/v1/brands/me/products')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'Product 11', price: 100, type: 'product' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
    expect(res.body.error.field).toBe('createProduct');
    expect(res.body.error.details).toBeDefined();
    expect(res.body.error.details.action).toBe('createProduct');
    expect(res.body.error.details.used).toBe(10);
    expect(res.body.error.details.limit).toBe(10);
    expect(res.body.error.details.current_tier).toBe('free');
    expect(res.body.error.details.upgrade_to).toEqual(expect.arrayContaining(['growth','pro','enterprise']));
  });
});

// ── Enterprise tier bypasses quotas ──────────────────────────────────────────
describe('quotaCheck — enterprise tier bypass', () => {
  test('12 products on enterprise → all succeed (limit = -1)', async () => {
    const u  = await createBrandUser();
    const br = await registerBrand(u.token); // default enterprise
    await query(`UPDATE users SET status='approved' WHERE id=(SELECT user_id FROM brands WHERE id=$1)`, [br.id]);

    for (let i = 1; i <= 12; i++) {
      const res = await request(app)
        .post('/v1/brands/me/products')
        .set('Authorization', `Bearer ${u.token}`)
        .send({ name: `Big Product ${i}`, price: 100, type: 'product' });
      expect(res.status).toBe(201);
    }

    const { rows } = await query(
      `SELECT COUNT(*)::int AS c FROM brand_products WHERE brand_id = $1`,
      [br.id]
    );
    expect(rows[0].c).toBe(12);
  });
});

// ── Lazy-create of brand_subscriptions on first quota check ──────────────────
describe('quotaCheck — lazy-create subscription row', () => {
  test('brand with no subscription gets a free row created on first quota check', async () => {
    const u  = await createBrandUser();
    const br = await registerBrand(u.token);
    // Wipe the auto-upserted enterprise sub so the lazy path fires.
    await query(`DELETE FROM brand_subscriptions WHERE brand_id = $1`, [br.id]);
    await query(`UPDATE users SET status='approved' WHERE id=(SELECT user_id FROM brands WHERE id=$1)`, [br.id]);

    const res = await request(app)
      .post('/v1/brands/me/products')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'First Product', price: 100, type: 'product' });
    expect(res.status).toBe(201);

    // A 'free' tier brand_subscriptions row now exists.
    const { rows } = await query(
      `SELECT t.tier_key, bs.status
         FROM brand_subscriptions bs
         JOIN subscription_tiers t ON t.id = bs.tier_id
        WHERE bs.brand_id = $1`,
      [br.id]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].tier_key).toBe('free');
    expect(rows[0].status).toBe('active');
  });
});
