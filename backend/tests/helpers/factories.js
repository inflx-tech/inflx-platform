'use strict';

/**
 * Test data factories.
 * Each factory creates a user via the real OTP flow (OTP_MOCK=true → 000000)
 * and returns { token, cookie, user }.
 * Admin users are inserted directly to DB (no OTP flow needed in tests).
 */

const request = require('supertest');
const app = require('../../src/app');
const { query } = require('./db');
const jwtService = require('../../src/services/jwt.service');

let phoneCounter = 9800000000;

function nextPhone() {
  phoneCounter += 1;
  return `+91${phoneCounter}`;
}

async function loginUser(phone, role, name) {
  await request(app).post('/v1/auth/send-otp').send({ phone });
  const res = await request(app)
    .post('/v1/auth/verify-otp')
    .send({ phone, otp: '000000', role, name });

  if (res.status !== 200) {
    throw new Error(`loginUser failed: ${JSON.stringify(res.body)}`);
  }

  return {
    token: res.body.data.access_token,
    refreshToken: res.body.data.refresh_token,
    cookie: res.headers['set-cookie'] ? res.headers['set-cookie'][0] : null,
    user: res.body.data.user,
  };
}

async function createBrandUser(overrides = {}) {
  const phone = overrides.phone || nextPhone();
  const name = overrides.name || 'Test Brand Co';
  return loginUser(phone, 'brand', name);
}

async function createInfluencerUser(overrides = {}) {
  const phone = overrides.phone || nextPhone();
  const name = overrides.name || 'Test Influencer';
  return loginUser(phone, 'influencer', name);
}

async function createFollowerUser(overrides = {}) {
  const phone = overrides.phone || nextPhone();
  const name = overrides.name || 'Test Follower';
  return loginUser(phone, 'follower', name);
}

/**
 * Creates an admin directly in the DB and returns a signed JWT.
 * Bypasses the OTP flow since tests need deterministic admin tokens.
 */
async function createAdminUser(adminRole = 'superadmin') {
  const phone = nextPhone();
  const { rows } = await query(
    `INSERT INTO users (phone, role, name, status) VALUES ($1, 'admin', 'Admin User', 'approved') RETURNING *`,
    [phone]
  );
  const user = rows[0];
  await query(
    `INSERT INTO admin_profiles (user_id, admin_role) VALUES ($1, $2)`,
    [user.id, adminRole]
  );
  const token = jwtService.generateAccessToken({
    sub: user.id,
    role: 'admin',
    admin_role: adminRole,
  });
  return { token, user: { ...user, admin_role: adminRole } };
}

/**
 * Registers a brand profile for an already-authenticated brand user.
 * Returns the brand data from the API response.
 */
async function registerBrand(token, overrides = {}) {
  const res = await request(app)
    .post('/v1/brands/register')
    .set('Authorization', `Bearer ${token}`)
    .send({
      // /brands/register requires (brand.controller.js:115-135):
      // business_name, category, name, city, state, address_line,
      // 6-digit pincode. The factory historically omitted
      // name/city/state — the cascade B2b revealed.
      name: overrides.name || 'Test Brand Owner',
      business_name: overrides.business_name || 'Test Restaurant Pvt Ltd',
      category: overrides.category || 'restaurant',
      address_line: overrides.address_line || '123 MG Road',
      city: overrides.city || 'Vijayawada',
      state: overrides.state || 'Andhra Pradesh',
      pincode: overrides.pincode || '500001',
      ...overrides,
    });

  if (res.status !== 201) {
    throw new Error(`registerBrand failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.brand;
}

/**
 * Registers an influencer profile for an already-authenticated influencer user.
 */
async function registerInfluencer(token, overrides = {}) {
  const handle = overrides.instagram_handle || `testhandle_${Date.now()}`;
  const res = await request(app)
    .post('/v1/influencers/register')
    .set('Authorization', `Bearer ${token}`)
    // /influencers/register requires instagram_handle AND name
    // (influencer.controller.js:202,205). The factory historically
    // omitted name — the dominant Phase-3 cascade (×394).
    .send({ instagram_handle: handle, name: overrides.name || 'Test Influencer', ...overrides });

  if (res.status !== 201) {
    throw new Error(`registerInfluencer failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.influencer;
}

module.exports = {
  createBrandUser,
  createInfluencerUser,
  createFollowerUser,
  createAdminUser,
  registerBrand,
  registerInfluencer,
  loginUser,
};
