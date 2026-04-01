'use strict';

const otpService = require('../services/otp.service');
const jwtService = require('../services/jwt.service');
const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PHONE_REGEX = /^\+91[6-9]\d{9}$/; // Indian mobile numbers only
const VALID_ROLES = ['brand', 'influencer', 'follower'];

function setRefreshCookie(res, token) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict', // 'none' for cross-origin (Vercel → Render)
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    path: '/v1/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refresh_token', {
    path: '/v1/auth',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
    secure: env.NODE_ENV === 'production',
  });
}

/**
 * Build the access token payload for a user.
 * Fetches admin_role from admin_profiles if the user is an admin.
 */
async function buildTokenPayload(user) {
  const payload = { sub: user.id, role: user.role };

  if (user.role === 'brand') {
    const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [user.id]);
    if (rows.length) payload.brand_id = rows[0].id;
  } else if (user.role === 'influencer') {
    const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [user.id]);
    if (rows.length) payload.influencer_id = rows[0].id;
  } else if (user.role === 'admin') {
    const { rows } = await db.query(`SELECT admin_role FROM admin_profiles WHERE user_id = $1`, [user.id]);
    if (rows.length) payload.admin_role = rows[0].admin_role;
  }

  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/send-otp
// ─────────────────────────────────────────────────────────────────────────────

const sendOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) throw new AppError('VALIDATION_ERROR', 'phone is required', 422, 'phone');
  if (!PHONE_REGEX.test(phone)) {
    throw new AppError('VALIDATION_ERROR', 'phone must be a valid Indian mobile number in E.164 format (e.g. +919876543210)', 422, 'phone');
  }

  await otpService.sendOtp(phone);

  return success(res, { message: 'OTP sent successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/verify-otp
// ─────────────────────────────────────────────────────────────────────────────

const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp, role, name } = req.body;

  if (!phone) throw new AppError('VALIDATION_ERROR', 'phone is required', 422, 'phone');
  if (!otp) throw new AppError('VALIDATION_ERROR', 'otp is required', 422, 'otp');

  // Verify OTP — throws AppError on failure
  await otpService.verifyOtp(phone, otp);

  // Find or create the user
  let { rows } = await db.query(`SELECT * FROM users WHERE phone = $1`, [phone]);
  let user;

  if (rows.length === 0) {
    // New user — role and name are required
    if (!role) throw new AppError('VALIDATION_ERROR', 'role is required for new users', 422, 'role');
    if (!VALID_ROLES.includes(role)) {
      throw new AppError('VALIDATION_ERROR', `role must be one of: ${VALID_ROLES.join(', ')}`, 422, 'role');
    }
    if (!name || !name.trim()) throw new AppError('VALIDATION_ERROR', 'name is required for new users', 422, 'name');

    const created = await db.query(
      `INSERT INTO users (phone, role, name, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [phone, role, name.trim()]
    );
    user = created.rows[0];

    // Create an empty profile row for follower role (brand/influencer do it via /register)
    if (role === 'follower') {
      await db.query(`INSERT INTO followers (user_id) VALUES ($1)`, [user.id]);
      // Followers are auto-approved
      await db.query(`UPDATE users SET status = 'approved' WHERE id = $1`, [user.id]);
      user.status = 'approved';
    }
  } else {
    user = rows[0];
  }

  // Build token payload (includes brand_id / influencer_id / admin_role)
  const payload = await buildTokenPayload(user);

  const accessToken = jwtService.generateAccessToken(payload);
  const refreshToken = jwtService.generateRefreshToken(user.id);

  await jwtService.storeRefreshToken(user.id, refreshToken);
  setRefreshCookie(res, refreshToken);

  const safeUser = {
    id: user.id,
    phone: user.phone,
    role: user.role,
    name: user.name,
    status: user.status,
  };

  return success(res, {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: safeUser,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/refresh
// ─────────────────────────────────────────────────────────────────────────────

const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies && req.cookies.refresh_token;
  if (!rawToken) {
    throw new AppError('UNAUTHORIZED', 'No refresh token found', 401);
  }

  // Validate against DB (checks revoked flag and expiry)
  const storedToken = await jwtService.validateRefreshToken(rawToken);

  // Fetch latest user data to rebuild payload
  const { rows } = await db.query(`SELECT * FROM users WHERE id = $1`, [storedToken.user_id]);
  if (rows.length === 0) {
    throw new AppError('UNAUTHORIZED', 'User not found', 401);
  }
  const user = rows[0];

  const payload = await buildTokenPayload(user);
  const newAccessToken = jwtService.generateAccessToken(payload);

  return success(res, { access_token: newAccessToken });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────────────────────────────────────

const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies && req.cookies.refresh_token;

  if (rawToken) {
    await jwtService.revokeRefreshToken(rawToken).catch(() => {
      // Ignore errors — token may already be expired or not found
    });
  }

  clearRefreshCookie(res);
  return success(res, { message: 'Logged out successfully' });
});

module.exports = { sendOtp, verifyOtp, refresh, logout };
