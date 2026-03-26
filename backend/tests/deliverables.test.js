'use strict';

/**
 * Phase 3 — Block C: Deliverable submission + brand review
 * Block D: Submit live URL + brand confirms live + Tranche 2 release
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
 * Full scenario up to active contract with one pending reel deliverable.
 */
async function setupActiveContract({ agreed_fee = 10000 } = {}) {
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
      razorpay_payment_id: 'pay_deliv_setup',
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
    .send({ name: 'Diwali Special', total_budget: 100000, brief: 'Show our best-selling thali' });
  const cid = campaignRes.body.data.campaign.id;

  // Set
  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ name: 'Food Creators', goal: 'engagement', assignment_mode: 'handpick' });
  const sid = setRes.body.data.set.id;

  // Invite
  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee, posting_date: '2026-07-15' });
  const ci = inviteRes.body.data.campaign_influencer;

  // Influencer accepts
  await request(app)
    .post(`/v1/offers/${ci.id}/accept`)
    .set('Authorization', `Bearer ${infToken}`);

  // Get contract
  const contractRes = await request(app)
    .get(`/v1/contracts/${ci.id}`)
    .set('Authorization', `Bearer ${brandToken}`);
  const contractId = contractRes.body.data.contract.id;

  // Influencer signs
  await request(app)
    .post(`/v1/contracts/${contractId}/sign`)
    .set('Authorization', `Bearer ${infToken}`)
    .send({ typed_name: 'Priya Sharma' });

  // Brand countersigns (creates deliverable, releases T1)
  await request(app)
    .post(`/v1/contracts/${contractId}/brand-sign`)
    .set('Authorization', `Bearer ${brandToken}`);

  // Get the deliverable
  const { rows: delivRows } = await query(
    `SELECT id FROM deliverables WHERE campaign_influencer_id = $1`,
    [ci.id]
  );
  const deliverableId = delivRows[0].id;

  return { brandToken, infToken, brandUser, infUser, inf, cid, sid, ci, contractId, deliverableId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /v1/deliverables/:id/submit
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/deliverables/:id/submit', () => {
  it('influencer submits content URL — status becomes submitted', async () => {
    const { infToken, deliverableId } = await setupActiveContract();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({
        submitted_url: 'https://www.instagram.com/reel/abc123',
        notes_to_brand: 'Hope you love it!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deliverable.status).toBe('submitted');
    expect(res.body.data.deliverable.submitted_url).toBe('https://www.instagram.com/reel/abc123');
    expect(res.body.data.deliverable.notes_to_brand).toBe('Hope you love it!');
    expect(res.body.data.deliverable.submitted_at).toBeDefined();
  });

  it('returns 422 when submitted_url is empty', async () => {
    const { infToken, deliverableId } = await setupActiveContract();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ submitted_url: '   ' });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('submitted_url');
  });

  it('returns 422 when deliverable is already submitted (not pending or revision_requested)', async () => {
    const { infToken, deliverableId } = await setupActiveContract();

    // Submit once
    await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/abc123' });

    // Try to submit again from submitted status
    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/abc123v2' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when brand tries to submit', async () => {
    const { brandToken, deliverableId } = await setupActiveContract();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/abc123' });

    expect(res.status).toBe(403);
  });

  it('returns 403 when a different influencer tries to submit', async () => {
    const { deliverableId } = await setupActiveContract();
    const { token: otherToken } = await createInfluencerUser();
    await registerInfluencer(otherToken, { instagram_handle: 'arun_kumar' });

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/abc123' });

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth token', async () => {
    const { deliverableId } = await setupActiveContract();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .send({ submitted_url: 'https://www.instagram.com/reel/abc123' });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /v1/deliverables/:id/review
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/deliverables/:id/review', () => {
  async function setupSubmitted() {
    const scenario = await setupActiveContract();
    await request(app)
      .post(`/v1/deliverables/${scenario.deliverableId}/submit`)
      .set('Authorization', `Bearer ${scenario.infToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/abc123' });
    return scenario;
  }

  it('brand approves deliverable — status becomes approved', async () => {
    const { brandToken, deliverableId } = await setupSubmitted();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deliverable.status).toBe('approved');
  });

  it('brand requests revision — status becomes revision_requested, revision_count incremented', async () => {
    const { brandToken, deliverableId } = await setupSubmitted();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'request_revision', feedback: 'Please add our logo to the video' });

    expect(res.status).toBe(200);
    expect(res.body.data.deliverable.status).toBe('revision_requested');
    expect(res.body.data.deliverable.revision_count).toBe(1);
    expect(res.body.data.deliverable.brand_feedback).toBe('Please add our logo to the video');
  });

  it('influencer can re-submit after revision is requested', async () => {
    const { brandToken, infToken, deliverableId } = await setupSubmitted();

    // Brand requests revision
    await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'request_revision', feedback: 'Add logo' });

    // Influencer re-submits from revision_requested
    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/abc123v2' });

    expect(res.status).toBe(200);
    expect(res.body.data.deliverable.status).toBe('submitted');
    expect(res.body.data.deliverable.submitted_url).toBe('https://www.instagram.com/reel/abc123v2');
  });

  it('returns REVISION_LIMIT_EXCEEDED when revision_count reaches revision_limit (default 2)', async () => {
    const { brandToken, infToken, deliverableId } = await setupSubmitted();

    // Revision round 1
    await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'request_revision', feedback: 'Round 1 feedback' });

    await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/v2' });

    // Revision round 2
    await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'request_revision', feedback: 'Round 2 feedback' });

    await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/v3' });

    // Try to request revision a 3rd time — should fail (limit = 2)
    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'request_revision', feedback: 'Round 3 feedback' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REVISION_LIMIT_EXCEEDED');
  });

  it('returns 422 when deliverable is not in submitted status', async () => {
    const { brandToken, deliverableId } = await setupActiveContract();

    // Deliverable is still in pending status
    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when influencer tries to review', async () => {
    const { infToken, deliverableId } = await setupSubmitted();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(403);
  });

  it('returns 403 when a different brand tries to review', async () => {
    const { deliverableId } = await setupSubmitted();
    const { token: otherToken } = await createBrandUser();
    await registerBrand(otherToken);

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid review action', async () => {
    const { brandToken, deliverableId } = await setupSubmitted();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/review`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'delete' });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('action');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block D — POST /v1/deliverables/:id/submit-live
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/deliverables/:id/submit-live', () => {
  async function setupApproved() {
    const scenario = await setupActiveContract();
    // Submit
    await request(app)
      .post(`/v1/deliverables/${scenario.deliverableId}/submit`)
      .set('Authorization', `Bearer ${scenario.infToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/abc123' });
    // Approve
    await request(app)
      .post(`/v1/deliverables/${scenario.deliverableId}/review`)
      .set('Authorization', `Bearer ${scenario.brandToken}`)
      .send({ action: 'approve' });
    return scenario;
  }

  it('influencer submits live URL — status stays approved (pending brand confirmation)', async () => {
    const { infToken, deliverableId } = await setupApproved();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit-live`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ live_url: 'https://www.instagram.com/reel/live_abc123' });

    expect(res.status).toBe(200);
    expect(res.body.data.deliverable.live_url).toBe('https://www.instagram.com/reel/live_abc123');
    // Status stays approved until brand confirms
    expect(res.body.data.deliverable.status).toBe('approved');
  });

  it('returns 422 when live_url is empty', async () => {
    const { infToken, deliverableId } = await setupApproved();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit-live`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ live_url: '' });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('live_url');
  });

  it('returns 422 when deliverable is not in approved status', async () => {
    const { infToken, deliverableId } = await setupActiveContract();

    // Deliverable is pending — can't submit live
    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit-live`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ live_url: 'https://www.instagram.com/reel/live_abc123' });

    expect(res.status).toBe(422);
  });

  it('returns 403 when brand tries to submit-live', async () => {
    const { brandToken, deliverableId } = await setupApproved();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/submit-live`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ live_url: 'https://www.instagram.com/reel/live_abc123' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block D — POST /v1/deliverables/:id/confirm-live
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/deliverables/:id/confirm-live', () => {
  async function setupLiveUrlSubmitted() {
    const scenario = await setupActiveContract();
    // Submit content
    await request(app)
      .post(`/v1/deliverables/${scenario.deliverableId}/submit`)
      .set('Authorization', `Bearer ${scenario.infToken}`)
      .send({ submitted_url: 'https://www.instagram.com/reel/abc123' });
    // Brand approves
    await request(app)
      .post(`/v1/deliverables/${scenario.deliverableId}/review`)
      .set('Authorization', `Bearer ${scenario.brandToken}`)
      .send({ action: 'approve' });
    // Influencer submits live URL
    await request(app)
      .post(`/v1/deliverables/${scenario.deliverableId}/submit-live`)
      .set('Authorization', `Bearer ${scenario.infToken}`)
      .send({ live_url: 'https://www.instagram.com/reel/live_abc123' });
    return scenario;
  }

  it('brand confirms live — status becomes live, campaign_influencer status becomes active', async () => {
    const { brandToken, deliverableId, ci } = await setupLiveUrlSubmitted();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/confirm-live`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deliverable.status).toBe('live');
    expect(res.body.data.deliverable.live_confirmed_at).toBeDefined();

    // campaign_influencer should be active
    const { rows } = await query(
      `SELECT status FROM campaign_influencers WHERE id = $1`,
      [ci.id]
    );
    expect(rows[0].status).toBe('active');
  });

  it('T2 tranche is released and influencer wallet is credited on confirm-live', async () => {
    const { brandToken, deliverableId, inf } = await setupLiveUrlSubmitted();

    // Get wallet balance before confirm
    const { rows: beforeRows } = await query(
      `SELECT wallet_balance FROM influencers WHERE id = $1`,
      [inf.id]
    );
    const balanceBefore = parseFloat(beforeRows[0].wallet_balance);

    await request(app)
      .post(`/v1/deliverables/${deliverableId}/confirm-live`)
      .set('Authorization', `Bearer ${brandToken}`);

    // After confirm: T2 = 25% of 10000 = 2500, platform_fee 8% = 200, net = 2300
    const { rows: afterRows } = await query(
      `SELECT wallet_balance FROM influencers WHERE id = $1`,
      [inf.id]
    );
    const balanceAfter = parseFloat(afterRows[0].wallet_balance);
    expect(balanceAfter - balanceBefore).toBeCloseTo(2300, 1);
  });

  it('T2 escrow_entry is released', async () => {
    const { brandToken, deliverableId, ci } = await setupLiveUrlSubmitted();

    await request(app)
      .post(`/v1/deliverables/${deliverableId}/confirm-live`)
      .set('Authorization', `Bearer ${brandToken}`);

    const { rows } = await query(
      `SELECT status FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number = 2`,
      [ci.id]
    );
    expect(rows[0].status).toBe('released');
  });

  it('sets t2_trigger_date on escrow_entry for T3 scheduling', async () => {
    const { brandToken, deliverableId, ci } = await setupLiveUrlSubmitted();

    await request(app)
      .post(`/v1/deliverables/${deliverableId}/confirm-live`)
      .set('Authorization', `Bearer ${brandToken}`);

    const { rows } = await query(
      `SELECT triggered_at FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number = 2`,
      [ci.id]
    );
    expect(rows[0].triggered_at).toBeDefined();
  });

  it('returns 422 when deliverable has no live_url yet', async () => {
    const { brandToken, deliverableId } = await setupActiveContract();
    // Skip to approved directly via DB
    await query(`UPDATE deliverables SET status = 'approved' WHERE id = $1`, [deliverableId]);

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/confirm-live`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(422);
  });

  it('returns 403 when influencer tries to confirm-live', async () => {
    const { infToken, deliverableId } = await setupLiveUrlSubmitted();

    const res = await request(app)
      .post(`/v1/deliverables/${deliverableId}/confirm-live`)
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(403);
  });
});
