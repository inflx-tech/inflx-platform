'use strict';

const ITEM4_DAY = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10); // item 4: sets need a posting date ≥ 7 days out
/**
 * Phase 2 — Blocks B, C, D
 * B: Offer inbox, accept, decline, 48h expiry cron
 * C: Start negotiation, respond (counter/accept/walkaway), get thread
 * D: Open-group publish
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

// ─── helpers ────────────────────────────────────────────────────────────────

async function approveUser(userId) {
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]);
}

/**
 * Creates a full invite scenario:
 *  - Approved brand with wallet funded
 *  - Approved influencer
 *  - Campaign + set
 *  - Invite sent → campaign_influencer row with status=invited
 * Returns everything needed for downstream tests.
 */
async function setupFullInvite({ agreed_fee = 5000 } = {}) {
  // Brand
  const { token: brandToken, user: brandUser } = await createBrandUser();
  await registerBrand(brandToken);
  await approveUser(brandUser.id);

  // Fund wallet
  const orderRes = await request(app)
    .post('/v1/brands/me/wallet/topup')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ amount: 100000 });
  await request(app)
    .post('/v1/brands/me/wallet/topup/verify')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({
      razorpay_order_id: orderRes.body.data.order_id,
      razorpay_payment_id: 'pay_setup_inv',
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
    .send({ name: 'Test Campaign', total_budget: 50000, start_date: '2026-07-01', end_date: '2026-07-31' });
  const cid = campaignRes.body.data.campaign.id;

  // Set
  const setRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Test Set', goal: 'engagement', assignment_mode: 'handpick', set_budget: 10000, formats_json: [{ type: 'reel', count: 1 }] });
  const sid = setRes.body.data.set.id;

  // Invite
  const inviteRes = await request(app)
    .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: inf.id, agreed_fee });
  const ci = inviteRes.body.data.campaign_influencer;

  return { brandToken, infToken, brandUser, infUser, inf, cid, sid, ci };
}

// ─────────────────────────────────────────────────────────────────────────────
// Block B — GET /v1/influencers/me/offers
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/influencers/me/offers', () => {
  it('returns invited offers for the authenticated influencer', async () => {
    const { infToken, ci } = await setupFullInvite();

    const res = await request(app)
      .get('/v1/influencers/me/offers')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.offers)).toBe(true);
    expect(res.body.data.offers.length).toBe(1);
    expect(res.body.data.offers[0].id).toBe(ci.id);
    expect(res.body.data.offers[0].status).toBe('invited');
    expect(res.body.data.offers[0].offer_expires_at).toBeDefined();
  });

  it('returns empty array when influencer has no offers', async () => {
    const { token: infToken } = await createInfluencerUser();
    await registerInfluencer(infToken, { instagram_handle: 'priya_sharma' });

    const res = await request(app)
      .get('/v1/influencers/me/offers')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.offers).toEqual([]);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/v1/influencers/me/offers');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a brand user', async () => {
    const { token: brandToken } = await createBrandUser();

    const res = await request(app)
      .get('/v1/influencers/me/offers')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block B — POST /v1/offers/:id/accept
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/offers/:id/accept', () => {
  it('accepts an offer and sets status=accepted', async () => {
    const { infToken, ci } = await setupFullInvite();

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/accept`)
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.campaign_influencer.status).toBe('accepted');
  });

  it('returns 404 for a non-existent offer', async () => {
    const { infToken } = await setupFullInvite();

    const res = await request(app)
      .post('/v1/offers/00000000-0000-0000-0000-000000000000/accept')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when another influencer tries to accept', async () => {
    const { ci } = await setupFullInvite();
    const { token: otherToken } = await createInfluencerUser();
    await registerInfluencer(otherToken, { instagram_handle: 'arun_kumar' });

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/accept`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 422 when trying to accept an already-accepted offer', async () => {
    const { infToken, ci } = await setupFullInvite();

    await request(app)
      .post(`/v1/offers/${ci.id}/accept`)
      .set('Authorization', `Bearer ${infToken}`);

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/accept`)
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without auth token', async () => {
    const { ci } = await setupFullInvite();
    const res = await request(app).post(`/v1/offers/${ci.id}/accept`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block B — POST /v1/offers/:id/decline
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/offers/:id/decline', () => {
  it('declines an offer and sets status=declined', async () => {
    const { infToken, ci } = await setupFullInvite();

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/decline`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ reason: 'not_relevant' });

    expect(res.status).toBe(200);
    expect(res.body.data.campaign_influencer.status).toBe('declined');
    expect(res.body.data.campaign_influencer.declined_reason).toBe('not_relevant');
  });

  it('returns 422 when reason is missing', async () => {
    const { infToken, ci } = await setupFullInvite();

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/decline`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('reason');
  });

  it('returns 422 for an invalid reason', async () => {
    const { infToken, ci } = await setupFullInvite();

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/decline`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ reason: 'invalid_reason_xyz' });

    expect(res.status).toBe(422);
  });

  it('returns 403 when a brand tries to decline', async () => {
    const { brandToken, ci } = await setupFullInvite();

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/decline`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ reason: 'not_relevant' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /v1/offers/:id/negotiate
// Only influencer can initiate negotiation
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/offers/:id/negotiate', () => {
  it('creates a negotiation thread with status=awaiting_brand', async () => {
    const { infToken, ci } = await setupFullInvite({ agreed_fee: 5000 });

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/negotiate`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ proposed_fee: 7500, note: 'My rates are higher in June' });

    expect(res.status).toBe(201);
    expect(res.body.data.negotiation.status).toBe('awaiting_brand');
    expect(res.body.data.negotiation.current_turn).toBe('brand');
    expect(res.body.data.turn.proposed_fee).toBeDefined();
    expect(parseFloat(res.body.data.turn.proposed_fee)).toBe(7500);
  });

  it('returns 403 when a brand tries to initiate negotiation', async () => {
    const { brandToken, ci } = await setupFullInvite();

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/negotiate`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ proposed_fee: 7000 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 422 when offer is not in invited status', async () => {
    const { infToken, ci } = await setupFullInvite();

    // Accept first
    await request(app)
      .post(`/v1/offers/${ci.id}/accept`)
      .set('Authorization', `Bearer ${infToken}`);

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/negotiate`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ proposed_fee: 7000 });

    expect(res.status).toBe(422);
  });

  it('returns 409 when a negotiation already exists for this offer', async () => {
    const { infToken, ci } = await setupFullInvite();

    await request(app)
      .post(`/v1/offers/${ci.id}/negotiate`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ proposed_fee: 7500 });

    const res = await request(app)
      .post(`/v1/offers/${ci.id}/negotiate`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ proposed_fee: 8000 });

    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /v1/negotiations/:id/respond
