'use strict';

const ITEM4_DAY = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10); // item 4: sets need a posting date ≥ 7 days out
/**
 * Phase 2 — Campaign, Set, Invite, Offer, Wallet, Publish tests
 * Blocks A2 through A6 (and later extended for B/C/D in separate files)
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  createAdminUser,
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

async function createRegisteredBrand() {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token);
  // Campaign routes require an approved brand (campaign.routes.js:9
  // `requireApproved`). Every campaign-flow test here needs a usable
  // brand; none asserts the unapproved-403 path (verified). Approve
  // here so the helper matches the contract it is used against —
  // fixture alignment, not assertion weakening.
  await approveUser(user.id);
  return { token, user, brand };
}

async function createApprovedBrand() {
  const { token, user, brand } = await createRegisteredBrand();
  await approveUser(user.id);
  const updatedBrand = await query(`SELECT * FROM brands WHERE id = $1`, [brand.id]);
  return { token, user, brand: updatedBrand.rows[0] };
}

async function createCampaign(token, overrides = {}) {
  const res = await request(app)
    .post('/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: overrides.name || 'Summer Sale Campaign',
      total_budget: overrides.total_budget !== undefined ? overrides.total_budget : 50000,
      start_date: overrides.start_date || '2026-06-01',
      end_date: overrides.end_date || '2026-06-30',
      ...overrides,
    });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/campaigns
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/campaigns', () => {
  it('returns 201 and creates a campaign in draft status', async () => {
    const { token } = await createRegisteredBrand();

    const res = await createCampaign(token, { name: 'Diwali Promotion' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.campaign.name).toBe('Diwali Promotion');
    expect(res.body.data.campaign.status).toBe('draft');
    expect(res.body.data.campaign.brand_id).toBeDefined();
    expect(res.body.data.campaign.id).toBeDefined();
  });

  it('returns 422 VALIDATION_ERROR when name is missing', async () => {
    const { token } = await createRegisteredBrand();

    const res = await request(app)
      .post('/v1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ total_budget: 50000 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('name');
  });

  it('returns 404 when brand profile has not been registered', async () => {
    const { token, user } = await createBrandUser();
    // POST /campaigns is requireApproved (campaign.routes.js:12). Approve
    // the user (but DON'T register a brand profile) so the request passes
    // the middleware and reaches the controller's NOT_FOUND 404
    // (campaign.controller.js:20) — the path this test actually asserts.
    await approveUser(user.id);

    const res = await createCampaign(token);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/v1/campaigns').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by an influencer role', async () => {
    const { token } = await createInfluencerUser();

    const res = await request(app)
      .post('/v1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/campaigns
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/campaigns', () => {
  it('returns 200 with brand\'s own campaigns', async () => {
    const { token } = await createRegisteredBrand();
    await createCampaign(token, { name: 'Campaign One' });
    await createCampaign(token, { name: 'Campaign Two' });

    const res = await request(app)
      .get('/v1/campaigns')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.campaigns)).toBe(true);
    expect(res.body.data.campaigns.length).toBe(2);
  });

  it('returns empty array when brand has no campaigns', async () => {
    const { token } = await createRegisteredBrand();

    const res = await request(app)
      .get('/v1/campaigns')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.campaigns).toEqual([]);
  });

  it('returns only own campaigns, not other brands\'', async () => {
    const { token: token1 } = await createRegisteredBrand();
    const { token: token2 } = await createRegisteredBrand();

    await createCampaign(token1, { name: 'Brand1 Campaign' });
    await createCampaign(token2, { name: 'Brand2 Campaign' });

    const res = await request(app)
      .get('/v1/campaigns')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.campaigns.length).toBe(1);
    expect(res.body.data.campaigns[0].name).toBe('Brand1 Campaign');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/v1/campaigns');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/campaigns/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/campaigns/:id', () => {
  it('returns 200 with campaign details', async () => {
    const { token } = await createRegisteredBrand();
    const createRes = await createCampaign(token, { name: 'Fetch Me' });
    const cid = createRes.body.data.campaign.id;

    const res = await request(app)
      .get(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.campaign.id).toBe(cid);
    expect(res.body.data.campaign.name).toBe('Fetch Me');
    expect(res.body.data.campaign.status).toBe('draft');
  });

  it('returns 404 for a non-existent campaign ID', async () => {
    const { token } = await createRegisteredBrand();

    const res = await request(app)
      .get('/v1/campaigns/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when campaign belongs to another brand', async () => {
    const { token: token1 } = await createRegisteredBrand();
    const { token: token2 } = await createRegisteredBrand();

    const createRes = await createCampaign(token1);
    const cid = createRes.body.data.campaign.id;

    const res = await request(app)
      .get(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /v1/campaigns/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /v1/campaigns/:id', () => {
  it('updates campaign name and budget', async () => {
    const { token } = await createRegisteredBrand();
    const createRes = await createCampaign(token);
    const cid = createRes.body.data.campaign.id;

    const res = await request(app)
      .patch(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', total_budget: 75000 });

    expect(res.status).toBe(200);
    expect(res.body.data.campaign.name).toBe('Updated Name');
    expect(parseFloat(res.body.data.campaign.total_budget)).toBe(75000);
  });

  it('returns 404 for a non-existent campaign', async () => {
    const { token } = await createRegisteredBrand();

    const res = await request(app)
      .patch('/v1/campaigns/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(404);
  });

  it('returns 403 when updating another brand\'s campaign', async () => {
    const { token: token1 } = await createRegisteredBrand();
    const { token: token2 } = await createRegisteredBrand();

    const createRes = await createCampaign(token1);
    const cid = createRes.body.data.campaign.id;

    const res = await request(app)
      .patch(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  // Item 4 (rules v1.14 §5B, mockup C11): a campaign can be renamed and its description edited
  // at any time; only the older money-adjacent fields stay draft-only.
  it('renames a published campaign; the legacy fields stay draft-only (item 4)', async () => {
    const { token } = await createApprovedBrand();
    const createRes = await createCampaign(token, { total_budget: 10000 });
    const cid = createRes.body.data.campaign.id;

    // Force campaign to published status directly
    await query(`UPDATE campaigns SET status = 'published' WHERE id = $1`, [cid]);

    let res = await request(app)
      .patch(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed while live' });
    expect(res.status).toBe(200);
    expect(res.body.data.campaign.name).toBe('Renamed while live');

    res = await request(app)
      .patch(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ allow_negotiation: false });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /v1/campaigns/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /v1/campaigns/:id', () => {
  it('deletes a draft campaign and returns 200', async () => {
    const { token } = await createRegisteredBrand();
    const createRes = await createCampaign(token);
    const cid = createRes.body.data.campaign.id;

    const res = await request(app)
      .delete(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Confirm deleted
    const check = await request(app)
      .get(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token}`);
    expect(check.status).toBe(404);
  });

  it('returns 403 when deleting another brand\'s campaign', async () => {
    const { token: token1 } = await createRegisteredBrand();
    const { token: token2 } = await createRegisteredBrand();

    const createRes = await createCampaign(token1);
    const cid = createRes.body.data.campaign.id;

    const res = await request(app)
      .delete(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(403);
  });

  it('returns 422 when trying to delete a published campaign', async () => {
    const { token } = await createApprovedBrand();
    const createRes = await createCampaign(token, { total_budget: 10000 });
    const cid = createRes.body.data.campaign.id;

    await query(`UPDATE campaigns SET status = 'published' WHERE id = $1`, [cid]);

    const res = await request(app)
      .delete(`/v1/campaigns/${cid}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/campaigns/:id/sets   (Block A3)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/campaigns/:id/sets', () => {
  it('creates a campaign set and returns 201', async () => {
    const { token } = await createRegisteredBrand();
    const campaignRes = await createCampaign(token);
    const cid = campaignRes.body.data.campaign.id;

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment',
        name: 'Hyderabad Food Influencers',
        goal: 'engagement',
        assignment_mode: 'handpick',
        set_budget: 20000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.set.name).toBe('Hyderabad Food Influencers');
    expect(res.body.data.set.goal).toBe('engagement');
    expect(res.body.data.set.campaign_id).toBe(cid);
  });

  it('returns 422 when set name is missing', async () => {
    const { token } = await createRegisteredBrand();
    const campaignRes = await createCampaign(token);
    const cid = campaignRes.body.data.campaign.id;

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', goal: 'engagement' });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('name');
  });

  it('returns 403 when adding a set to another brand\'s campaign', async () => {
    const { token: token1 } = await createRegisteredBrand();
    const { token: token2 } = await createRegisteredBrand();

    const campaignRes = await createCampaign(token1);
    const cid = campaignRes.body.data.campaign.id;

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Hijack Set', goal: 'engagement' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /v1/campaigns/:cid/sets/:sid   (Block A3)
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /v1/campaigns/:cid/sets/:sid', () => {
  async function createSet(token, cid, overrides = {}) {
    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment',
        name: overrides.name || 'Test Set',
        goal: overrides.goal || 'engagement',
        assignment_mode: overrides.assignment_mode || 'handpick',
        set_budget: overrides.set_budget || 10000,
        ...overrides,
      });
    return res.body.data.set;
  }

  it('updates set fields and returns 200', async () => {
    const { token } = await createRegisteredBrand();
    const campaignRes = await createCampaign(token);
    const cid = campaignRes.body.data.campaign.id;
    const set = await createSet(token, cid);

    const res = await request(app)
      .patch(`/v1/campaigns/${cid}/sets/${set.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Set Name', set_budget: 25000 });

    expect(res.status).toBe(200);
    expect(res.body.data.set.name).toBe('Updated Set Name');
    // updateSet allows `set_budget` (campaign.controller.js:512); the
    // response is the campaign_sets row (column `set_budget`, not `budget`).
    expect(parseFloat(res.body.data.set.set_budget)).toBe(25000);
  });

  it('returns 403 when updating another brand\'s set', async () => {
    const { token: token1 } = await createRegisteredBrand();
    const { token: token2 } = await createRegisteredBrand();

    const campaignRes = await createCampaign(token1);
    const cid = campaignRes.body.data.campaign.id;
    const set = await createSet(token1, cid);

    const res = await request(app)
      .patch(`/v1/campaigns/${cid}/sets/${set.id}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ name: 'Hijacked Set' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /v1/campaigns/:cid/sets/:sid   (Block A3)
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /v1/campaigns/:cid/sets/:sid', () => {
  async function createSet(token, cid, overrides = {}) {
    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Delete Me', goal: 'engagement', set_budget: 10000, ...overrides });
    return res.body.data.set;
  }

  it('deletes a set and returns 200', async () => {
    const { token } = await createRegisteredBrand();
    const campaignRes = await createCampaign(token);
    const cid = campaignRes.body.data.campaign.id;
    const set = await createSet(token, cid);
    // deleteSet blocks removing the LAST set — a campaign must keep ≥1
    // (campaign.controller.js:550). Create a second so this delete is valid.
    await createSet(token, cid, { name: 'Keeper Set' });

    const res = await request(app)
      .delete(`/v1/campaigns/${cid}/sets/${set.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when deleting another brand\'s set', async () => {
    const { token: token1 } = await createRegisteredBrand();
    const { token: token2 } = await createRegisteredBrand();

    const campaignRes = await createCampaign(token1);
    const cid = campaignRes.body.data.campaign.id;
    const set = await createSet(token1, cid);

    const res = await request(app)
      .delete(`/v1/campaigns/${cid}/sets/${set.id}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/campaigns/:cid/sets/:sid/invite   (Block A invite)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/campaigns/:cid/sets/:sid/invite', () => {
  async function setupInviteScenario() {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await approveUser(brandUser.id);

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'priya_sharma' });
    await approveUser(infUser.id);

    const campaignRes = await createCampaign(brandToken);
    const cid = campaignRes.body.data.campaign.id;

    const setRes = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Invite Set', goal: 'engagement', assignment_mode: 'handpick', set_budget: 10000 });
    const sid = setRes.body.data.set.id;

    return { brandToken, inf, cid, sid };
  }

  it('returns 201 and creates a campaign_influencer row with status=invited', async () => {
    const { brandToken, inf, cid, sid } = await setupInviteScenario();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ influencer_id: inf.id, agreed_fee: 5000 });

    expect(res.status).toBe(201);
    expect(res.body.data.campaign_influencer.influencer_id).toBe(inf.id);
    expect(res.body.data.campaign_influencer.status).toBe('invited');
    expect(res.body.data.campaign_influencer.offer_expires_at).toBeDefined();
  });

  it('returns 409 when the same influencer is already invited to this set', async () => {
    const { brandToken, inf, cid, sid } = await setupInviteScenario();

    await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ influencer_id: inf.id, agreed_fee: 5000 });

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ influencer_id: inf.id, agreed_fee: 5000 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 when influencer does not exist', async () => {
    const { brandToken, cid, sid } = await setupInviteScenario();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ influencer_id: '00000000-0000-0000-0000-000000000000', agreed_fee: 5000 });

    expect(res.status).toBe(404);
  });

  it('returns 422 when influencer_id is missing', async () => {
    const { brandToken, cid, sid } = await setupInviteScenario();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ agreed_fee: 5000 });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('influencer_id');
  });

  it('returns 403 when called by an influencer', async () => {
    const { inf, cid, sid } = await setupInviteScenario();
    const { token: otherToken } = await createInfluencerUser();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/invite`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ influencer_id: inf.id });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/campaigns/:cid/sets/:sid/offers   (Block A4)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/campaigns/:cid/sets/:sid/offers', () => {
  async function setupOfferScenario() {
    const { token: brandToken } = await createRegisteredBrand();
    const campaignRes = await createCampaign(brandToken);
    const cid = campaignRes.body.data.campaign.id;

    const setRes = await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Offer Set', goal: 'conversion', assignment_mode: 'handpick', coupon_prefix: 'TESTCPN' });
    const sid = setRes.body.data.set.id;

    return { brandToken, cid, sid };
  }

  it('creates a flat discount offer and returns 201', async () => {
    const { brandToken, cid, sid } = await setupOfferScenario();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({
        offer_type: 'flat',
        discount_value: 200,
        availing_modes: ['pay_at_store', 'prebook'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.offer.offer_type).toBe('flat');
    expect(parseFloat(res.body.data.offer.discount_value)).toBe(200);
    expect(res.body.data.offer.campaign_id).toBe(cid);
    expect(res.body.data.offer.set_id).toBe(sid);
  });

  it('creates a percentage discount offer', async () => {
    const { brandToken, cid, sid } = await setupOfferScenario();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({
        offer_type: 'percentage',
        discount_value: 20,
        availing_modes: ['pay_at_store'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.offer.offer_type).toBe('percentage');
  });

  it('returns 422 when offer_type is missing', async () => {
    const { brandToken, cid, sid } = await setupOfferScenario();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ discount_value: 100 });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('offer_type');
  });

  it('returns 403 when adding offer to another brand\'s campaign', async () => {
    const { cid, sid } = await setupOfferScenario();
    const { token: otherToken } = await createRegisteredBrand();

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/sets/${sid}/offers`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ offer_type: 'flat', discount_value: 100, availing_modes: ['pay_at_store'] });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/wallet   (Block A5)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/brands/me/wallet', () => {
  it('returns wallet balance and 200', async () => {
    const { token } = await createRegisteredBrand();

    const res = await request(app)
      .get('/v1/brands/me/wallet')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // getWallet nests under data.wallet (wallet.controller.js:68-74)
    expect(res.body.data.wallet.wallet_balance).toBeDefined();
    expect(parseFloat(res.body.data.wallet.wallet_balance)).toBe(0);
  });

  it('returns 404 when brand profile not registered', async () => {
    const { token } = await createBrandUser();

    const res = await request(app)
      .get('/v1/brands/me/wallet')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/v1/brands/me/wallet');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/brands/me/wallet/topup   (Block A5)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/brands/me/wallet/topup', () => {
  it('creates a Razorpay order and returns 201 with order details', async () => {
    const { token } = await createRegisteredBrand();

    const res = await request(app)
      .post('/v1/brands/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10000 });

    expect(res.status).toBe(201);
    expect(res.body.data.order_id).toBeDefined();
    // amount is paise at the Razorpay boundary (wallet.controller.js:104;
    // CLAUDE.md — Razorpay checkout requires paise). ₹10000 = 1000000 paise.
    expect(res.body.data.amount).toBe(1000000);
    expect(res.body.data.currency).toBe('INR');
    expect(res.body.data.key_id).toBeDefined();
  });

  it('returns 422 when amount is missing or zero', async () => {
    const { token } = await createRegisteredBrand();

    const res = await request(app)
      .post('/v1/brands/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 0 });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('amount');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/brands/me/wallet/topup/verify   (Block A5)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/brands/me/wallet/topup/verify', () => {
  it('credits wallet when RAZORPAY_MOCK=true (skips HMAC)', async () => {
    const { token } = await createRegisteredBrand();

    // Create order first
    const orderRes = await request(app)
      .post('/v1/brands/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5000 });

    const { order_id } = orderRes.body.data;

    const res = await request(app)
      .post('/v1/brands/me/wallet/topup/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razorpay_order_id: order_id,
        razorpay_payment_id: 'pay_mocktest123',
        razorpay_signature: 'mock_sig_bypass',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.wallet_balance).toBeDefined();
    expect(parseFloat(res.body.data.wallet_balance)).toBe(5000);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('returns 422 when required fields are missing', async () => {
    const { token } = await createRegisteredBrand();

    const res = await request(app)
      .post('/v1/brands/me/wallet/topup/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ razorpay_payment_id: 'pay_123' });

    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/wallet/transactions   (Block A5)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/brands/me/wallet/transactions', () => {
  it('returns empty list when no transactions', async () => {
    const { token } = await createRegisteredBrand();

    const res = await request(app)
      .get('/v1/brands/me/wallet/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toEqual([]);
  });

  it('returns transactions after a topup', async () => {
    const { token } = await createRegisteredBrand();

    // Topup → verify
    const orderRes = await request(app)
      .post('/v1/brands/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 3000 });

    await request(app)
      .post('/v1/brands/me/wallet/topup/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razorpay_order_id: orderRes.body.data.order_id,
        razorpay_payment_id: 'pay_txlist123',
        razorpay_signature: 'mock_sig',
      });

    const res = await request(app)
      .get('/v1/brands/me/wallet/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBe(1);
    expect(res.body.data.transactions[0].type).toBe('topup');
    expect(parseFloat(res.body.data.transactions[0].amount)).toBe(3000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/campaigns/:id/publish   (Block A6)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/campaigns/:id/publish', () => {
  async function fundedBrandWithCampaign(budget) {
    const { token, user } = await createBrandUser();
    const brand = await registerBrand(token);
    await approveUser(user.id);

    // Top up wallet
    const orderRes = await request(app)
      .post('/v1/brands/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: budget });

    await request(app)
      .post('/v1/brands/me/wallet/topup/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razorpay_order_id: orderRes.body.data.order_id,
        razorpay_payment_id: 'pay_publish_test',
        razorpay_signature: 'mock_sig',
      });

    // Create campaign
    const campaignRes = await createCampaign(token, { total_budget: budget });
    const cid = campaignRes.body.data.campaign.id;

    // Publish requires ≥1 set (campaign.controller.js:900). Engagement set
    // needs set_budget (:452); set_budget ≤ campaign budget (:474).
    await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Set 1', goal: 'engagement', assignment_mode: 'handpick', set_budget: budget });

    return { token, cid, brandId: brand.id };
  }

  it('publishes a campaign, sets status active, and returns 200', async () => {
    const { token, cid, brandId } = await fundedBrandWithCampaign(50000);

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/publish`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Publish sets status 'active' and returns { campaign } only
    // (campaign.controller.js:959/1031).
    expect(res.body.data.campaign.status).toBe('active');
    expect(res.body.data.campaign.published_at).toBeDefined();
    // Publish moves NO money — funds stay in wallet, locked per-influencer
    // at brand-sign (campaign.controller.js:942-946). Verify no debit.
    const { rows } = await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brandId]);
    expect(parseFloat(rows[0].wallet_balance)).toBe(50000);
  });

  it('returns 422 WALLET_INSUFFICIENT when balance is less than total_budget', async () => {
    const { token, user } = await createBrandUser();
    await registerBrand(token);
    await approveUser(user.id);

    // Campaign budget = 50000 but wallet = 0
    const campaignRes = await createCampaign(token, { total_budget: 50000 });
    const cid = campaignRes.body.data.campaign.id;

    // Engagement set so publish passes the ≥1-set gate (:900) and reaches
    // the wallet check (:935); wallet 0 < 50000 → WALLET_INSUFFICIENT.
    await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Set 1', goal: 'engagement', assignment_mode: 'handpick', set_budget: 50000 });

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/publish`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WALLET_INSUFFICIENT');
  });

  it('returns 422 when campaign has no total_budget set', async () => {
    const { token, user } = await createBrandUser();
    await registerBrand(token);
    await approveUser(user.id);

    // Create campaign WITH required dates (campaign.controller.js:190-193)
    // but NO total_budget.
    const campaignRes = await request(app)
      .post('/v1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Budget Campaign', start_date: '2026-07-01', end_date: '2026-07-31' });
    const cid = campaignRes.body.data.campaign.id;

    // Engagement set → publish reaches the total_budget check (:909).
    await request(app)
      .post(`/v1/campaigns/${cid}/sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ go_live_date: ITEM4_DAY, shoot_mode: 'shipment', name: 'Set 1', goal: 'engagement', assignment_mode: 'handpick', set_budget: 5000 });

    const res = await request(app)
      .post(`/v1/campaigns/${cid}/publish`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  it('returns 422 when campaign is already published', async () => {
    const { token, cid } = await fundedBrandWithCampaign(10000);

    // Publish first time
    await request(app)
      .post(`/v1/campaigns/${cid}/publish`)
      .set('Authorization', `Bearer ${token}`);

    // Try to publish again
    const res = await request(app)
      .post(`/v1/campaigns/${cid}/publish`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does NOT create an escrow_lock wallet_transaction at publish (escrow locks at brand-sign)', async () => {
    const { token, cid } = await fundedBrandWithCampaign(20000);

    const pubRes = await request(app)
      .post(`/v1/campaigns/${cid}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(pubRes.status).toBe(200);

    const res = await request(app)
      .get('/v1/brands/me/wallet/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const txs = res.body.data.transactions;
    // Publish moves NO money (campaign.controller.js:942-946); escrow_lock
    // is created per-influencer at brand-sign, NOT at publish.
    const escrowTx = txs.find(t => t.type === 'escrow_lock');
    expect(escrowTx).toBeUndefined();
  });
});
