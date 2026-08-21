'use strict';

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const { latestOtp } = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/auth/send-otp
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/send-otp', () => {
  it('returns 200 and a success message for a valid Indian phone number', async () => {
    const res = await request(app)
      .post('/v1/auth/send-otp')
      .send({ phone: '+919876543210' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/otp sent/i);
  });

  it('returns 422 VALIDATION_ERROR when phone is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/send-otp')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('phone');
  });

  it('returns 422 VALIDATION_ERROR for a non-E.164 phone number', async () => {
    const res = await request(app)
      .post('/v1/auth/send-otp')
      .send({ phone: '9876543210' }); // missing +91 prefix

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('phone');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/auth/verify-otp
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/verify-otp', () => {
  const phone = '+919876543210';

  beforeEach(async () => {
    await request(app).post('/v1/auth/send-otp').send({ phone });
  });

  it('returns 200 with access_token, refresh_token, and user for correct OTP (new user)', async () => {
    const otp = await latestOtp(phone);
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone, otp, role: 'brand', name: 'My Brand' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    expect(res.body.data.user.phone).toBe(phone);
    expect(res.body.data.user.role).toBe('brand');
    // HttpOnly refresh-token cookie must be set
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refresh_token=/);
  });

  it('returns 401 UNAUTHORIZED for a wrong OTP', async () => {
    // Codes are random now, so derive a value guaranteed not to match rather
    // than hardcoding one that could collide (1-in-900k) and flake.
    const real = await latestOtp(phone);
    const wrong = real === '111111' ? '222222' : '111111';
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone, otp: wrong, role: 'brand', name: 'My Brand' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 for an existing user without requiring role again', async () => {
    // Create user on first login
    await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone, otp: await latestOtp(phone), role: 'brand', name: 'My Brand' });

    // Re-send OTP and log in again — the first code is now spent, so this
    // must read the newly minted one.
    await request(app).post('/v1/auth/send-otp').send({ phone });
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone, otp: await latestOtp(phone) }); // no role or name needed

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('brand');
  });

  it('returns 422 VALIDATION_ERROR when role is missing for a new user', async () => {
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone, otp: await latestOtp(phone) }); // new user but no role

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('role');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/refresh', () => {
  async function getSession() {
    const phone = '+919000011111';
    await request(app).post('/v1/auth/send-otp').send({ phone });
    const otp = await latestOtp(phone);
    return request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone, otp, role: 'follower', name: 'Refresh Tester' });
  }

  it('returns a new access_token when a valid refresh_token cookie is present', async () => {
    const login = await getSession();
    const cookie = login.headers['set-cookie'][0];

    const res = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toBeDefined();
  });

  it('returns 401 when no refresh_token cookie is present', async () => {
    const res = await request(app).post('/v1/auth/refresh');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/logout', () => {
  it('returns 200 and makes the refresh token unusable afterwards', async () => {
    const phone = '+919000022222';
    await request(app).post('/v1/auth/send-otp').send({ phone });
    const otp = await latestOtp(phone);
    const login = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone, otp, role: 'follower', name: 'Logout Tester' });

    const cookie = login.headers['set-cookie'][0];
    const token = login.body.data.access_token;

    const logoutRes = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);

    // Refresh should now be rejected
    const refreshRes = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });

  it('returns 401 when called without a Bearer token', async () => {
    const res = await request(app).post('/v1/auth/logout');
    expect(res.status).toBe(401);
  });
});
