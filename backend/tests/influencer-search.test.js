'use strict';

/**
 * Block A1 — Influencer Search
 * GET /v1/influencers/search
 * GET /v1/influencers/:id
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  createAdminUser,
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
 * Create an influencer with a specific Instagram handle (for mock keying),
 * approve them, and return their data.
 */
async function createApprovedInfluencer(instagramHandle, overrides = {}) {
  const { token, user } = await createInfluencerUser();
  const influencer = await registerInfluencer(token, { instagram_handle: instagramHandle, ...overrides });
  await approveUser(user.id);
  return { token, user, influencer };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/influencers/search
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/influencers/search', () => {
  it('returns 200 with a list of approved influencers (brand token)', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);

    await createApprovedInfluencer('priya_sharma');
    await createApprovedInfluencer('arun_kumar');

    const res = await request(app)
      .get('/v1/influencers/search')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.creators)).toBe(true);
    expect(res.body.data.creators.length).toBe(2);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBe(2);
  });

  it('lists approved creators only; a pending creator is not shown to brands (item 3, founder Q14)', async () => {
    // Product decision 2026-05-19 showed pending creators too. Superseded 2026-09-11 by the
    // item 3 approval (rules v1.11, founder Q14): every creator list a brand sees is
    // approved-only, and the verified tag reflects the real status.
    // Contract: features/item3-discovery-profiles-groups
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);

    await createApprovedInfluencer('priya_sharma');

    const { token: pendingToken } = await createInfluencerUser();
    await registerInfluencer(pendingToken, { instagram_handle: 'arun_kumar', name: 'Arun' });

    const res = await request(app)
      .get('/v1/influencers/search')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.creators.length).toBe(1);
    const byHandle = Object.fromEntries(
      res.body.data.creators.map(c => [c.ig_handle, c])
    );
    expect(byHandle.priya_sharma).toBeDefined();
    expect(byHandle.arun_kumar).toBeUndefined();
    expect(byHandle.priya_sharma.is_verified).toBe(true);
  });

  it('filters by niche', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);

    await createApprovedInfluencer('priya_sharma');  // niche: food, lifestyle
    await createApprovedInfluencer('arun_kumar');    // niche: fitness, technology

    const res = await request(app)
      .get('/v1/influencers/search?niche=food')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.creators.length).toBe(1);
    expect(res.body.data.creators[0].ig_handle).toBe('priya_sharma');
  });

  it('filters by min_followers', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);

    await createApprovedInfluencer('priya_sharma');  // followers: 45200
    await createApprovedInfluencer('arun_kumar');    // followers: 120000

    const res = await request(app)
      .get('/v1/influencers/search?min_followers=100000')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.creators.length).toBe(1);
    expect(res.body.data.creators[0].ig_handle).toBe('arun_kumar');
  });

  it('filters by max_followers', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);

    await createApprovedInfluencer('priya_sharma');  // followers: 45200
    await createApprovedInfluencer('arun_kumar');    // followers: 120000

    const res = await request(app)
      .get('/v1/influencers/search?max_followers=50000')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.creators.length).toBe(1);
    expect(res.body.data.creators[0].ig_handle).toBe('priya_sharma');
  });

  it('filters by city (case-insensitive)', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);

    await createApprovedInfluencer('priya_sharma', { city: 'Hyderabad' });
    await createApprovedInfluencer('arun_kumar', { city: 'Mumbai' });

    const res = await request(app)
      .get('/v1/influencers/search?city=mumbai')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.creators.length).toBe(1);
    expect(res.body.data.creators[0].ig_handle).toBe('arun_kumar');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/v1/influencers/search');
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by an influencer role', async () => {
    const { token: influencerToken } = await createInfluencerUser();

    const res = await request(app)
      .get('/v1/influencers/search')
      .set('Authorization', `Bearer ${influencerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns search results with no sensitive fields', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);
    await createApprovedInfluencer('priya_sharma');

    const res = await request(app)
      .get('/v1/influencers/search')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    const inf = res.body.data.creators[0];
    expect(inf.pan_number).toBeUndefined();
    expect(inf.bank_account_no).toBeUndefined();
    expect(inf.upi_id).toBeUndefined();
    expect(inf.fcm_token).toBeUndefined();
    // Public fields should be present
    expect(inf.ig_handle).toBeDefined();
    expect(inf.followers_count).toBeDefined();
    expect(inf.view_based_er).toBeDefined();
    expect(inf.niche).toBeDefined();
    expect(inf.city).toBeDefined();
  });

  it('returns results accessible by admin role', async () => {
    const { token: adminToken } = await createAdminUser('superadmin');
    await createApprovedInfluencer('priya_sharma');

    const res = await request(app)
      .get('/v1/influencers/search')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.creators.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/influencers/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/influencers/:id', () => {
  it('returns 200 with public influencer profile (brand can view)', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);
    const { influencer } = await createApprovedInfluencer('priya_sharma');

    const res = await request(app)
      .get(`/v1/influencers/${influencer.id}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.influencer.id).toBe(influencer.id);
    expect(res.body.data.influencer.instagram_handle).toBe('priya_sharma');
    expect(res.body.data.influencer.followers_count).toBeDefined();
  });

  it('returns 404 for a non-existent influencer ID', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);

    const res = await request(app)
      .get('/v1/influencers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not return sensitive fields', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await approveUser(brandUser.id);
    const { influencer } = await createApprovedInfluencer('priya_sharma');

    const res = await request(app)
      .get(`/v1/influencers/${influencer.id}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    const inf = res.body.data.influencer;
    expect(inf.pan_number).toBeUndefined();
    expect(inf.bank_account_no).toBeUndefined();
    expect(inf.upi_id).toBeUndefined();
    expect(inf.fcm_token).toBeUndefined();
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/v1/influencers/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });
});