// Brand responds (counter/accept/walkaway). WRONG_TURN enforced.
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/negotiations/:id/respond', () => {
  async function setupNegotiation() {
    const scenario = await setupFullInvite({ agreed_fee: 5000 });
    const negRes = await request(app)
      .post(`/v1/offers/${scenario.ci.id}/negotiate`)
      .set('Authorization', `Bearer ${scenario.infToken}`)
      .send({ proposed_fee: 7500, note: 'Counter offer' });
    const negotiation = negRes.body.data.negotiation;
    return { ...scenario, negotiation };
  }

  it('brand can counter-offer (current_turn flips to influencer)', async () => {
    const { brandToken, negotiation } = await setupNegotiation();

    const res = await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'counter', proposed_fee: 6500 });

    expect(res.status).toBe(200);
    expect(res.body.data.negotiation.current_turn).toBe('influencer');
    expect(res.body.data.negotiation.status).toBe('awaiting_influencer');
  });

  it('brand can accept the negotiation', async () => {
    const { brandToken, negotiation } = await setupNegotiation();

    const res = await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(200);
    expect(res.body.data.negotiation.status).toBe('agreed');
    // campaign_influencer should be updated to accepted
    expect(res.body.data.campaign_influencer.status).toBe('accepted');
  });

  it('brand can walk away', async () => {
    const { brandToken, negotiation } = await setupNegotiation();

    const res = await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'walkaway' });

    expect(res.status).toBe(200);
    expect(res.body.data.negotiation.status).toBe('walked_away');
    expect(res.body.data.campaign_influencer.status).toBe('declined');
  });

  it('returns WRONG_TURN when influencer tries to respond when it is brand\'s turn', async () => {
    const { infToken, negotiation } = await setupNegotiation();
    // Negotiation is in awaiting_brand — influencer cannot respond

    const res = await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ action: 'counter', proposed_fee: 8000 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WRONG_TURN');
  });

  it('returns WRONG_TURN when brand tries to respond on influencer\'s turn', async () => {
    const { brandToken, infToken, negotiation } = await setupNegotiation();

    // Brand counters → now influencer's turn
    await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'counter', proposed_fee: 6500 });

    // Brand tries to respond again
    const res = await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'counter', proposed_fee: 6000 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WRONG_TURN');
  });

  it('influencer can respond after brand counter (turn alternation)', async () => {
    const { brandToken, infToken, negotiation } = await setupNegotiation();

    // Brand counters → influencer's turn
    await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'counter', proposed_fee: 6500 });

    // Influencer accepts
    const res = await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(200);
    expect(res.body.data.negotiation.status).toBe('agreed');
  });

  it('returns 422 for invalid action', async () => {
    const { brandToken, negotiation } = await setupNegotiation();

    const res = await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'invalid_action' });

    expect(res.status).toBe(422);
  });

  it('returns 422 when trying to respond to a closed negotiation', async () => {
    const { brandToken, negotiation } = await setupNegotiation();

    // Close it by accepting
    await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'accept' });

    // Try to respond again
    const res = await request(app)
      .post(`/v1/negotiations/${negotiation.id}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'counter', proposed_fee: 5000 });

    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — GET /v1/negotiations/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/negotiations/:id', () => {
  it('returns negotiation with all turns (brand can view)', async () => {
    const { brandToken, infToken, ci } = await setupFullInvite();

    const negRes = await request(app)
      .post(`/v1/offers/${ci.id}/negotiate`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ proposed_fee: 7500 });
    const negId = negRes.body.data.negotiation.id;

    await request(app)
      .post(`/v1/negotiations/${negId}/respond`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'counter', proposed_fee: 6500 });

    const res = await request(app)
      .get(`/v1/negotiations/${negId}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.negotiation.id).toBe(negId);
    expect(Array.isArray(res.body.data.turns)).toBe(true);
    expect(res.body.data.turns.length).toBe(2);
  });

  it('influencer can also view the negotiation thread', async () => {
    const { infToken, ci } = await setupFullInvite();

    const negRes = await request(app)
      .post(`/v1/offers/${ci.id}/negotiate`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ proposed_fee: 7500 });
    const negId = negRes.body.data.negotiation.id;

    const res = await request(app)
      .get(`/v1/negotiations/${negId}`)
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.negotiation.id).toBe(negId);
  });

  it('returns 404 for a non-existent negotiation', async () => {
    const { brandToken } = await setupFullInvite();

    const res = await request(app)
      .get('/v1/negotiations/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block D — POST /v1/campaigns/:cid/sets/:sid/publish-open
// Open-group sets get published; eligible influencers notified
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/campaigns/:cid/sets/:sid/publish-open', () => {
  async function setupOpenGroupScenario() {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await approveUser(brandUser.id);

    // Fund wallet
    const orderRes = await request(app)
      .post('/v1/brands/me/wallet/topup')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100000 });
    await request(app)
      .post('/v1/brands/me/wallet/topup/verify')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({
        razorpay_order_id: orderRes.body.data.order_id,
        razorpay_payment_id: 'pay_og',
        razorpay_signature: 'mock_sig',
      });

    const campaignRes = await request(app)
      .post('/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ name: 'Open Group Campaign', total_budget: 50000, start_date: '2026-07-01', end_date: '2026-07-31' });
    const cid = campaignRes.body.data.campaign.id;

    // Set with open_group mode
    const setRes = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment',
        name: 'Open Group Set',
        goal: 'engagement',
        // createSet persists `influencer_mode` (campaign.controller.js:428,
        // 489) — the canonical mode column. The legacy `assignment_mode`
        // input was never read by the API.
        influencer_mode: 'open_group',
        set_budget: 10000,
        open_group_slots: 5,
      });
    const sid = setRes.body.data.set.id;

    // Publish campaign first (needed before publishing set)
    await request(app)
      .post(`/v1/campaigns/${cid}/publish`)
      .set('Authorization', `Bearer ${brandToken}`);

    return { brandToken, cid, sid };
  }

  it('publishes the open-group set and returns 200', async () => {
    const { brandToken, cid, sid } = await setupOpenGroupScenario();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/publish-open`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.set.influencer_mode).toBe('open_group');
  });

  it('returns 422 when set is not open_group assignment mode', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await approveUser(brandUser.id);  // POST /campaigns is requireApproved (campaign.routes.js:12)

    const campaignRes = await request(app)
      .post('/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ name: 'Test', total_budget: 10000, start_date: '2026-07-01', end_date: '2026-07-31' });
    const cid = campaignRes.body.data.campaign.id;

    const setRes = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Handpick Set', goal: 'engagement', assignment_mode: 'handpick', set_budget: 10000, formats_json: [{ type: 'reel', count: 1 }] });
    const sid = setRes.body.data.set.id;

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/publish-open`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when called by an influencer', async () => {
    const { brandToken, cid, sid } = await setupOpenGroupScenario();
    const { token: infToken } = await createInfluencerUser();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/publish-open`)
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(403);
  });
});
