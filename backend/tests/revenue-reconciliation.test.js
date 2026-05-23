'use strict';

/**
 * revenue-reconciliation.test.js — Phase A8.
 *
 * The Glow Studio month-1 walkthrough end-to-end. Proves the 3-layer
 * model produces the exact INFLX revenue total from the brief:
 *
 *   L1 SaaS subscription (Growth ₹2,499)            =  2,499
 *   L2 escrow fee (₹50k engagement @ 3%)            =  1,500
 *   L2 escrow fee (₹5k hybrid    @ 3%)              =    150
 *   L3 Path B salon (₹2k Anita day-8)               =    100   (5%)
 *   L3 Path B salon (₹50k bride day-28)             =  2,500   (5%)
 *   L3 Path C salon (₹3k Anita day-30 attributed)   =    210   (7%)
 *   L3 Path A salon (₹1.5k Rahul day-32 direct)     =    135   (9%)
 *   ───────────────────────────────────────────────────────────
 *   Month-1 INFLX revenue total                     =  7,094
 *
 * Direct service-level reconciliation — no HTTP round-trips needed
 * for the math (each layer is independently endpoint-tested in earlier
 * phases). This is the gross-check that all three layers compose.
 */

const { truncateAll, query, pool } = require('./helpers/db');
const pricingService = require('../src/services/pricing.service');

beforeEach(async () => {
  await truncateAll();
  pricingService.bustEscrowTierCache();
  pricingService.bustCategoryCache();

  // Canonical reseed of admin-config tables (preserves across files)
  await query(`DELETE FROM categories`);
  await query(
    `INSERT INTO categories (category_key, name, label, path_a_pct, path_b_pct, path_c_pct, sort_order) VALUES
       ('salon_beauty','salon_beauty','Salon & Beauty', 9.00, 5.00, 7.00, 1)`
  );
  await query(`DELETE FROM subscription_tiers`);
  await query(
    `INSERT INTO subscription_tiers
       (tier_key, name, monthly_price_inr, max_campaigns, max_sets_per_campaign, max_influencers_per_cycle, max_products, is_enterprise, sort_order)
     VALUES
       ('free',   'Free',       0.00, 1, 1,  5,  10, false, 1),
       ('growth', 'Growth',  2499.00, 3, 3, 25, 100, false, 2)`
  );

  // escrow_fee_tiers exist from M037 — reset to canonical bands.
  pricingService.bustEscrowTierCache();
  await query(`DELETE FROM escrow_fee_tiers`);
  await query(
    `INSERT INTO escrow_fee_tiers (tier_key, min_amount_inr, max_amount_inr, fee_pct, description, sort_order)
     VALUES
       ('small', 0,       500000,  3.00, 'Below ₹5L', 1),
       ('mid',   500001,  2500000, 2.00, '₹5-25L',     2),
       ('large', 2500001, NULL,    1.00, 'Above ₹25L', 3)`
  );
});

