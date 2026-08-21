'use strict';

/**
 * Test data factories.
 * Each factory creates a user via the real OTP flow, reading the generated
 * code back out of otp_codes, and returns { token, cookie, user }.
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

/**
 * Read the freshest unused OTP for a phone straight from the table.
 * There is no fixed test code any more — sendOtp() always mints a random
 * one, and the SMS dispatch is skipped under NODE_ENV=test.
 */
async function latestOtp(phone) {
  const { rows } = await query(
    `SELECT code FROM otp_codes
       WHERE phone = $1 AND used = false AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (rows.length === 0) throw new Error(`latestOtp: no live OTP row for ${phone}`);
  return rows[0].code;
}

async function loginUser(phone, role, name) {
  await request(app).post('/v1/auth/send-otp').send({ phone });
  const otp = await latestOtp(phone);
  const res = await request(app)
    .post('/v1/auth/verify-otp')
    .send({ phone, otp, role, name });

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
 *
 * Phase A4: AUTO-PROVISIONS an 'enterprise' tier brand_subscriptions row
 * so existing tests that create many campaigns/products/sets/invites are
 * not blocked by the new quotaCheck middleware. Tests that want to
 * exercise quota enforcement should call setBrandTier(brandId, 'free').
 * Override: pass `{ tier: 'free' }` to skip the enterprise upsert.
 */
async function registerBrand(token, overrides = {}) {
  const { tier: tierKeyOverride, ...registerOverrides } = overrides;
  const res = await request(app)
    .post('/v1/brands/register')
    .set('Authorization', `Bearer ${token}`)
    .send({
      // /brands/register requires (brand.controller.js:115-135):
      // business_name, category, name, city, state, address_line,
      // 6-digit pincode. The factory historically omitted
      // name/city/state — the cascade B2b revealed.
      name: registerOverrides.name || 'Test Brand Owner',
      business_name: registerOverrides.business_name || 'Test Restaurant Pvt Ltd',
      category: registerOverrides.category || 'restaurant',
      address_line: registerOverrides.address_line || '123 MG Road',
      city: registerOverrides.city || 'Vijayawada',
      state: registerOverrides.state || 'Andhra Pradesh',
      pincode: registerOverrides.pincode || '500001',
      ...registerOverrides,
    });

  if (res.status !== 201) {
    throw new Error(`registerBrand failed: ${JSON.stringify(res.body)}`);
  }
  const brand = res.body.data.brand;

  // Auto-provision enterprise-tier subscription so the new quotaCheck
  // middleware (Phase A4) doesn't break tests that create multiple
  // campaigns/products/sets per brand. Robust to missing seed: SELECT-
  // INTO-INSERT means if the requested tier doesn't exist, the INSERT
  // inserts 0 rows and we proceed without a subscription row (the
  // quotaCheck middleware will lazy-create a Free row on first call).
  // Skip with `{ tier: 'free' }` (or any other tier_key) when a test
  // wants to assert quota behavior.
  const tierKey = tierKeyOverride || 'enterprise';
  try {
    await query(
      `INSERT INTO brand_subscriptions
         (brand_id, tier_id, status, current_cycle_start, current_cycle_end)
       SELECT $1, t.id, 'active', current_date, current_date + 30
         FROM subscription_tiers t
        WHERE t.tier_key = $2`,
      [brand.id, tierKey]
    );
  } catch (_) {
    // unique-constraint violation (brand already has active sub) or
    // any other transient error — proceed silently; quotaCheck will
    // lazy-create on first call.
  }
  return brand;
}

/**
 * Upserts the active brand_subscriptions row for a brand to the given
 * tier_key. Used by quota tests to swap a brand between Free / Growth /
 * Pro / Enterprise plans. Cancels any existing active row first
 * (uniq_brand_subs_active partial unique would otherwise reject).
 */
async function setBrandTier(brandId, tierKey) {
  const { rows: tierRows } = await query(
    `SELECT id FROM subscription_tiers WHERE tier_key = $1 LIMIT 1`,
    [tierKey]
  );
  if (!tierRows[0]) throw new Error(`setBrandTier: tier '${tierKey}' not seeded`);
  // Cancel any prior active row (preserve history).
  await query(
    `UPDATE brand_subscriptions
        SET status = 'cancelled', cancelled_at = now()
      WHERE brand_id = $1 AND status = 'active'`,
    [brandId]
  );
  await query(
    `INSERT INTO brand_subscriptions
       (brand_id, tier_id, status, current_cycle_start, current_cycle_end)
     VALUES ($1, $2, 'active', current_date, current_date + 30)`,
    [brandId, tierRows[0].id]
  );
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
  latestOtp,
  setBrandTier,
};
