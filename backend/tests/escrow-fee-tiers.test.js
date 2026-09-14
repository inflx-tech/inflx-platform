'use strict';

/**
 * L2 — Campaign Protection Fee tier tests.
 *
 * Covers:
 *   • Tier boundary lookups (4,99,999 / 5,00,000 / 5,00,001 / 25,00,000 / 25,00,001)
 *   • Aggregation rule: only engagement+hybrid set_budgets count
 *   • Lock-at-publish: rate stays even if budgets change later
 *   • Per-brand escrow_fee_override_pct precedence
 *   • Admin CRUD endpoints
 *   • Renamed escrow_entries.escrow_fee_amount column
 */

const request = require('supertest');
const app     = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand, createAdminUser } = require('./helpers/factories');
const pricingService = require('../src/services/pricing.service');

beforeEach(async () => {
  await truncateAll();
  pricingService.bustEscrowTierCache();
  // Reset escrow_fee_tiers to canonical seed (truncateAll skips this table to
  // preserve admin-config rows; tests reset explicitly so PATCH cases don't
  // leak across files).
  await query(`DELETE FROM escrow_fee_tiers`);
  await query(
    `INSERT INTO escrow_fee_tiers (tier_key, min_amount_inr, max_amount_inr, fee_pct, description, sort_order)
     VALUES
       ('small', 0,       500000,  3.00, 'Below ₹5L', 1),
       ('mid',   500001,  2500000, 2.00, '₹5-25L',     2),
       ('large', 2500001, NULL,    1.00, 'Above ₹25L', 3)`
  );
});

describe('pricing.service.lookupEscrowFeeTier — boundary cases', () => {
  test('₹0 → small tier (3%)', async () => {
    const t = await pricingService.lookupEscrowFeeTier(0);
    expect(t.tier_key).toBe('small');
    expect(t.fee_pct).toBe(3);
  });

  test('₹4,99,999 → small tier', async () => {
    const t = await pricingService.lookupEscrowFeeTier(499999);
    expect(t.tier_key).toBe('small');
  });

  test('₹5,00,000 → small tier (boundary inclusive)', async () => {
    const t = await pricingService.lookupEscrowFeeTier(500000);
    expect(t.tier_key).toBe('small');
  });

  test('₹5,00,001 → mid tier (2%)', async () => {
    const t = await pricingService.lookupEscrowFeeTier(500001);
    expect(t.tier_key).toBe('mid');
    expect(t.fee_pct).toBe(2);
  });

  test('₹25,00,000 → mid tier (boundary inclusive)', async () => {
    const t = await pricingService.lookupEscrowFeeTier(2500000);
    expect(t.tier_key).toBe('mid');
  });

  test('₹25,00,001 → large tier (1%)', async () => {
    const t = await pricingService.lookupEscrowFeeTier(2500001);
    expect(t.tier_key).toBe('large');
    expect(t.fee_pct).toBe(1);
  });

  test('₹1 crore → large tier', async () => {
    const t = await pricingService.lookupEscrowFeeTier(10000000);
    expect(t.tier_key).toBe('large');
  });
});

