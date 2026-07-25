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
const VALID_ROLES = ['brand', 'influencer', 'follower', 'agency'];

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
  } else if (user.role === 'agency') {
    const { rows } = await db.query(`SELECT id FROM agencies WHERE user_id = $1`, [user.id]);
    if (rows.length) payload.agency_id = rows[0].id;
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
    // New user — only role is required at this stage. Name + city + handles
    // are collected on the next screen (the profile-setup form) and posted
    // to the role-specific /register endpoint, which then updates this row.
    //
    // Why name is no longer required here: previously the OTPScreen would
    // submit verify-otp twice (once to discover the name was missing, once
    // with the name). The OTP service marks codes as used on first verify,
    // so the second call always failed with "Invalid OTP". Moving name
    // out of this step removes the double-verify entirely.
    if (!role) throw new AppError('VALIDATION_ERROR', 'role is required for new users', 422, 'role');
    if (!VALID_ROLES.includes(role)) {
      throw new AppError('VALIDATION_ERROR', `role must be one of: ${VALID_ROLES.join(', ')}`, 422, 'role');
    }

    // users.name is NOT NULL — use a placeholder until /register fills the
    // real one. Last 4 digits of the phone make it scannable in admin queues.
    const placeholderName = (name && name.trim()) || `Pending (${phone.slice(-4)})`;

    const created = await db.query(
      `INSERT INTO users (phone, role, name, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [phone, role, placeholderName]
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
  // Cookie path is used by the brand-web (HttpOnly cookie set on verify-otp).
  // Body path is used by mobile, which can't share cookies across fetch calls
  // and stores the refresh_token in AsyncStorage instead.
  const rawToken =
    (req.cookies && req.cookies.refresh_token) ||
    (req.body && req.body.refresh_token) ||
    null;
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

  // ── Rotate the refresh token ───────────────────────────────────────────────
  // Issue a new access token AND a brand-new 30-day refresh token. The OLD
  // refresh token is deliberately NOT revoked here: if the response is lost
  // (app killed mid-refresh, TCP reset on a mobile network), the device still
  // holds the old token — revoking it bricked the session permanently
  // ("Session expired" on every next action). The old token dies at its own
  // expires_at; storage is additive, so coexisting live tokens per user is
  // already the model. Explicit logout still revokes.
  //
  // For brand-web (cookie-based): the new refresh cookie is set in the
  // response so the browser carries it forward on the next refresh call.
  // For mobile (body-based): the new refresh_token is in the JSON response
  // body — the mobile API client persists it to AsyncStorage when present.
  const payload = await buildTokenPayload(user);
  const newAccessToken  = jwtService.generateAccessToken(payload);
  const newRefreshToken = jwtService.generateRefreshToken(user.id);

  await jwtService.storeRefreshToken(user.id, newRefreshToken);

  // Update the HttpOnly cookie for brand-web. Mobile ignores cookies.
  setRefreshCookie(res, newRefreshToken);

  return success(res, {
    access_token:  newAccessToken,
    refresh_token: newRefreshToken,
  });
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/fcm-token — register or update FCM device token
// ─────────────────────────────────────────────────────────────────────────────

const registerFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new AppError('VALIDATION_ERROR', 'token is required', 422, 'token');
  }

  await db.query(
    `UPDATE users SET fcm_token = $1 WHERE id = $2`,
    [token.trim(), req.user.sub]
  );

  return success(res, { message: 'FCM token registered' });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/onesignal-player-id — register OneSignal subscription ID
// ─────────────────────────────────────────────────────────────────────────────

const registerOneSignalPlayerId = asyncHandler(async (req, res) => {
  const { player_id } = req.body;

  if (!player_id || typeof player_id !== 'string' || !player_id.trim()) {
    throw new AppError('VALIDATION_ERROR', 'player_id is required', 422, 'player_id');
  }

  await db.query(
    `UPDATE users SET onesignal_player_id = $1 WHERE id = $2`,
    [player_id.trim(), req.user.sub]
  );

  return success(res, { message: 'OneSignal player ID registered' });
});

module.exports = { sendOtp, verifyOtp, refresh, logout, registerFcmToken, registerOneSignalPlayerId };
