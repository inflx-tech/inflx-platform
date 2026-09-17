'use strict';

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const {
  createBrandUser,
  createAdminUser,
  registerBrand,
} = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/brands/register
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /v1/brands/register', () => {
  it('returns 201 and creates a brand profile in pending status', async () => {
    const { token } = await createBrandUser();

    const res = await request(app)
      .post('/v1/brands/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        business_name: 'Spice Garden Restaurant',
        category: 'restaurant',
        // brand register also requires name/city/state
        // (brand.controller.js:121-128)
        name: 'Ravi Kumar',
        city: 'Hyderabad',
        state: 'TG',
        address_line: '45 Park Lane, Banjara Hills',
        pincode: '500034',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.brand.business_name).toBe('Spice Garden Restaurant');
    expect(res.body.data.brand.category).toBe('restaurant');
    // User status should still be 'pending' (admin must approve)
    expect(res.body.data.user_status).toBe('pending');
  });

  it('returns 403 FORBIDDEN when called by a non-brand user', async () => {
    const { token } = await createBrandUser();
    // Trick: use a follower token
    const { token: followerToken } = await require('./helpers/factories').createFollowerUser();

    const res = await request(app)
      .post('/v1/brands/register')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ business_name: 'X', category: 'restaurant', address_line: 'Y', pincode: '500001' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 422 VALIDATION_ERROR when required fields are missing', async () => {
    const { token } = await createBrandUser();

    const res = await request(app)
      .post('/v1/brands/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'restaurant' }); // missing business_name

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('business_name');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /v1/brands/me', () => {
  it('returns own brand profile including wallet_balance', async () => {
    const { token } = await createBrandUser();
    await registerBrand(token);

    const res = await request(app)
      .get('/v1/brands/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.brand.business_name).toBeDefined();
    expect(res.body.data.brand.wallet_balance).toBeDefined();
    // Item 9 (migration 186): a new brand has NO campaign-fee override, so this is
    // null and it follows the platform-wide number. It used to default to 8.00, which
    // made every brand look overridden and left no way to say "no override" — the
    // admin pages had always read it as `platform_fee_pct ?? 8`, so null was the
    // intent all along and the column default was the accident.
    expect(res.body.data.brand.platform_fee_pct).toBeNull();
  });

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/v1/brands/me');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /v1/brands/me
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /v1/brands/me', () => {
  it('updates allowed brand fields and returns updated profile', async () => {
    const { token } = await createBrandUser();
    await registerBrand(token);

    const res = await request(app)
      .patch('/v1/brands/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ gstin: '36AABCU9603R1ZX', pincode: '500072' });

    expect(res.status).toBe(200);
    expect(res.body.data.brand.gstin).toBe('36AABCU9603R1ZX');
    expect(res.body.data.brand.pincode).toBe('500072');
  });

  it('returns 404 NOT_FOUND when brand profile has not been registered yet', async () => {
    const { token } = await createBrandUser();

    const res = await request(app)
      .patch('/v1/brands/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ pincode: '500072' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/:id  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /v1/brands/:id', () => {
  it('returns any brand profile for an admin user', async () => {
    const { token: brandToken } = await createBrandUser();
    const brand = await registerBrand(brandToken);
    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .get(`/v1/brands/${brand.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.brand.id).toBe(brand.id);
  });

  it('returns 403 FORBIDDEN when called by a non-admin user', async () => {
    const { token: brandToken } = await createBrandUser();
    const brand = await registerBrand(brandToken);

    const res = await request(app)
      .get(`/v1/brands/${brand.id}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /v1/brands/:id/status  (admin approve/reject)
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /v1/brands/:id/status', () => {
  it('approves a brand and updates user status to approved', async () => {
    const { token: brandToken } = await createBrandUser();
    const brand = await registerBrand(brandToken);
    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .patch(`/v1/brands/${brand.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.brand.approved_at).not.toBeNull();

    // Verify user status updated
    const profileRes = await request(app)
      .get('/v1/brands/me')
      .set('Authorization', `Bearer ${brandToken}`);
    expect(profileRes.body.data.user_status).toBe('approved');
  });

  it('rejects a brand and stores the rejection_reason', async () => {
    const { token: brandToken } = await createBrandUser();
    const brand = await registerBrand(brandToken);
    const { token: adminToken } = await createAdminUser('reviewer');

    const res = await request(app)
      .patch(`/v1/brands/${brand.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', reason: 'Incomplete business documents' });

    expect(res.status).toBe(200);
    expect(res.body.data.brand.rejection_reason).toBe('Incomplete business documents');
  });

  it('returns 403 FORBIDDEN when called by a non-admin user', async () => {
    const { token: brandToken } = await createBrandUser();
    const brand = await registerBrand(brandToken);

    const res = await request(app)
      .patch(`/v1/brands/${brand.id}/status`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/brands/resubmit
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /v1/brands/resubmit', () => {
  it('resets a rejected brand back to pending status', async () => {
    const { token: brandToken } = await createBrandUser();
    const brand = await registerBrand(brandToken);
    const { token: adminToken } = await createAdminUser('reviewer');

    // Admin rejects
    await request(app)
      .patch(`/v1/brands/${brand.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', reason: 'Missing docs' });

    // Brand resubmits
    const res = await request(app)
      .post('/v1/brands/resubmit')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ note: 'Docs have been uploaded now' });

    expect(res.status).toBe(200);
    expect(res.body.data.user_status).toBe('pending');
  });

  it('returns 409 CONFLICT when brand is not in rejected status', async () => {
    const { token } = await createBrandUser();
    await registerBrand(token); // status is pending, not rejected

    const res = await request(app)
      .post('/v1/brands/resubmit')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Trying to resubmit' });

    expect(res.status).toBe(409);
  });
});
