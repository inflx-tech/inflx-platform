'use strict';

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const { createInfluencerUser, registerInfluencer } = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/influencers/register
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /v1/influencers/register', () => {
  it('returns 201 and creates influencer profile with scraped Apify data', async () => {
    const { token } = await createInfluencerUser();

    const res = await request(app)
      .post('/v1/influencers/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ instagram_handle: 'foodie_priya_hyd' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.influencer.instagram_handle).toBe('foodie_priya_hyd');
    // Apify mock should have populated follower data
    expect(res.body.data.influencer.followers_count).toBeDefined();
    expect(res.body.data.influencer.engagement_rate).toBeDefined();
  });

  it('returns 403 FORBIDDEN when called by a non-influencer user', async () => {
    const { token } = await require('./helpers/factories').createBrandUser();

    const res = await request(app)
      .post('/v1/influencers/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ instagram_handle: 'foodie_priya_hyd' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 422 VALIDATION_ERROR when instagram_handle is missing', async () => {
    const { token } = await createInfluencerUser();

    const res = await request(app)
      .post('/v1/influencers/register')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('instagram_handle');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/influencers/me
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /v1/influencers/me', () => {
  it('returns own influencer profile including scraped fields', async () => {
    const { token } = await createInfluencerUser();
    await registerInfluencer(token, { instagram_handle: 'my_travel_gram' });

    const res = await request(app)
      .get('/v1/influencers/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.influencer.instagram_handle).toBe('my_travel_gram');
    expect(res.body.data.influencer.wallet_balance).toBeDefined();
    expect(res.body.data.influencer.pending_balance).toBeDefined();
    // Sensitive fields must not be returned in plain text
    expect(res.body.data.influencer.pan_number).toBeUndefined();
  });

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/v1/influencers/me');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /v1/influencers/me
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /v1/influencers/me', () => {
  it('updates editable fields: language, content_style, upi_id', async () => {
    const { token } = await createInfluencerUser();
    await registerInfluencer(token, { instagram_handle: 'patch_test_gram' });

    const res = await request(app)
      .patch('/v1/influencers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        language: ['Telugu', 'English'],
        content_style: 'Reels',
        upi_id: 'priya@upi',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.influencer.language).toEqual(['Telugu', 'English']);
    expect(res.body.data.influencer.content_style).toBe('Reels');
    // upi_id must be stored encrypted — response does not return raw value
    expect(res.body.data.influencer.upi_id).toBeUndefined();
  });

  it('returns 404 NOT_FOUND when influencer profile does not exist', async () => {
    const { token } = await createInfluencerUser();

    const res = await request(app)
      .patch('/v1/influencers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: ['Hindi'] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
