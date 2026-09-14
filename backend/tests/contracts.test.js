'use strict';

const ITEM4_DAY = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10); // item 4: sets need a posting date ≥ 7 days out
/**
 * Phase 3 — Block A: Contract generation and dual signing
 * Block B: Escrow entries creation + Tranche 1 auto-release
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
 * Full scenario up to status=accepted:
 * brand (approved, funded) → campaign → set → invite → influencer accepts
 * Returns tokens and IDs needed by all contract tests.
 */
async function setupAcceptedOffer({ agreed_fee = 10000 } = {}) {
  // Brand
  const { token: brandToken, user: brandUser } = await createBrandUser();
  await registerBrand(brandToken);
  await approveUser(brandUser.id);

  // Fund brand wallet
  const orderRes = await request(app)
    .post('/v1/brands/me/wallet/topup')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ amount: 200000 });
  await request(app)
    .post('/v1/brands/me/wallet/topup/verify')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({
      razorpay_order_id: orderRes.body.data.order_id,
      razorpay_payment_id: 'pay_contract_setup',
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
    .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Food Creators', goal: 'engagement', assignment_mode: 'handpick', set_budget: 10000, formats_json: [{ type: 'reel', count: 1 }] });
  const sid = setRes.body.data.set.id;

  // Invite
  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee, posting_date: '2026-07-15' });
  const ci = inviteRes.body.data.campaign_influencer;

  // Influencer accepts → auto-creates contract (status: draft)
  await request(app)
    .post(`/v1/offers/${ci.id}/accept`)
    .set('Authorization', `Bearer ${infToken}`);

  // Brand "Approve & Send": draft → pending_influencer. The contract
  // auto-creates 'draft' by design (contract.controller.js:1017);
  // the brand approve step is required before signing (verified
  // workflow, P6/P7). Re-approve from pending_influencer is allowed
  // (contract.controller.js:1041), so callers that approve again
  // are unaffected.
  const setupContractRes = await request(app)
    .get(`/v1/contracts/${ci.id}`)
    .set('Authorization', `Bearer ${brandToken}`);
  await request(app)
    .post(`/v1/contracts/${setupContractRes.body.data.contract.id}/approve`)
    .set('Authorization', `Bearer ${brandToken}`);

  return { brandToken, infToken, brandUser, infUser, inf, cid, sid, ci };
}

/**
 * Helper: get a contract by campaign_influencer_id via API.
 */
