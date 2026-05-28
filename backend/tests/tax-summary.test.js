'use strict';

const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createFollowerUser, registerBrand } = require('./helpers/factories');
const taxReport = require('../src/services/taxReport.service');

const M = '2026-03';          // the month under test
const IN = '2026-03-15';      // a date inside it
const OUT = '2026-02-15';     // a date outside it

beforeEach(async () => {
  await truncateAll();
  // subscription_tiers is cleared by truncateAll's users-CASCADE — re-seed so
  // registerBrand can auto-provision a brand_subscription (for the invoice FK).
  await query(
    `INSERT INTO subscription_tiers
       (tier_key, name, monthly_price_inr, max_campaigns, max_sets_per_campaign, max_influencers_per_cycle, max_products, is_enterprise, sort_order)
     VALUES
       ('free','Free',0,1,1,5,10,false,1),
       ('growth','Growth',2499,3,3,25,100,false,2),
       ('pro','Pro',9999,10,10,100,500,false,3),
       ('enterprise','Enterprise',29999,-1,-1,-1,-1,true,4)
     ON CONFLICT (tier_key) DO NOTHING`
  );
});

async function followerId() {
  const { user } = await createFollowerUser();
  let { rows } = await query(`SELECT id FROM followers WHERE user_id = $1`, [user.id]);
  if (!rows[0]) rows = (await query(`INSERT INTO followers (user_id) VALUES ($1) RETURNING id`, [user.id])).rows;
  return rows[0].id;
}

async function influencerId(handle) {
  const { rows: [u] } = await query(`INSERT INTO users (phone, role, name, status) VALUES ($1,'influencer','I','approved') RETURNING id`, [`+9198${Date.now() % 100000000}`]);
  const { rows: [i] } = await query(`INSERT INTO influencers (user_id, instagram_handle) VALUES ($1,$2) RETURNING id`, [u.id, handle]);
  return i.id;
}

describe('taxReport.service.monthlySummary', () => {
  test('aggregates GST collected, TCS owed, TDS withheld for the month', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    const { rows: [sub] } = await query(`SELECT id FROM brand_subscriptions WHERE brand_id = $1 LIMIT 1`, [brand.id]);

    // Subscription invoice paid in March → GST 100 (+ one OUTSIDE the month to prove the window)
    await query(
      `INSERT INTO subscription_invoices (brand_subscription_id, brand_id, tier_key, amount_inr, gst_amount_inr, period_start, period_end, status, paid_at)
       VALUES ($1,$2,'growth',2499,100,$3::date,$3::date + 30,'paid',$3::timestamptz)`,
      [sub.id, brand.id, IN]
    );
    await query(
      `INSERT INTO subscription_invoices (brand_subscription_id, brand_id, tier_key, amount_inr, gst_amount_inr, period_start, period_end, status, paid_at)
       VALUES ($1,$2,'growth',2499,999,$3::date,$3::date + 30,'paid',$3::timestamptz)`,
      [sub.id, brand.id, OUT]
    );

    // Commerce transaction in March → commission GST 50, TCS 20
    const fid = await followerId();
    await query(
      `INSERT INTO follower_transactions (follower_id, brand_id, transaction_type, gross_amount, net_amount,
         influencer_commission, marketplace_fee_amount, brand_net, commission_gst_amount, tcs_amount, status, created_at)
       VALUES ($1,$2,'pay_at_store',1000,1000,100,200,700,50,20,'completed',$3::timestamptz)`,
      [fid, brand.id, IN]
    );

    // Escrow tranche RELEASED in March → fee GST 30
    const inf = await influencerId('taxinf');
    const { rows: [c] } = await query(`INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1,'C','active',100000) RETURNING id`, [brand.id]);
    const { rows: [cs] } = await query(`INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode, set_budget) VALUES ($1,'S','engagement','handpick',100000) RETURNING id`, [c.id]);
    const { rows: [ci] } = await query(`INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1,$2,'contracted',10000) RETURNING id`, [cs.id, inf]);
    await query(
      `INSERT INTO escrow_entries (campaign_influencer_id, tranche_number, amount, escrow_fee_amount, fee_gst_amount, net_to_influencer, status, trigger_event, released_at)
       VALUES ($1,1,2500,167,30,2333,'released','contract_signed',$2::timestamptz)`,
      [ci.id, IN]
    );

    // Influencer withdrawal completed in March → TDS 40
    await query(
      `INSERT INTO influencer_withdrawals (influencer_id, amount_requested, tds_deducted, net_paid, method, status, completed_at)
       VALUES ($1,400,40,360,'upi','completed',$2::timestamptz)`,
      [inf, IN]
    );

    const s = await taxReport.monthlySummary(M);
    expect(s.gst_collected.subscription).toBeCloseTo(100, 2);
    expect(s.gst_collected.commission).toBeCloseTo(50, 2);
    expect(s.gst_collected.escrow_fee).toBeCloseTo(30, 2);
    expect(s.gst_collected.total).toBeCloseTo(180, 2);
    expect(s.tcs_owed).toBeCloseTo(20, 2);
    expect(s.tds_withheld).toBeCloseTo(40, 2);
    expect(s.detail.subscription_invoices_paid).toBe(1); // the Feb one is excluded
  });

  test('a month with no activity → all zero', async () => {
    const s = await taxReport.monthlySummary('2026-01');
    expect(s.gst_collected.total).toBe(0);
    expect(s.tcs_owed).toBe(0);
    expect(s.tds_withheld).toBe(0);
  });

  test('rejects a malformed month', async () => {
    await expect(taxReport.monthlySummary('2026-13')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(taxReport.monthlySummary('March')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
