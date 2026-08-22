'use strict';

/**
 * Phase 3 — Block E:
 *   GET /v1/brands/me/escrow         — brand escrow overview
 *   GET /v1/influencers/me/earnings  — influencer earnings + pending balance
 *   GET /v1/campaigns/:id/live       — campaign live hierarchy
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

// ─── shared setup helpers ────────────────────────────────────────────────────

async function approveUser(userId) {
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]);
}

/**
 * Sets up: brand + influencer + campaign + set + invite → accept → sign → brand-sign
 * Returns tokens, IDs, and the auto-created deliverable ID.
 * After this, T1 is released, T2+T3 are locked.
 */
async function setupActiveContract({ agreed_fee = 10000 } = {}) {
  // Brand
  const { token: brandToken, user: brandUser } = await createBrandUser();
  await registerBrand(brandToken);
  await approveUser(brandUser.id);

  // Fund wallet
  const orderRes = await request(app)
    .post('/v1/brands/me/wallet/topup')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ amount: 200000 });
  await request(app)
    .post('/v1/brands/me/wallet/topup/verify')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({
      razorpay_order_id: orderRes.body.data.order_id,
      razorpay_payment_id: 'pay_earnings_setup',
      razorpay_signature: 'mock_sig',
    });

  // Influencer
  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'priya_sharma' });
  await approveUser(infUser.id);

  // Campaign
  const campaignRes = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Diwali Special', total_budget: 100000, brief: 'Show our best-selling thali', start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = campaignRes.body.data.campaign.id;

  // Set
  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Food Creators', goal: 'engagement', assignment_mode: 'handpick', set_budget: 10000, formats_json: [{ type: 'reel', count: 1 }] });
  const sid = setRes.body.data.set.id;

  // Invite
  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee, posting_date: '2026-07-15' });
  const ci = inviteRes.body.data.campaign_influencer;

  // Accept
  await request(app)
    .post(`/v1/offers/${ci.id}/accept`)
    .set('Authorization', `Bearer ${infToken}`);

  // Get contract id
  const contractRes = await request(app)
    .get(`/v1/contracts/${ci.id}`)
    .set('Authorization', `Bearer ${brandToken}`);
  const contractId = contractRes.body.data.contract.id;

  // Brand "Approve & Send": draft → pending_influencer (required before signing)
  await request(app)
    .post(`/v1/contracts/${contractId}/approve`)
    .set('Authorization', `Bearer ${brandToken}`);

  // Influencer signs
  await request(app)
    .post(`/v1/contracts/${contractId}/sign`)
    .set('Authorization', `Bearer ${infToken}`)
    .send({ typed_name: 'Priya Sharma' });

  // Brand signs → T1 released, deliverable created
  await request(app)
    .post(`/v1/contracts/${contractId}/brand-sign`)
    .set('Authorization', `Bearer ${brandToken}`);

  // Get deliverable id
  const { rows: delivRows } = await query(
    `SELECT id FROM deliverables WHERE campaign_influencer_id = $1`,
    [ci.id]
  );
  const deliverableId = delivRows[0].id;

  return { brandToken, infToken, brandUser, infUser, inf, cid, sid, ci, contractId, deliverableId };
}

/**
 * Extends setupActiveContract through to confirm-live (T2 released).
 */