describe('Glow Studio month-1 walkthrough — INFLX revenue = ₹7,094', () => {
  test('three layers compose to the locked total', async () => {
    // ── Setup ─────────────────────────────────────────────────────
    const { rows: bRows } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919800001000','brand','Priya','approved') RETURNING id`
    );
    const { rows: brandRows } = await query(
      `INSERT INTO brands (user_id, business_name, category, address_line, pincode, platform_fee_pct)
       VALUES ($1, 'Glow Studio', 'salon', '5 MG Rd', '560001', 8.00) RETURNING id`,
      [bRows[0].id]
    );
    const brandId = brandRows[0].id;

    const { rows: iRows } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919800001001','influencer','Divya','approved') RETURNING id`
    );
    const { rows: influencerRows } = await query(
      `INSERT INTO influencers (user_id, instagram_handle) VALUES ($1, 'divya') RETURNING id`,
      [iRows[0].id]
    );
    const influencerId = influencerRows[0].id;

    const { rows: a_uRows } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919800001010','follower','Anita','approved') RETURNING id`
    );
    const { rows: aRows } = await query(
      `INSERT INTO followers (user_id) VALUES ($1) RETURNING id`,
      [a_uRows[0].id]
    );
    const anitaId = aRows[0].id;

    const { rows: r_uRows } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919800001011','follower','Rahul','approved') RETURNING id`
    );
    const { rows: rRows } = await query(
      `INSERT INTO followers (user_id) VALUES ($1) RETURNING id`,
      [r_uRows[0].id]
    );
    const rahulId = rRows[0].id;

    // Campaign + set + CI for Path B transactions
    const { rows: cRows } = await query(
      `INSERT INTO campaigns (brand_id, name, status, start_date, end_date)
       VALUES ($1, 'Diwali Glow Up', 'active', current_date, current_date + 30) RETURNING id`,
      [brandId]
    );
    const campaignId = cRows[0].id;
    const { rows: csRows } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal) VALUES ($1, 'Set 1', 'conversion') RETURNING id`,
      [campaignId]
    );
    const setId = csRows[0].id;
    const { rows: ciRows } = await query(
      `INSERT INTO campaign_influencers (campaign_id, set_id, influencer_id, status, commission_pct)
       VALUES ($1, $2, $3, 'contracted', 10.00) RETURNING id`,
      [campaignId, setId, influencerId]
    );
    const ciId = ciRows[0].id;

    // ── L1: Brand upgrades to Growth on Day 12 ─────────────────────
    const { rows: gRows } = await query(
      `SELECT id FROM subscription_tiers WHERE tier_key='growth'`
    );
    const { rows: sRows } = await query(
      `INSERT INTO brand_subscriptions
         (brand_id, tier_id, status, current_cycle_start, current_cycle_end, mandate_status)
       VALUES ($1, $2, 'active', current_date, current_date + 30, 'active') RETURNING id`,
      [brandId, gRows[0].id]
    );
    await query(
      `INSERT INTO subscription_invoices
         (brand_subscription_id, brand_id, tier_key, amount_inr, gst_amount_inr,
          period_start, period_end, status, paid_at, razorpay_payment_id)
       VALUES ($1, $2, 'growth', 2499.00, 449.82, current_date, current_date + 30, 'paid', now(), 'pay_mock_day12')`,
      [sRows[0].id, brandId]
    );
    // L1 contribution = ₹2,499
    const l1Renewal = await pricingService.computeL1Renewal(brandId);
    expect(l1Renewal.amount_inr).toBe(2499);
    expect(l1Renewal.tier_key).toBe('growth');

    // ── L2: Day 15 engagement campaign ₹50k → 3% bracket → ₹1,500 ─
    const { rows: e1Rows } = await query(
      `INSERT INTO campaigns (brand_id, name, status, start_date, end_date)
       VALUES ($1, 'New Year Look', 'active', current_date, current_date + 60) RETURNING id`,
      [brandId]
    );
    await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, set_budget)
       VALUES ($1, 'NewYearSet', 'engagement', 50000.00)`,
      [e1Rows[0].id]
    );
    const l2_50k = await pricingService.lockEscrowFeeAtPublish(pool, e1Rows[0].id, brandId);
    expect(l2_50k.fee_pct).toBe(3);
    expect(l2_50k.base_inr).toBe(50000);
    expect(parseFloat((l2_50k.base_inr * l2_50k.fee_pct / 100).toFixed(2))).toBe(1500);

    // ── L2: Day 25 hybrid campaign ₹5k → 3% → ₹150 ─────────────────
    const { rows: e2Rows } = await query(
      `INSERT INTO campaigns (brand_id, name, status, start_date, end_date)
       VALUES ($1, 'Bridal Special', 'active', current_date, current_date + 60) RETURNING id`,
      [brandId]
    );
    await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, set_budget)
       VALUES ($1, 'BridalSet', 'hybrid', 5000.00)`,
      [e2Rows[0].id]
    );
    const l2_5k = await pricingService.lockEscrowFeeAtPublish(pool, e2Rows[0].id, brandId);
    expect(l2_5k.fee_pct).toBe(3);
    expect(parseFloat((l2_5k.base_inr * l2_5k.fee_pct / 100).toFixed(2))).toBe(150);

    // ── L3 Path B salon: Anita ₹2,000 day-8 → 5% → ₹100 ────────────
    const l3_anita_day8 = await pricingService.computeL3OnFollowerTxn({
      client: pool, brandId, followerId: anitaId,
      campaignInfluencerId: ciId, brandCategory: 'salon', netAmount: 2000,
    });
    expect(l3_anita_day8.path).toBe('influencer_direct');
    expect(l3_anita_day8.fee_amount).toBe(100);

    // Path B opens a 30-day attribution row (this is what the controller does)
    await query(
      `INSERT INTO attribution_clicks (follower_id, influencer_id, brand_id, campaign_id, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '30 days')`,
      [anitaId, influencerId, brandId, campaignId]
    );

    // ── L3 Path B salon: bride ₹50,000 day-28 → 5% → ₹2,500 ────────
    // (Reuse Anita as the booking follower for test simplicity)
    const l3_bride_day28 = await pricingService.computeL3OnFollowerTxn({
      client: pool, brandId, followerId: anitaId,
      campaignInfluencerId: ciId, brandCategory: 'salon', netAmount: 50000,
    });
    expect(l3_bride_day28.path).toBe('influencer_direct');
    expect(l3_bride_day28.fee_amount).toBe(2500);

    // ── L3 Path C salon: Anita ₹3,000 day-30 direct + attribution → 7% → ₹210 ──
    const l3_anita_day30 = await pricingService.computeL3OnFollowerTxn({
      client: pool, brandId, followerId: anitaId,
      campaignInfluencerId: null, brandCategory: 'salon', netAmount: 3000,
    });
    expect(l3_anita_day30.path).toBe('influencer_attributed');
    expect(l3_anita_day30.fee_amount).toBe(210);
    expect(l3_anita_day30.influencer_id).toBe(influencerId);

    // ── L3 Path A salon: Rahul ₹1,500 day-32 direct, no attribution → 9% → ₹135 ──
    const l3_rahul_day32 = await pricingService.computeL3OnFollowerTxn({
      client: pool, brandId, followerId: rahulId,
      campaignInfluencerId: null, brandCategory: 'salon', netAmount: 1500,
    });
    expect(l3_rahul_day32.path).toBe('direct');
    expect(l3_rahul_day32.fee_amount).toBe(135);

    // ── The locked total ─────────────────────────────────────────
    const total =
      2499 +                              // L1 SaaS
      1500 + 150 +                        // L2 escrow locks
      100 + 2500 + 210 + 135;             // L3 follower-transactions

    expect(total).toBe(7094);

    // And the same numbers re-summed live from the service:
    const liveTotal =
      l1Renewal.amount_inr +
      parseFloat((l2_50k.base_inr * l2_50k.fee_pct / 100).toFixed(2)) +
      parseFloat((l2_5k.base_inr  * l2_5k.fee_pct  / 100).toFixed(2)) +
      l3_anita_day8.fee_amount +
      l3_bride_day28.fee_amount +
      l3_anita_day30.fee_amount +
      l3_rahul_day32.fee_amount;
    expect(liveTotal).toBe(7094);
  });
});
