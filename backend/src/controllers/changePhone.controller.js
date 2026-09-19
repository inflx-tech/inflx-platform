'use strict';

/**
 * changePhone.controller.js — moving an account to a new login number.
 * Contract: features/change-login-number (spec + mockups N0–N6 locked 19 Sep 2026)
 *
 *   POST /auth/change-phone/start        → a code to the CURRENT number
 *   POST /auth/change-phone/verify-old   { otp }                 → { change_token } (15 min)
 *   POST /auth/change-phone/send-new     { change_token, new_phone } → a code to the NEW number
 *   POST /auth/change-phone/confirm      { change_token, otp }   → { phone, access_token, refresh_token }
 *
 * Rules (spec §3): old number verified first; the new number must be valid, different, and not
 * already hold an account of THIS role (one number may be a brand and a creator, never two of
 * the same); the change touches users.phone for this role only; every refresh token is revoked
 * and the device that made the change gets a fresh pair; an audit row is written; a pending or
 * rejected account may change its number; five wrong codes end the attempt; 15 minutes end to
 * end. Lost old phone → the team, offline (spec §5).
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const otpService = require('../services/otp.service');
const jwtService = require('../services/jwt.service');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

const PHONE_REGEX = /^\+91[6-9]\d{9}$/;           // the same rule sign-in applies
const CHANGE_TTL_SECONDS = 15 * 60;
const MAX_WRONG_CODES = 5;

const MSG = Object.freeze({
  SAME: "That's already your number.",
  TAKEN: (role) => `This number already has a ${role === 'influencer' ? 'creator' : role} account. Sign in with it instead.`,
  EXPIRED: 'Time\'s up. Start again from "Change number" — you have 15 minutes end to end.',
  TOO_MANY: 'Too many wrong codes. Start again from "Change number".',
  INVALID_PHONE: 'Enter a valid Indian mobile number.',
});

// Wrong-code counter per attempt (spec §3 rule 8). In process, keyed by user; an attempt that
// exceeds the cap is ended by clearing its counter and refusing, and the change token (if any)
// is no longer honoured because the counter reset marks the attempt id.
const attempts = new Map();   // userId -> { wrong, attemptId, at }
function attemptFor(userId) {
  const a = attempts.get(userId);
  if (a && Date.now() - a.at < CHANGE_TTL_SECONDS * 1000) return a;
  const fresh = { wrong: 0, attemptId: `${userId}:${Date.now()}`, at: Date.now() };
  attempts.set(userId, fresh);
  return fresh;
}
function endAttempt(userId) { attempts.delete(userId); }

async function loadUser(userId) {
  const { rows } = await db.query(`SELECT id, phone, role, status FROM users WHERE id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Account not found', 404);
  return rows[0];
}

function signChangeToken(user, attemptId, stage, newPhone) {
  return jwt.sign(
    { sub: user.id, purpose: 'phone_change', stage, attempt: attemptId, old_phone: user.phone, ...(newPhone ? { new_phone: newPhone } : {}) },
    env.JWT_SECRET,
    { expiresIn: CHANGE_TTL_SECONDS }
  );
}

function readChangeToken(token, userId, stage) {
  let p;
  try { p = jwt.verify(String(token || ''), env.JWT_SECRET); } catch (_) { throw new AppError('CHANGE_EXPIRED', MSG.EXPIRED, 401); }
  if (p.purpose !== 'phone_change' || p.sub !== userId) throw new AppError('CHANGE_EXPIRED', MSG.EXPIRED, 401);
  if (stage === 'new' && p.stage !== 'new') throw new AppError('CHANGE_EXPIRED', MSG.EXPIRED, 401);
  const a = attempts.get(userId);
  if (!a || a.attemptId !== p.attempt) throw new AppError('CHANGE_EXPIRED', MSG.EXPIRED, 401);
  return p;
}

async function verifyCode(userId, phone, otp) {
  const a = attemptFor(userId);
  if (!otp) throw new AppError('VALIDATION_ERROR', 'otp is required', 422, 'otp');
  try {
    await otpService.verifyOtp(phone, String(otp));
  } catch (e) {
    a.wrong += 1;
    if (a.wrong >= MAX_WRONG_CODES) { endAttempt(userId); throw new AppError('TOO_MANY_ATTEMPTS', MSG.TOO_MANY, 429); }
    throw e;
  }
  return a;
}

// 1. a code to the current number
const start = asyncHandler(async (req, res) => {
  const user = await loadUser(req.user.sub);
  endAttempt(user.id);
  attemptFor(user.id);
  await otpService.sendOtp(user.phone);
  return success(res, { sent_to: user.phone, message: 'Code sent to your current number.' });
});

// 2. the old number's code → change token
const verifyOld = asyncHandler(async (req, res) => {
  const user = await loadUser(req.user.sub);
  const a = await verifyCode(user.id, user.phone, req.body.otp);
  return success(res, { change_token: signChangeToken(user, a.attemptId, 'old'), expires_in: CHANGE_TTL_SECONDS });
});

// 3. the new number → a code to it
const sendNew = asyncHandler(async (req, res) => {
  const user = await loadUser(req.user.sub);
  readChangeToken(req.body.change_token, user.id, 'old');
  const newPhone = String(req.body.new_phone || '').replace(/[\s-]/g, '');
  if (!PHONE_REGEX.test(newPhone)) throw new AppError('VALIDATION_ERROR', MSG.INVALID_PHONE, 422, 'new_phone');
  if (newPhone === user.phone) throw new AppError('VALIDATION_ERROR', MSG.SAME, 422, 'new_phone');
  const { rows } = await db.query(`SELECT 1 FROM users WHERE phone = $1 AND role = $2`, [newPhone, user.role]);
  if (rows.length) throw new AppError('PHONE_TAKEN', MSG.TAKEN(user.role), 409, 'new_phone');
  await otpService.sendOtp(newPhone);
  const a = attemptFor(user.id);
  return success(res, { sent_to: newPhone, change_token: signChangeToken(user, a.attemptId, 'new', newPhone), expires_in: CHANGE_TTL_SECONDS });
});

// 4. the new number's code → the change
const confirm = asyncHandler(async (req, res) => {
  const user = await loadUser(req.user.sub);
  const p = readChangeToken(req.body.change_token, user.id, 'new');
  const newPhone = p.new_phone;
  await verifyCode(user.id, newPhone, req.body.otp);
  // re-check the race: someone registered this number for this role meanwhile
  const { rows: clash } = await db.query(`SELECT 1 FROM users WHERE phone = $1 AND role = $2 AND id <> $3`, [newPhone, user.role, user.id]);
  if (clash.length) { endAttempt(user.id); throw new AppError('PHONE_TAKEN', MSG.TAKEN(user.role), 409, 'new_phone'); }

  await db.withTransaction(async (tx) => {
    await tx.query(`UPDATE users SET phone = $2, updated_at = now() WHERE id = $1`, [user.id, newPhone]);
    await tx.query(
      `INSERT INTO phone_changes (user_id, role, old_phone, new_phone, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, user.role, user.phone, newPhone, req.ip || null, String(req.headers['user-agent'] || '').slice(0, 300) || null]);
  });
  await jwtService.revokeAllRefreshTokens(user.id);
  endAttempt(user.id);

  // The device that made the change keeps a session: a fresh pair, like sign-in.
  const { rows: fresh } = await db.query(`SELECT * FROM users WHERE id = $1`, [user.id]);
  const authCtrl = require('./auth.controller');
  const payload = await authCtrl.buildTokenPayload(fresh[0]);
  const accessToken = jwtService.generateAccessToken(payload);
  const refreshToken = jwtService.generateRefreshToken(user.id);
  await jwtService.storeRefreshToken(user.id, refreshToken);

  return success(res, { phone: newPhone, access_token: accessToken, refresh_token: refreshToken, message: `Your login number is now ${newPhone}.` });
});

module.exports = { start, verifyOld, sendNew, confirm, MSG, _attempts: attempts };
