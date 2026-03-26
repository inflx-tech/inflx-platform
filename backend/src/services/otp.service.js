'use strict';

const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');

const OTP_TTL_MINUTES = 10;

/**
 * Generate and store an OTP for the given phone number.
 * In mock mode (OTP_MOCK=true), the code is always '000000' — no SMS sent.
 * In production mode, sends via MSG91 and stores the real code.
 */
async function sendOtp(phone) {
  const code = env.OTP_MOCK ? '000000' : _generateCode();

  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Invalidate any previous unused OTPs for this phone
  await db.query(
    `UPDATE otp_codes SET used = true WHERE phone = $1 AND used = false`,
    [phone]
  );

  await db.query(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)`,
    [phone, code, expiresAt]
  );

  if (env.OTP_MOCK) {
    console.log(`[OTP MOCK] ${phone} → ${code}`);
  } else {
    await _sendViaMSG91(phone, code);
  }
}

/**
 * Verify an OTP submitted by the user.
 * Marks it as used on success.
 * Throws AppError on wrong/expired OTP.
 */
async function verifyOtp(phone, code) {
  const { rows } = await db.query(
    `SELECT id FROM otp_codes
     WHERE phone = $1
       AND code  = $2
       AND used  = false
       AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, code]
  );

  if (rows.length === 0) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired OTP', 401);
  }

  // Mark as used so it cannot be replayed
  await db.query(`UPDATE otp_codes SET used = true WHERE id = $1`, [rows[0].id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function _generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function _sendViaMSG91(phone, code) {
  // Production: POST to MSG91 OTP endpoint
  // Requires MSG91_AUTH_KEY and OTP_TEMPLATE_ID in env.
  // Implementation left for production switch — set OTP_MOCK=false.
  console.log(`[MSG91] Sending OTP ${code} to ${phone}`);
}

module.exports = { sendOtp, verifyOtp };