async function getContractByCIId(token, ciId) {
  return request(app)
    .get(`/v1/contracts/${ciId}`)
    .set('Authorization', `Bearer ${token}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract auto-creation
// ─────────────────────────────────────────────────────────────────────────────

describe('Contract auto-creation on offer acceptance', () => {
  it('auto-creates a contract in pending_influencer status when influencer accepts', async () => {
    const { brandToken, ci } = await setupAcceptedOffer();

    const res = await getContractByCIId(brandToken, ci.id);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.contract.status).toBe('pending_influencer');
    expect(res.body.data.contract.campaign_influencer_id).toBe(ci.id);
    expect(parseFloat(res.body.data.contract.influencer_fee)).toBe(10000);
    expect(res.body.data.contract.campaign_name).toBe('Diwali Special');
    expect(res.body.data.contract.content_requirements).toBe('Show our best-selling thali');
  });

  it('auto-creates a contract when negotiation is agreed', async () => {
    // Brand + influencer
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await approveUser(brandUser.id);

    const orderRes = await request(app)
      .post('/v1/brands/me/wallet/topup')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100000 });
    await request(app)
      .post('/v1/brands/me/wallet/topup/verify')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ razorpay_order_id: orderRes.body.data.order_id, razorpay_payment_id: 'pay_neg', razorpay_signature: 'sig' });

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'priya_sharma' });
    await approveUser(infUser.id);

    const campaignRes = await request(app)
      .post('/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ name: 'Neg Campaign', total_budget: 50000, start_date: '2026-07-01', end_date: '2026-07-31' });
    const cid = campaignRes.body.data.campaign.id;

    const setRes = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Set', goal: 'engagement', assignment_mode: 'handpick', set_budget: 10000, formats_json: [{ type: 'reel', count: 1 }] });
    const sid = setRes.body.data.set.id;

    const inviteRes = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ influencer_id: inf.id, agreed_fee: 5000 });
    const ci = inviteRes.body.data.campaign_influencer;

    // Influencer negotiates
    const negRes = await request(app)
      .post(`/v1/offers/${ci.id}/negotiate`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ proposed_fee: 7000 });
    const negId = negRes.body.data.negotiation.id;

    // Brand accepts negotiation → contract auto-creates (status: draft)
    await request(app)
      .post(`/v1/negotiations/${negId}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'accept' });

    // Brand "Approve & Send": draft → pending_influencer (verified
    // workflow, P6/P7). Path-independent contract-state transition;
    // re-approve from pending_influencer is allowed
    // (contract.controller.js:1041), so this is robust either way.
    const draftRes = await getContractByCIId(brandToken, ci.id);
    await request(app)
      .post(`/v1/contracts/${draftRes.body.data.contract.id}/approve`)
      .set('Authorization', `Bearer ${brandToken}`);

    const contractRes = await getContractByCIId(brandToken, ci.id);
    expect(contractRes.status).toBe(200);
    expect(contractRes.body.data.contract.status).toBe('pending_influencer');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/contracts/:campaign_influencer_id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/contracts/:campaign_influencer_id', () => {
  it('returns contract and deliverables for the owning brand', async () => {
    const { brandToken, ci } = await setupAcceptedOffer();

    const res = await getContractByCIId(brandToken, ci.id);

    expect(res.status).toBe(200);
    expect(res.body.data.contract).toBeDefined();
    expect(res.body.data.contract.influencer_fee).toBeDefined();
    expect(Array.isArray(res.body.data.deliverables)).toBe(true);
  });

  it('returns contract for the owning influencer', async () => {
    const { infToken, ci } = await setupAcceptedOffer();

    const res = await getContractByCIId(infToken, ci.id);

    expect(res.status).toBe(200);
    expect(res.body.data.contract.status).toBe('pending_influencer');
  });

  it('returns 403 for a different brand', async () => {
    const { ci } = await setupAcceptedOffer();
    const { token: otherToken } = await createBrandUser();
    await registerBrand(otherToken);

    const res = await getContractByCIId(otherToken, ci.id);
    expect(res.status).toBe(403);
  });

  it('returns 403 for a different influencer', async () => {
    const { ci } = await setupAcceptedOffer();
    const { token: otherToken } = await createInfluencerUser();
    await registerInfluencer(otherToken, { instagram_handle: 'arun_kumar' });

    const res = await getContractByCIId(otherToken, ci.id);
    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent campaign_influencer_id', async () => {
    const { brandToken } = await setupAcceptedOffer();

    const res = await request(app)
      .get('/v1/contracts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const { ci } = await setupAcceptedOffer();
    const res = await request(app).get(`/v1/contracts/${ci.id}`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/contracts/:id/sign  (influencer)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/contracts/:id/sign', () => {
  async function getContractId(token, ciId) {
    const res = await getContractByCIId(token, ciId);
    const id = res.body.data.contract.id;
    // Brand "Approve & Send": draft → pending_influencer (required before signing)
    await request(app)
      .post(`/v1/contracts/${id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    return id;
  }

  it('influencer signs contract — status becomes pending_brand', async () => {
    const { infToken, brandToken, ci } = await setupAcceptedOffer();
    const contractId = await getContractId(brandToken, ci.id);

    const res = await request(app)
      .post(`/v1/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ typed_name: 'Priya Sharma' });

    expect(res.status).toBe(200);
    expect(res.body.data.contract.status).toBe('pending_brand');
    expect(res.body.data.contract.influencer_signed_name).toBe('Priya Sharma');
    expect(res.body.data.contract.influencer_signed_at).toBeDefined();
    expect(res.body.data.contract.brand_signed_at).toBeNull();
  });

  it('returns 422 when typed_name is empty', async () => {
    const { infToken, brandToken, ci } = await setupAcceptedOffer();
    const contractId = await getContractId(brandToken, ci.id);

    const res = await request(app)
      .post(`/v1/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ typed_name: '   ' });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('typed_name');
  });

  it('returns 422 when contract is not in pending_influencer status', async () => {
    const { infToken, brandToken, ci } = await setupAcceptedOffer();
    const contractId = await getContractId(brandToken, ci.id);

    // Sign once
    await request(app)
      .post(`/v1/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ typed_name: 'Priya Sharma' });

    // Sign again — should fail
    const res = await request(app)
      .post(`/v1/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ typed_name: 'Priya Sharma' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when a brand tries to sign the influencer slot', async () => {
    const { brandToken, ci } = await setupAcceptedOffer();
    const contractId = await getContractId(brandToken, ci.id);

    const res = await request(app)
      .post(`/v1/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ typed_name: 'Brand Owner' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/contracts/:id/brand-sign  (brand countersigns)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/contracts/:id/brand-sign', () => {
  async function setupPendingBrand() {
    const scenario = await setupAcceptedOffer();
    const contractRes = await getContractByCIId(scenario.brandToken, scenario.ci.id);
    const contractId = contractRes.body.data.contract.id;

    // Influencer signs first
    await request(app)
      .post(`/v1/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${scenario.infToken}`)
      .send({ typed_name: 'Priya Sharma' });

    return { ...scenario, contractId };
  }

  it('brand countersigns — status becomes active, campaign_influencer becomes contracted', async () => {
    const { brandToken, contractId, ci } = await setupPendingBrand();

    const res = await request(app)
      .post(`/v1/contracts/${contractId}/brand-sign`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.contract.status).toBe('active');
    expect(res.body.data.contract.brand_signed_at).toBeDefined();
    expect(res.body.data.contract.pdf_url).toBeDefined();

    // Verify campaign_influencer is now contracted
    const { rows } = await query(
      `SELECT status FROM campaign_influencers WHERE id = $1`,
      [ci.id]
    );
    expect(rows[0].status).toBe('contracted');
  });

  it('creates exactly 3 escrow_entries with correct tranche amounts', async () => {
    const { brandToken, contractId, ci } = await setupPendingBrand();

    await request(app)
      .post(`/v1/contracts/${contractId}/brand-sign`)
      .set('Authorization', `Bearer ${brandToken}`);

    const { rows } = await query(
      `SELECT * FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY tranche_number`,
      [ci.id]
    );

    expect(rows.length).toBe(3);

    // T1: 25% of 10000 = 2500
    expect(rows[0].tranche_number).toBe(1);
    expect(parseFloat(rows[0].amount)).toBe(2500);
    expect(rows[0].trigger_event).toBe('contract_signed');

    // T2: 25% of 10000 = 2500
    expect(rows[1].tranche_number).toBe(2);
    expect(parseFloat(rows[1].amount)).toBe(2500);
    expect(rows[1].trigger_event).toBe('content_live');
    expect(rows[1].status).toBe('locked');

    // T3: 50% of 10000 = 5000
    expect(rows[2].tranche_number).toBe(3);
    expect(parseFloat(rows[2].amount)).toBe(5000);
    expect(rows[2].trigger_event).toBe('day_30_post_live');
    expect(rows[2].status).toBe('locked');
  });

  it('T1 is immediately released and influencer wallet_balance is credited', async () => {
    const { brandToken, contractId, inf } = await setupPendingBrand();

    const res = await request(app)
      .post(`/v1/contracts/${contractId}/brand-sign`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.t1_released).toBe(true);

    // Item 7 (rules v1.20 §3 and §9): she receives the agreed amount IN FULL.
    // fee = 10000, T1 = 25% = 2500, and nothing is deducted from it. INFLX's
    // take is the campaign fee, charged to the brand at the lock, never here.
    const { rows } = await query(
      `SELECT wallet_balance, total_earned FROM influencers WHERE id = $1`,
      [inf.id]
    );
    expect(parseFloat(rows[0].wallet_balance)).toBeCloseTo(2500, 1);
    expect(parseFloat(rows[0].total_earned)).toBeCloseTo(2500, 1);

    // T1 escrow entry should be released
    const { rows: escrowRows } = await query(
      `SELECT status, razorpay_payout_id FROM escrow_entries
       WHERE campaign_influencer_id = $1 AND tranche_number = 1`,
      [res.body.data.contract.campaign_influencer_id]
    );
    expect(escrowRows[0].status).toBe('released');
    expect(escrowRows[0].razorpay_payout_id).toMatch(/^tranche_1_/); // escrow tranche payout id (escrow.service.js:115); mock_payout_ is withdrawals-only
  });

  it('auto-creates one deliverable (reel) when contract activates', async () => {
    const { brandToken, contractId, ci } = await setupPendingBrand();

    await request(app)
      .post(`/v1/contracts/${contractId}/brand-sign`)
      .set('Authorization', `Bearer ${brandToken}`);

    const { rows } = await query(
      `SELECT * FROM deliverables WHERE campaign_influencer_id = $1`,
      [ci.id]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].type).toBe('reel');
    expect(rows[0].status).toBe('pending');
    expect(rows[0].revision_limit).toBe(2);
  });

  it('returns 422 when contract is not in pending_brand status', async () => {
    const { brandToken, ci } = await setupAcceptedOffer();
    const contractRes = await getContractByCIId(brandToken, ci.id);
    const contractId = contractRes.body.data.contract.id;

    // Try to brand-sign without influencer signing first
    const res = await request(app)
      .post(`/v1/contracts/${contractId}/brand-sign`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when an influencer tries to brand-sign', async () => {
    const { infToken, brandToken, ci } = await setupAcceptedOffer();
    const contractRes = await getContractByCIId(brandToken, ci.id);
    const contractId = contractRes.body.data.contract.id;

    // Influencer signs first
    await request(app)
      .post(`/v1/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ typed_name: 'Priya Sharma' });

    // Influencer tries to brand-sign
    const res = await request(app)
      .post(`/v1/contracts/${contractId}/brand-sign`)
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(403);
  });

  it('creates a wallet_transactions payout audit row for the brand', async () => {
    const { brandToken, contractId } = await setupPendingBrand();

    await request(app)
      .post(`/v1/contracts/${contractId}/brand-sign`)
      .set('Authorization', `Bearer ${brandToken}`);

    const txRes = await request(app)
      .get('/v1/brands/me/wallet/transactions')
      .set('Authorization', `Bearer ${brandToken}`);

    const payoutTx = txRes.body.data.transactions.find(t => t.type === 'payout');
    expect(payoutTx).toBeDefined();
    expect(payoutTx.direction).toBe('debit');
    expect(parseFloat(payoutTx.amount)).toBe(2500); // T1 = 25% of 10000
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The working style agreed at handshake, carried to the contract
// Contract: features/collab-working-style-two-questions
// ─────────────────────────────────────────────────────────────────────────────

describe('Contract carries the working style already agreed', () => {
  /**
   * The brand and the creator settle "where she works" and "are we shipping" during the
   * collaboration request. The contract screen used to ask the same thing again from a
   * blank slate, in a different vocabulary, and let the brand answer it differently from
   * the terms the creator had already accepted.
   *
   * The screen can only pre-answer it if the field actually reaches the client. A value
   * computed in a query and then dropped before the response is the same as a value that
   * was never computed — this asserts the payload, not the SQL.
   */
  it('returns agreed_mode from the linked agreement', async () => {
    const { brandToken, ci, brandUser, inf } = await setupAcceptedOffer();

    const { rows: [brand] } = await query(
      `SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]
    );
    // An agreement must name exactly one source — it is always the settlement of a
    // request or a pitch, never free-standing. This one settles a brand's request.
    const terms = JSON.stringify({ aim: 'conversion', mode: 'shipment' });
    const { rows: [collabReq] } = await query(
      `INSERT INTO brand_collab_requests (brand_id, influencer_id, terms_json, status, expires_at)
       VALUES ($1, $2, $3, 'accepted', NOW() + INTERVAL '2 days') RETURNING id`,
      [brand.id, inf.id, terms]
    );
    const { rows: [agreement] } = await query(
      `INSERT INTO collab_agreements
         (brand_id, influencer_id, status, terms_json, expires_at, source_request_id)
       VALUES ($1, $2, 'open', $3, NOW() + INTERVAL '30 days', $4) RETURNING id`,
      [brand.id, inf.id, terms, collabReq.id]
    );
    await query(
      `UPDATE campaign_influencers SET agreement_id = $1 WHERE id = $2`,
      [agreement.id, ci.id]
    );

    const res = await getContractByCIId(brandToken, ci.id);

    expect(res.status).toBe(200);
    expect(res.body.data.contract.agreed_mode).toBe('shipment');
  });

  /**
   * A campaign built without any prior handshake is ordinary — most are. The join that
   * fetches the agreed style must never be able to make a contract disappear.
   */
  it('still returns the contract when there was no prior agreement', async () => {
    const { brandToken, ci } = await setupAcceptedOffer();

    const res = await getContractByCIId(brandToken, ci.id);

    expect(res.status).toBe(200);
    expect(res.body.data.contract.id).toBeDefined();
    expect(res.body.data.contract.agreed_mode).toBeNull();
  });
});
