'use strict';

/**
 * pricing.service — Phase A3 (L1 + L3 + classifyPath).
 *
 * Covers:
 *   • _normalizeCategoryKey aliasing
 *   • computeL1Renewal — active sub vs no sub
 *   • classifyPath — direct / influencer_direct / influencer_attributed
 *   • computeL3OnFollowerTxn — salon Path A/B/C, fallback to brand legacy %
 *   • Glow Studio walkthrough reconciliation slice
 */

const { truncateAll, query, pool } = require('./helpers/db');
const { createBrandUser, registerBrand, createInfluencerUser } = require('./helpers/factories');
const pricingService = require('../src/services/pricing.service');

beforeEach(async () => {
  await truncateAll();
  pricingService.bustEscrowTierCache();
  pricingService.bustCategoryCache();
  // Reset categories to canonical seed so admin-config drift across files
  // can't leak — same pattern as escrow-fee-tiers.test.js.
  await query(`DELETE FROM categories`);
  await query(
    `INSERT INTO categories (category_key, name, label, path_a_pct, path_b_pct, path_c_pct, sort_order) VALUES
       ('salon_beauty','salon_beauty','Salon & Beauty', 9.00, 5.00, 7.00, 1),
       ('restaurant',  'restaurant',  'Restaurant',     8.00, 4.00, 6.00, 2),
       ('fashion',     'fashion',     'Fashion',       10.00, 5.00, 7.00, 3),
       ('car_rental',  'car_rental',  'Car Rental',     8.00, 4.00, 6.00, 4)`
  );
  // Reset subscription_tiers (same admin-config preservation pattern)
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

// Per-worker pool cleanup is handled centrally by tests/jest.afterEnv.js
// (guarded against re-entry). No file-local afterAll needed.

// ── _normalizeCategoryKey (pure) ──────────────────────────────────────────────
describe('pricing.service._normalizeCategoryKey — alias normalization', () => {
  test('salon → salon_beauty', () => {
    expect(pricingService._normalizeCategoryKey('salon')).toBe('salon_beauty');
  });
  test('SALON → salon_beauty (case-insensitive)', () => {
    expect(pricingService._normalizeCategoryKey('SALON')).toBe('salon_beauty');
  });
  test('fashion_walkin → fashion', () => {
    expect(pricingService._normalizeCategoryKey('fashion_walkin')).toBe('fashion');
  });
  test('fashion_online → fashion', () => {
    expect(pricingService._normalizeCategoryKey('fashion_online')).toBe('fashion');
  });
  test('restaurant → restaurant (direct match)', () => {
    expect(pricingService._normalizeCategoryKey('restaurant')).toBe('restaurant');
  });
  test('null → null', () => {
    expect(pricingService._normalizeCategoryKey(null)).toBe(null);
  });
  test('undefined → null', () => {
    expect(pricingService._normalizeCategoryKey(undefined)).toBe(null);
  });
  test('unknown value passes through (caller decides)', () => {
    expect(pricingService._normalizeCategoryKey('mystery_box')).toBe('mystery_box');
  });
});

// ── computeL1Renewal ──────────────────────────────────────────────────────────
describe('pricing.service.computeL1Renewal', () => {
  test('brand with no subscription → ₹0 / free / no_subscription', async () => {
    const u  = await createBrandUser();
    const br = await registerBrand(u.token);
    const r  = await pricingService.computeL1Renewal(br.id);
    expect(r.amount_inr).toBe(0);
    expect(r.tier_key).toBe('free');
    expect(r.source).toBe('no_subscription');
  });

  test('brand with active growth subscription → ₹2499 / growth / active_subscription', async () => {
    const u  = await createBrandUser();
    const br = await registerBrand(u.token);
    const { rows: tierRows } = await query(
      `SELECT id FROM subscription_tiers WHERE tier_key = 'growth'`
    );
    await query(
      `INSERT INTO brand_subscriptions
         (brand_id, tier_id, status, current_cycle_start, current_cycle_end)
       VALUES ($1, $2, 'active', current_date, current_date + 30)`,
      [br.id, tierRows[0].id]
    );
    const r = await pricingService.computeL1Renewal(br.id);
    expect(r.amount_inr).toBe(2499);
    expect(r.tier_key).toBe('growth');
    expect(r.source).toBe('active_subscription');
  });

  test('cancelled subscription → ₹0 (no active row)', async () => {
    const u  = await createBrandUser();
    const br = await registerBrand(u.token);
    const { rows: tierRows } = await query(
      `SELECT id FROM subscription_tiers WHERE tier_key = 'pro'`
    );
    await query(
      `INSERT INTO brand_subscriptions
         (brand_id, tier_id, status, current_cycle_start, current_cycle_end, cancelled_at)
       VALUES ($1, $2, 'cancelled', current_date - 60, current_date - 30, now())`,
      [br.id, tierRows[0].id]
    );
    const r = await pricingService.computeL1Renewal(br.id);
    expect(r.amount_inr).toBe(0);
    expect(r.source).toBe('no_subscription');
  });
});

// ── classifyPath ──────────────────────────────────────────────────────────────
describe('pricing.service.classifyPath', () => {
  async function setupBrandFollowerInfluencer() {
    const bu  = await createBrandUser();
    const br  = await registerBrand(bu.token);
    const fu  = await createBrandUser({ role: 'follower' }).catch(() => null); // safe-no-op if signature differs
    // Use raw INSERT to avoid factory drift — only follower_id + brand_id matter here.
    const { rows: fRows } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919000000010','follower','TestFollower','approved')
       RETURNING id`
    );
    const { rows: frRows } = await query(
      `INSERT INTO followers (user_id) VALUES ($1) RETURNING id`,
      [fRows[0].id]
    );
    const { rows: iuRows } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919000000020','influencer','TestInfluencer','approved')
       RETURNING id`
    );
    const { rows: irRows } = await query(
      `INSERT INTO influencers (user_id, instagram_handle) VALUES ($1, 'testhandle') RETURNING id`,
      [iuRows[0].id]
    );
    return { brand_id: br.id, follower_id: frRows[0].id, influencer_id: irRows[0].id };
  }

  test('no CI + no attribution → direct / influencer_id null', async () => {
    const { brand_id, follower_id } = await setupBrandFollowerInfluencer();
    const r = await pricingService.classifyPath(pool, {
      followerId: follower_id, brandId: brand_id, campaignInfluencerId: null,
    });
    expect(r.path).toBe('direct');
    expect(r.influencer_id).toBe(null);
  });

  test('no CI + active attribution → influencer_attributed', async () => {
    const { brand_id, follower_id, influencer_id } = await setupBrandFollowerInfluencer();
    await query(
      `INSERT INTO attribution_clicks (follower_id, influencer_id, brand_id, expires_at)
       VALUES ($1, $2, $3, now() + interval '30 days')`,
      [follower_id, influencer_id, brand_id]
    );
    const r = await pricingService.classifyPath(pool, {
      followerId: follower_id, brandId: brand_id, campaignInfluencerId: null,
    });
    expect(r.path).toBe('influencer_attributed');
    expect(r.influencer_id).toBe(influencer_id);
  });

  test('no CI + expired attribution → direct', async () => {
    const { brand_id, follower_id, influencer_id } = await setupBrandFollowerInfluencer();
    await query(
      `INSERT INTO attribution_clicks (follower_id, influencer_id, brand_id, expires_at)
       VALUES ($1, $2, $3, now() - interval '1 day')`,
      [follower_id, influencer_id, brand_id]
    );
    const r = await pricingService.classifyPath(pool, {
      followerId: follower_id, brandId: brand_id, campaignInfluencerId: null,
    });
    expect(r.path).toBe('direct');
    expect(r.influencer_id).toBe(null);
  });
});

// ── computeL3OnFollowerTxn ────────────────────────────────────────────────────
describe('pricing.service.computeL3OnFollowerTxn — Glow Studio walkthrough', () => {
  async function setupGlowStudio() {
    const bu  = await createBrandUser();
    const br  = await registerBrand(bu.token, { category: 'salon' });    // brand registers as 'salon'
    const { rows: fRows } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919000000011','follower','Anita','approved')
       RETURNING id`
    );
    const { rows: frRows } = await query(
      `INSERT INTO followers (user_id) VALUES ($1) RETURNING id`,
      [fRows[0].id]
    );
    const { rows: iuRows } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919000000021','influencer','Divya','approved')
       RETURNING id`
    );
    const { rows: irRows } = await query(
      `INSERT INTO influencers (user_id, instagram_handle) VALUES ($1, 'divya') RETURNING id`,
      [iuRows[0].id]
    );
    return { brand_id: br.id, follower_id: frRows[0].id, influencer_id: irRows[0].id };
  }

  test('Path B salon, ₹2000 → 5% = ₹100 (Day-8 Anita books via Divya click)', async () => {
    const { brand_id, follower_id, influencer_id } = await setupGlowStudio();
    // Create a minimal campaign_influencer row so classifyPath can resolve the influencer
    const { rows: cRows } = await query(
      `INSERT INTO campaigns (brand_id, name, status, goal, start_date, end_date)
       VALUES ($1, 'Diwali Glow Up', 'active', 'conversion', current_date, current_date + 30)
       RETURNING id`,
      [brand_id]
    );
    const { rows: csRows } = await query(
      `INSERT INTO campaign_sets (campaign_id, goal) VALUES ($1, 'conversion') RETURNING id`,
      [cRows[0].id]
    );
    const { rows: ciRows } = await query(
      `INSERT INTO campaign_influencers (campaign_id, set_id, influencer_id, status)
       VALUES ($1, $2, $3, 'contracted') RETURNING id`,
      [cRows[0].id, csRows[0].id, influencer_id]
    );
    const r = await pricingService.computeL3OnFollowerTxn({
      client: pool, brandId: brand_id, followerId: follower_id,
      campaignInfluencerId: ciRows[0].id, brandCategory: 'salon', netAmount: 2000,
    });
    expect(r.path).toBe('influencer_direct');
    expect(r.fee_pct).toBe(5);
    expect(r.fee_amount).toBe(100);
    expect(r.category_key).toBe('salon_beauty');
    expect(r.source).toBe('category_lookup');
    expect(r.influencer_id).toBe(influencer_id);
  });

  test('Path C salon, ₹3000 → 7% = ₹210 (Day-30 Anita books direct but attribution active)', async () => {
    const { brand_id, follower_id, influencer_id } = await setupGlowStudio();
    await query(
      `INSERT INTO attribution_clicks (follower_id, influencer_id, brand_id, expires_at)
       VALUES ($1, $2, $3, now() + interval '7 days')`,
      [follower_id, influencer_id, brand_id]
    );
    const r = await pricingService.computeL3OnFollowerTxn({
      client: pool, brandId: brand_id, followerId: follower_id,
      campaignInfluencerId: null, brandCategory: 'salon', netAmount: 3000,
    });
    expect(r.path).toBe('influencer_attributed');
    expect(r.fee_pct).toBe(7);
    expect(r.fee_amount).toBe(210);
    expect(r.category_key).toBe('salon_beauty');
    expect(r.influencer_id).toBe(influencer_id);
  });

  test('Path A salon, ₹1500 → 9% = ₹135 (Day-32 Rahul direct buy, no attribution)', async () => {
    const { brand_id, follower_id } = await setupGlowStudio();
    const r = await pricingService.computeL3OnFollowerTxn({
      client: pool, brandId: brand_id, followerId: follower_id,
      campaignInfluencerId: null, brandCategory: 'salon', netAmount: 1500,
    });
    expect(r.path).toBe('direct');
    expect(r.fee_pct).toBe(9);
    expect(r.fee_amount).toBe(135);
    expect(r.category_key).toBe('salon_beauty');
    expect(r.influencer_id).toBe(null);
  });

  test('unknown category → brand_legacy_fallback to brands.platform_fee_pct', async () => {
    const bu  = await createBrandUser();
    const br  = await registerBrand(bu.token, { category: 'space_station' });
    const { rows: fRows } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919000000012','follower','Test','approved')
       RETURNING id`
    );
    const { rows: frRows } = await query(
      `INSERT INTO followers (user_id) VALUES ($1) RETURNING id`,
      [fRows[0].id]
    );
    const r = await pricingService.computeL3OnFollowerTxn({
      client: pool, brandId: br.id, followerId: frRows[0].id,
      campaignInfluencerId: null, brandCategory: 'space_station', netAmount: 1000,
    });
    expect(r.source).toBe('brand_legacy_fallback');
    expect(r.category_key).toBe(null);
    // brands.platform_fee_pct defaults to 8 (M001 schema)
    expect(r.fee_pct).toBe(8);
    expect(r.fee_amount).toBe(80);
  });
});