describe('pricing.service.computeEscrowFeeBase — aggregation rule', () => {
  test('sums engagement+hybrid set budgets only; ignores conversion sets', async () => {
    const { token, user } = await createBrandUser();
    await registerBrand(token);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [user.id]);
    const { rows: [c] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'Mixed', 'draft', 1000000) RETURNING *`,
      [brand.id]
    );
    await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode, set_budget) VALUES
         ($1, 'EngSet',  'engagement', 'handpick', 500000),
         ($1, 'ConvSet', 'conversion', 'handpick', 999999),
         ($1, 'HybSet',  'hybrid',     'handpick', 150000)`,
      [c.id]
    );
    const base = await pricingService.computeEscrowFeeBase({ query: query }, c.id);
    expect(base).toBe(650000);  // 500000 + 150000 — conversion ignored
  });

  test('returns 0 for pure conversion campaign', async () => {
    const { token, user } = await createBrandUser();
    await registerBrand(token);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [user.id]);
    const { rows: [c] } = await query(
      `INSERT INTO campaigns (brand_id, name, status) VALUES ($1, 'Pure Conv', 'draft') RETURNING *`,
      [brand.id]
    );
    await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'X', 'conversion', 'handpick')`,
      [c.id]
    );
    const base = await pricingService.computeEscrowFeeBase({ query: query }, c.id);
    expect(base).toBe(0);
  });
});

describe('pricing.service.resolveEscrowFeePct — precedence', () => {
  test('per-brand override wins over tier', async () => {
    const r = await pricingService.resolveEscrowFeePct({
      baseAmountInr: 6000000,    // would be large tier (1%)
      brandOverridePct: 0.5,     // override
    });
    expect(r.source).toBe('brand_override');
    expect(r.fee_pct).toBe(0.5);
  });

  test('null override falls through to tier lookup', async () => {
    const r = await pricingService.resolveEscrowFeePct({
      baseAmountInr: 600000,
      brandOverridePct: null,
    });
    expect(r.source).toBe('tier_lookup');
    expect(r.tier_key).toBe('mid');
    expect(r.fee_pct).toBe(2);
  });
});

describe('pricing.service.lockEscrowFeeAtPublish', () => {
  async function setupCampaign({ engagementBudget, conversionBudget, override = null }) {
    const { token, user } = await createBrandUser();
    await registerBrand(token);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [user.id]);
    if (override != null) {
      await query(`UPDATE brands SET escrow_fee_override_pct = $1 WHERE id = $2`, [override, brand.id]);
    }
    const { rows: [c] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'C', 'draft', $2) RETURNING *`,
      [brand.id, (engagementBudget || 0) + (conversionBudget || 0)]
    );
    if (engagementBudget) {
      await query(
        `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode, set_budget)
         VALUES ($1, 'E', 'engagement', 'handpick', $2)`,
        [c.id, engagementBudget]
      );
    }
    if (conversionBudget) {
      await query(
        `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode, set_budget)
         VALUES ($1, 'C', 'conversion', 'handpick', $2)`,
        [c.id, conversionBudget]
      );
    }
    return { campaign: c, brand };
  }

  test('locks small-tier rate (3%) for ₹3L engagement campaign', async () => {
    const { campaign, brand } = await setupCampaign({ engagementBudget: 300000 });
    const r = await pricingService.lockEscrowFeeAtPublish({ query }, campaign.id, brand.id);
    expect(r.fee_pct).toBe(3);
    expect(r.base_inr).toBe(300000);
    expect(r.tier_key).toBe('small');
    const { rows: [c2] } = await query(`SELECT escrow_fee_pct_locked, escrow_fee_base_inr FROM campaigns WHERE id = $1`, [campaign.id]);
    expect(parseFloat(c2.escrow_fee_pct_locked)).toBe(3);
    expect(parseFloat(c2.escrow_fee_base_inr)).toBe(300000);
  });

  test('locks mid-tier rate (2%) for ₹6L engagement campaign', async () => {
    const { campaign, brand } = await setupCampaign({ engagementBudget: 600000 });
    const r = await pricingService.lockEscrowFeeAtPublish({ query }, campaign.id, brand.id);
    expect(r.fee_pct).toBe(2);
    expect(r.tier_key).toBe('mid');
  });

  test('mixed engagement+conversion: locks based on engagement portion only', async () => {
    const { campaign, brand } = await setupCampaign({
      engagementBudget: 300000,
      conversionBudget: 5000000,  // huge but ignored
    });
    const r = await pricingService.lockEscrowFeeAtPublish({ query }, campaign.id, brand.id);
    expect(r.fee_pct).toBe(3);   // ₹3L → small
    expect(r.tier_key).toBe('small');
    expect(r.base_inr).toBe(300000);
  });

  test('per-brand override wins over tier lookup at publish', async () => {
    const { campaign, brand } = await setupCampaign({ engagementBudget: 600000, override: 0.75 });
    const r = await pricingService.lockEscrowFeeAtPublish({ query }, campaign.id, brand.id);
    expect(r.fee_pct).toBe(0.75);
    expect(r.source).toBe('brand_override');
  });

  test('lock is idempotent — second call returns the locked values', async () => {
    const { campaign, brand } = await setupCampaign({ engagementBudget: 300000 });
    const r1 = await pricingService.lockEscrowFeeAtPublish({ query }, campaign.id, brand.id);
    expect(r1.fee_pct).toBe(3);

    // Now change set_budget — second lock call should NOT re-tier
    await query(`UPDATE campaign_sets SET set_budget = 6000000 WHERE campaign_id = $1`, [campaign.id]);
    const r2 = await pricingService.lockEscrowFeeAtPublish({ query }, campaign.id, brand.id);
    expect(r2.fee_pct).toBe(3);  // still the small-tier rate
    expect(r2.already_locked).toBe(true);
  });
});

describe('Admin endpoints — escrow fee tiers CRUD', () => {
  test('GET /admin/escrow-fee-tiers returns the 3 seeded tiers', async () => {
    const { token } = await createAdminUser('finance');
    const res = await request(app)
      .get('/v1/admin/escrow-fee-tiers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tiers).toHaveLength(3);
    expect(res.body.data.tiers.map(t => t.tier_key).sort()).toEqual(['large', 'mid', 'small']);
  });

  test('PATCH /admin/escrow-fee-tiers/:key updates fee_pct and busts cache', async () => {
    const { token: superToken } = await createAdminUser('superadmin');
    const res = await request(app)
      .patch('/v1/admin/escrow-fee-tiers/small')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ fee_pct: 4.5 });
    expect(res.status).toBe(200);
    expect(parseFloat(res.body.data.tier.fee_pct)).toBe(4.5);

    // Cache should be busted — next lookup sees new rate
    const t = await pricingService.lookupEscrowFeeTier(100000);
    expect(t.fee_pct).toBe(4.5);
  });

  test('PATCH rejects fee_pct outside 0–50', async () => {
    const { token: superToken } = await createAdminUser('superadmin');
    const res = await request(app)
      .patch('/v1/admin/escrow-fee-tiers/small')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ fee_pct: 60 });
    expect(res.status).toBe(422);
  });

  test('finance role cannot PATCH tiers (superadmin only)', async () => {
    const { token } = await createAdminUser('finance');
    const res = await request(app)
      .patch('/v1/admin/escrow-fee-tiers/small')
      .set('Authorization', `Bearer ${token}`)
      .send({ fee_pct: 5 });
    expect(res.status).toBe(403);
  });

  test('PATCH /admin/brands/:id/escrow-fee-override sets and clears override', async () => {
    const { token: financeToken } = await createAdminUser('finance');
    const { token, user } = await createBrandUser();
    await registerBrand(token);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [user.id]);

    const setRes = await request(app)
      .patch(`/v1/admin/brands/${brand.id}/escrow-fee-override`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ escrow_fee_override_pct: 0.5 });
    expect(setRes.status).toBe(200);
    expect(parseFloat(setRes.body.data.escrow_fee_override_pct)).toBe(0.5);

    const clearRes = await request(app)
      .patch(`/v1/admin/brands/${brand.id}/escrow-fee-override`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ escrow_fee_override_pct: null });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.data.escrow_fee_override_pct).toBeNull();
  });
});

