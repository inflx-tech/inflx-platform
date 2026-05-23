'use strict';

/**
 * subscription.test.js — Phase A6 of the INFLX 3-Layer Revenue Model.
 *
 * Tests:
 *   • GET  /v1/subscription-tiers (public)
 *   • GET  /v1/brands/me/subscription
 *   • POST /v1/brands/me/subscription/upgrade   (RAZORPAY_MOCK=true path)
 *   • GET  /v1/brands/me/billing/invoices
 *   • subscription-renewal.job — picks due rows, advances cycle
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand } = require('./helpers/factories');
const { subscriptionRenewalJob } = require('../src/jobs');

beforeEach(async () => {
  await truncateAll();
  // subscription_tiers seed preservation pattern (canonical reset)
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

describe('GET /v1/subscription-tiers (public)', () => {
  test('returns the 4 seeded tiers', async () => {
    const res = await request(app).get('/v1/subscription-tiers');
    expect(res.status).toBe(200);
    expect(res.body.data.tiers.length).toBe(4);
    const keys = res.body.data.tiers.map(t => t.tier_key);
    expect(keys).toEqual(['free', 'growth', 'pro', 'enterprise']);
  });
});

describe('POST /v1/brands/me/subscription/upgrade (RAZORPAY_MOCK)', () => {
  test('upgrades to growth — activates sub + writes paid invoice', async () => {
    const u  = await createBrandUser();
    const br = await registerBrand(u.token); // factory auto-upserts enterprise; we'll overwrite

    const res = await request(app)
      .post('/v1/brands/me/subscription/upgrade')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ tier_key: 'growth' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('activated');
    expect(res.body.data.mode).toBe('mock');
    expect(res.body.data.tier_key).toBe('growth');
    expect(res.body.data.amount_inr).toBe(2499);
    // 18% GST on 2499 = 449.82
    expect(res.body.data.gst_amount_inr).toBeCloseTo(449.82, 2);
    expect(res.body.data.total_inr).toBeCloseTo(2948.82, 2);

    // DB: prior 'enterprise' (factory auto-upsert) cancelled; new 'growth' active
    const { rows: subs } = await query(
      `SELECT bs.status, t.tier_key
         FROM brand_subscriptions bs
         JOIN subscription_tiers t ON t.id = bs.tier_id
        WHERE bs.brand_id = $1
        ORDER BY bs.created_at`,
      [br.id]
    );
    expect(subs.length).toBe(2);
    expect(subs[0].status).toBe('cancelled');
    expect(subs[1].status).toBe('active');
    expect(subs[1].tier_key).toBe('growth');

    // DB: paid invoice row
    const { rows: invs } = await query(
      `SELECT amount_inr, gst_amount_inr, total_inr, status, tier_key
         FROM subscription_invoices WHERE brand_id = $1`,
      [br.id]
    );
    expect(invs.length).toBe(1);
    expect(invs[0].status).toBe('paid');
    expect(invs[0].tier_key).toBe('growth');
    expect(parseFloat(invs[0].amount_inr)).toBe(2499);
    expect(parseFloat(invs[0].total_inr)).toBeCloseTo(2948.82, 2);
  });

  test('rejects unknown tier_key with 404', async () => {
    const u  = await createBrandUser();
    await registerBrand(u.token);

    const res = await request(app)
      .post('/v1/brands/me/subscription/upgrade')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ tier_key: 'rocket_man' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /v1/brands/me/subscription', () => {
  test('returns the active subscription + usage counters', async () => {
    const u  = await createBrandUser();
    const br = await registerBrand(u.token); // enterprise via factory

    const res = await request(app)
      .get('/v1/brands/me/subscription')
      .set('Authorization', `Bearer ${u.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.subscription).toBeTruthy();
    expect(res.body.data.subscription.tier_key).toBe('enterprise');
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.body.data.usage).toEqual({
      campaigns: 0, products: 0, influencer_invites_this_cycle: 0,
    });
  });
});

describe('subscription-renewal.job (RAZORPAY_MOCK)', () => {
  test('renews a due active subscription — writes paid invoice + advances cycle', async () => {
    const u  = await createBrandUser();
    const br = await registerBrand(u.token, { tier: 'growth' });

    // Backdate the sub so next_charge_at is in the past
    await query(
      `UPDATE brand_subscriptions
          SET current_cycle_start = current_date - 30,
              current_cycle_end   = current_date,
              next_charge_at      = current_date - 1
        WHERE brand_id = $1 AND status = 'active'`,
      [br.id]
    );

    const result = await subscriptionRenewalJob.run();
    expect(result.renewed).toBe(1);
    expect(result.failed).toBe(0);

    // New invoice written; sub cycle advanced
    const { rows: invs } = await query(
      `SELECT status, amount_inr, tier_key FROM subscription_invoices
        WHERE brand_id = $1 ORDER BY created_at DESC`,
      [br.id]
    );
    expect(invs.length).toBe(1);
    expect(invs[0].status).toBe('paid');
    expect(invs[0].tier_key).toBe('growth');
    expect(parseFloat(invs[0].amount_inr)).toBe(2499);

    const { rows: subs } = await query(
      `SELECT next_charge_at, last_charged_at FROM brand_subscriptions
        WHERE brand_id = $1 AND status = 'active'`,
      [br.id]
    );
    expect(new Date(subs[0].next_charge_at) > new Date()).toBe(true);
    expect(subs[0].last_charged_at).not.toBeNull();
  });

  test('no due rows → 0 renewed', async () => {
    const u  = await createBrandUser();
    await registerBrand(u.token); // enterprise; next_charge_at = today+30 by default

    const result = await subscriptionRenewalJob.run();
    expect(result.renewed).toBe(0);
  });
});
