'use strict';

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/admin/queue/brands
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /v1/admin/queue/brands', () => {
  it('returns pending brands for a reviewer admin', async () => {
    const { token: b1 } = await createBrandUser();
    const { token: b2 } = await createBrandUser();
    await registerBrand(b1);
    await registerBrand(b2);

    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .get('/v1/admin/queue/brands')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.brands.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
    res.body.data.brands.forEach(b => expect(b.user_status).toBe('pending'));
  });

  it('returns 403 FORBIDDEN for a non-admin user', async () => {
    const { token } = await createBrandUser();

    const res = await request(app)
      .get('/v1/admin/queue/brands')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/admin/queue/influencers
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /v1/admin/queue/influencers', () => {
  it('returns pending influencers for a reviewer admin', async () => {
    const { token: i1 } = await createInfluencerUser();
    const { token: i2 } = await createInfluencerUser();
    await registerInfluencer(i1, { instagram_handle: 'queue_handle_1' });
    await registerInfluencer(i2, { instagram_handle: 'queue_handle_2' });

    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .get('/v1/admin/queue/influencers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.influencers.length).toBe(2);
  });

  it('returns 403 FORBIDDEN for a non-admin user', async () => {
    const { token } = await createInfluencerUser();
    const res = await request(app)
      .get('/v1/admin/queue/influencers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /v1/admin/brands/:id/status
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /v1/admin/brands/:id/status', () => {
  it('approves a brand, sets approved_at, and fires a notification', async () => {
    const { token: brandToken } = await createBrandUser();
    const brand = await registerBrand(brandToken);
    // registration-and-profile §6: approval refuses an incomplete profile, so complete it first.
    await require('./helpers/factories').completeBrandProfile(brand.id);
    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .patch(`/v1/admin/brands/${brand.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.brand.approved_at).toBeTruthy();
    // Notification row must have been created
    expect(res.body.data.notification_sent).toBe(true);
  });

  it('rejects a brand and stores rejection_reason', async () => {
    const { token: brandToken } = await createBrandUser();
    const brand = await registerBrand(brandToken);
    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .patch(`/v1/admin/brands/${brand.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', reason: 'GST number missing' });

    expect(res.status).toBe(200);
    expect(res.body.data.brand.rejection_reason).toBe('GST number missing');
  });

  it('returns 403 for a finance admin (reviewer+ required)', async () => {
    const { token: brandToken } = await createBrandUser();
    const brand = await registerBrand(brandToken);
    // finance role cannot approve brands
    const { token: financeToken } = await createAdminUser('finance');

    const res = await request(app)
      .patch(`/v1/admin/brands/${brand.id}/status`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /v1/admin/influencers/:id/status
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /v1/admin/influencers/:id/status', () => {
  it('approves an influencer account', async () => {
    const { token: infToken } = await createInfluencerUser();
    const influencer = await registerInfluencer(infToken, { instagram_handle: 'approve_me' });
    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .patch(`/v1/admin/influencers/${influencer.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.influencer.approved_at).toBeTruthy();
  });

  it('rejects an influencer with a reason', async () => {
    const { token: infToken } = await createInfluencerUser();
    const influencer = await registerInfluencer(infToken, { instagram_handle: 'reject_me' });
    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .patch(`/v1/admin/influencers/${influencer.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', reason: 'Handle not found on Instagram' });

    expect(res.status).toBe(200);
    expect(res.body.data.influencer.rejection_reason).toBe('Handle not found on Instagram');
  });

  it('returns 403 for a non-admin user', async () => {
    const { token: infToken } = await createInfluencerUser();
    const influencer = await registerInfluencer(infToken, { instagram_handle: 'not_admin' });

    const res = await request(app)
      .patch(`/v1/admin/influencers/${influencer.id}/status`)
      .set('Authorization', `Bearer ${infToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/admin/stats
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /v1/admin/stats', () => {
  it('returns platform stats for a reviewer admin', async () => {
    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .get('/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.stats.pending_brands).toBeDefined();
    expect(res.body.data.stats.pending_influencers).toBeDefined();
    expect(res.body.data.stats.total_brands).toBeDefined();
    expect(res.body.data.stats.total_influencers).toBeDefined();
  });

  it('returns 403 for a non-admin user', async () => {
    const { token } = await createBrandUser();
    const res = await request(app)
      .get('/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/admin/users
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /v1/admin/users', () => {
  it('returns list of admin users for a superadmin', async () => {
    const { token: superToken } = await createAdminUser('superadmin');
    await createAdminUser('reviewer');

    const res = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.admin_users)).toBe(true);
    expect(res.body.data.admin_users.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 403 for a reviewer admin (superadmin only)', async () => {
    const { token: reviewerToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/admin/users
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /v1/admin/users', () => {
  it('creates a new admin user when called by superadmin', async () => {
    const { token: superToken } = await createAdminUser('superadmin');

    const res = await request(app)
      .post('/v1/admin/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        phone: '+919111222333',
        name: 'New Reviewer',
        admin_role: 'reviewer',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.admin_user.admin_role).toBe('reviewer');
    expect(res.body.data.admin_user.phone).toBe('+919111222333');
  });

  it('returns 403 when called by a reviewer admin', async () => {
    const { token: reviewerToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .post('/v1/admin/users')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ phone: '+919111222444', name: 'Another', admin_role: 'finance' });

    expect(res.status).toBe(403);
  });
});