// Item 7 (rules v1.20 §3 and §9, approval Q2): a fee tranche carries NO
// platform charge. The creator receives the agreed amount in full, and INFLX's
// take on that money is the campaign fee, charged once to the brand when the
// funds lock. These two tests used to assert the tier fee was deducted from a
// tranche; they now assert the opposite, because the rule changed. The tier
// table itself is untouched and still prices the commerce protection fee.
describe('escrow.service takes no tier fee from a fee tranche', () => {
  test('a locked campaign rate is ignored: the creator keeps the whole tranche', async () => {
    const escrowService = require('../src/services/escrow.service');
    const { token, user } = await createBrandUser();
    await registerBrand(token);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [user.id]);
    const { rows: [c] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget, escrow_fee_pct_locked, escrow_fee_base_inr, escrow_fee_locked_at)
       VALUES ($1, 'Locked', 'active', 600000, 2.00, 600000, NOW()) RETURNING *`,
      [brand.id]
    );
    const { rows: [cs] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode, set_budget)
       VALUES ($1, 'S', 'engagement', 'handpick', 600000) RETURNING *`,
      [c.id]
    );
    const { rows: [{ id: infId }] } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919999111122', 'influencer', 'I', 'approved') RETURNING id`
    );
    const { rows: [inf] } = await query(
      `INSERT INTO influencers (user_id, instagram_handle) VALUES ($1, 'lockedi') RETURNING id`,
      [infId]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee)
       VALUES ($1, $2, 'contracted', 100000) RETURNING *`,
      [cs.id, inf.id]
    );

    const entries = await escrowService.createEscrowEntries(
      { query: query },
      ci.id,
      100000,
      99,   // caller fallback — irrelevant now; no tier fee touches a fee tranche
    );

    // No platform charge of any kind comes out of a fee tranche.
    const totalFee = entries.reduce((s, e) => s + parseFloat(e.escrow_fee_amount), 0);
    expect(totalFee).toBe(0);
    const totalGst = entries.reduce((s, e) => s + parseFloat(e.fee_gst_amount), 0);
    expect(totalGst).toBe(0);

    // She receives every rupee, and the three parts sum exactly to the fee.
    for (const e of entries) expect(parseFloat(e.net_to_influencer)).toBe(parseFloat(e.amount));
    const totalNet = entries.reduce((s, e) => s + parseFloat(e.net_to_influencer), 0);
    expect(totalNet).toBe(100000);
  });

  test('a campaign with no locked rate behaves the same way', async () => {
    const escrowService = require('../src/services/escrow.service');
    const { token, user } = await createBrandUser();
    await registerBrand(token);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [user.id]);
    const { rows: [c] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'Legacy', 'active', 100000) RETURNING *`,
      [brand.id]
    );
    const { rows: [cs] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode, set_budget)
       VALUES ($1, 'S', 'engagement', 'handpick', 100000) RETURNING *`,
      [c.id]
    );
    const { rows: [{ id: infId }] } = await query(
      `INSERT INTO users (phone, role, name, status) VALUES ('+919999111133', 'influencer', 'I2', 'approved') RETURNING id`
    );
    const { rows: [inf] } = await query(
      `INSERT INTO influencers (user_id, instagram_handle) VALUES ($1, 'legi') RETURNING id`,
      [infId]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee)
       VALUES ($1, $2, 'contracted', 50000) RETURNING *`,
      [cs.id, inf.id]
    );

    const entries = await escrowService.createEscrowEntries(
      { query: query },
      ci.id,
      50000,
      8,    // legacy 8% — no longer applied to a fee tranche
    );

    const total = entries.reduce((s, e) => s + parseFloat(e.escrow_fee_amount), 0);
    expect(total).toBe(0);
    const totalNet = entries.reduce((s, e) => s + parseFloat(e.net_to_influencer), 0);
    expect(totalNet).toBe(50000);
  });
});