async function setupLiveConfirmed(opts = {}) {
  const scenario = await setupActiveContract(opts);
  const { brandToken, infToken, deliverableId } = scenario;

  // Submit content
  await request(app)
    .post(`/v1/deliverables/${deliverableId}/submit`)
    .set('Authorization', `Bearer ${infToken}`)
    .send({ submitted_url: 'https://www.instagram.com/reel/abc123' });

  // Brand approves
  await request(app)
    .post(`/v1/deliverables/${deliverableId}/review`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ action: 'approve' });

  // Influencer submits live URL
  await request(app)
    .post(`/v1/deliverables/${deliverableId}/submit-live`)
    .set('Authorization', `Bearer ${infToken}`)
    .send({ live_url: 'https://www.instagram.com/reel/live_abc123' });

  // Brand confirms live → T2 released
  await request(app)
    .post(`/v1/deliverables/${deliverableId}/confirm-live`)
    .set('Authorization', `Bearer ${brandToken}`);

  return scenario;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/escrow
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/brands/me/escrow', () => {
  it('returns all escrow entries for the brand across campaigns', async () => {
    const { brandToken } = await setupActiveContract();

    const res = await request(app)
      .get('/v1/brands/me/escrow')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.entries)).toBe(true);
    expect(res.body.data.entries.length).toBe(3); // T1, T2, T3
  });

  it('escrow entries include required fields', async () => {
    const { brandToken } = await setupActiveContract();

    const res = await request(app)
      .get('/v1/brands/me/escrow')
      .set('Authorization', `Bearer ${brandToken}`);

    const t1 = res.body.data.entries.find(e => e.tranche_number === 1);
    expect(t1).toBeDefined();
    expect(t1.status).toBe('released');
    expect(parseFloat(t1.amount)).toBe(2500);
    expect(t1.trigger_event).toBe('contract_signed');
    expect(t1.razorpay_payout_id).toMatch(/^tranche_1_/); // escrow tranche payout id (escrow.service.js:115); mock_payout_ is withdrawals-only

    const t2 = res.body.data.entries.find(e => e.tranche_number === 2);
    expect(t2.status).toBe('locked');
    expect(parseFloat(t2.amount)).toBe(2500);

    const t3 = res.body.data.entries.find(e => e.tranche_number === 3);
    expect(t3.status).toBe('locked');
    expect(parseFloat(t3.amount)).toBe(5000);
  });

  it('after confirm-live T1 and T2 are released, T3 still locked', async () => {
    const { brandToken } = await setupLiveConfirmed();

    const res = await request(app)
      .get('/v1/brands/me/escrow')
      .set('Authorization', `Bearer ${brandToken}`);

    const entries = res.body.data.entries;
    expect(entries.find(e => e.tranche_number === 1).status).toBe('released');
    expect(entries.find(e => e.tranche_number === 2).status).toBe('released');
    expect(entries.find(e => e.tranche_number === 3).status).toBe('locked');
  });

  it('returns summary totals', async () => {
    const { brandToken } = await setupActiveContract();

    const res = await request(app)
      .get('/v1/brands/me/escrow')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.body.data.summary).toBeDefined();
    expect(parseFloat(res.body.data.summary.total_locked)).toBeGreaterThan(0);
    expect(parseFloat(res.body.data.summary.total_released)).toBeGreaterThan(0);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/v1/brands/me/escrow');
    expect(res.status).toBe(401);
  });

  it('returns 403 for influencer', async () => {
    const { infToken } = await setupActiveContract();
    const res = await request(app)
      .get('/v1/brands/me/escrow')
      .set('Authorization', `Bearer ${infToken}`);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/influencers/me/earnings
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/influencers/me/earnings', () => {
  it('returns wallet_balance and total_earned after T1 release', async () => {
    const { infToken } = await setupActiveContract();

    const res = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // T1: 25% of 10000 = 2500, platform_fee 8% = 200, net = 2300
    expect(parseFloat(res.body.data.wallet_balance)).toBeCloseTo(2300, 1);
    expect(parseFloat(res.body.data.total_earned)).toBeCloseTo(2300, 1);
  });

  it('returns pending_amount (locked escrow T2+T3 net)', async () => {
    const { infToken } = await setupActiveContract();

    const res = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    // T2 net = 2500 * 0.92 = 2300; T3 net = 5000 * 0.92 = 4600; total pending = 6900
    expect(parseFloat(res.body.data.pending_amount)).toBeCloseTo(6900, 1);
  });

  it('pending_amount decreases as tranches are released', async () => {
    const { infToken } = await setupLiveConfirmed();

    const res = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    // After T2 release: wallet = 2300+2300 = 4600, pending = T3 only = 4600
    expect(parseFloat(res.body.data.wallet_balance)).toBeCloseTo(4600, 1);
    expect(parseFloat(res.body.data.pending_amount)).toBeCloseTo(4600, 1);
  });

  it('returns locked_entries list showing unreleased tranches', async () => {
    const { infToken } = await setupActiveContract();

    const res = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    expect(Array.isArray(res.body.data.locked_entries)).toBe(true);
    // T2 and T3 are locked
    expect(res.body.data.locked_entries.length).toBe(2);
    const trancheNums = res.body.data.locked_entries.map(e => e.tranche_number);
    expect(trancheNums).toContain(2);
    expect(trancheNums).toContain(3);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/v1/influencers/me/earnings');
    expect(res.status).toBe(401);
  });

  it('returns 403 for brand', async () => {
    const { brandToken } = await setupActiveContract();
    const res = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/campaigns/:id/live
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/campaigns/:id/live', () => {
  it('returns campaign with sets, influencers, deliverables and escrow', async () => {
    const { brandToken, cid } = await setupActiveContract();

    const res = await request(app)
      .get(`/v1/campaigns/${cid}/live`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { campaign } = res.body.data;
    expect(campaign).toBeDefined();
    expect(campaign.id).toBe(cid);

    // Has sets
    expect(Array.isArray(campaign.sets)).toBe(true);
    expect(campaign.sets.length).toBe(1);

    const set = campaign.sets[0];
    expect(Array.isArray(set.influencers)).toBe(true);
    expect(set.influencers.length).toBe(1);

    const inf = set.influencers[0];
    expect(inf.status).toBe('contracted');
    expect(Array.isArray(inf.deliverables)).toBe(true);
    expect(inf.deliverables.length).toBe(1);
    expect(Array.isArray(inf.escrow)).toBe(true);
    expect(inf.escrow.length).toBe(3);
  });

  it('deliverable status is pending after brand-sign', async () => {
    const { brandToken, cid } = await setupActiveContract();

    const res = await request(app)
      .get(`/v1/campaigns/${cid}/live`)
      .set('Authorization', `Bearer ${brandToken}`);

    const deliverable = res.body.data.campaign.sets[0].influencers[0].deliverables[0];
    expect(deliverable.status).toBe('pending');
    expect(deliverable.type).toBe('reel');
  });

  it('reflects live status after full flow', async () => {
    const { brandToken, cid } = await setupLiveConfirmed();

    const res = await request(app)
      .get(`/v1/campaigns/${cid}/live`)
      .set('Authorization', `Bearer ${brandToken}`);

    const inf = res.body.data.campaign.sets[0].influencers[0];
    expect(inf.status).toBe('active');
    expect(inf.deliverables[0].status).toBe('live');
    expect(inf.escrow.filter(e => e.status === 'released').length).toBe(2); // T1 + T2
    expect(inf.escrow.filter(e => e.status === 'locked').length).toBe(1);   // T3
  });

  it('returns 403 for a different brand', async () => {
    const { cid } = await setupActiveContract();
    const { token: otherToken } = await createBrandUser();
    await registerBrand(otherToken);

    const res = await request(app)
      .get(`/v1/campaigns/${cid}/live`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent campaign', async () => {
    const { brandToken } = await setupActiveContract();

    const res = await request(app)
      .get('/v1/campaigns/00000000-0000-0000-0000-000000000000/live')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const { cid } = await setupActiveContract();
    const res = await request(app).get(`/v1/campaigns/${cid}/live`);
    expect(res.status).toBe(401);
  });
});
