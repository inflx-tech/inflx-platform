'use strict';

const axios = require('axios');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');

const OTP_TTL_MINUTES = 10;
const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/';
const MSG91_TIMEOUT_MS = 10000;

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

/** Never log a subscriber's full number — keep enough to correlate in support. */
function _maskPhone(phone) {
  return `••••${String(phone).slice(-4)}`;
}

/**
 * Send the OTP through MSG91's v5 `flow` endpoint.
 *
 * NOT `/api/v5/otp`. That endpoint answers 200 {"type":"success"} with a
 * request_id and then fails asynchronously with error 400 — nothing is
 * submitted, nothing is billed, and no row appears in Logs, Advanced Logs or
 * API Failed Logs. The only visible symptom is a "SMS API has Failed" email.
 * Verified against this account on 2026-08-18: /otp dropped every send while
 * /flow delivered and billed correctly using the same template.
 *
 * We pass our own code rather than letting MSG91 generate one, so otp_codes
 * stays the single source of truth and verifyOtp() needs no network call.
 * `OTP` is the ##OTP## variable in the DLT-approved Inflx_OTP_Login template.
 *
 * Throws on any failure — the caller must not report "OTP sent" for an SMS
 * that never left.
 */
async function _sendViaMSG91(phone, code) {
  if (!env.MSG91_AUTH_KEY || !env.OTP_TEMPLATE_ID) {
    console.error('[MSG91] OTP_MOCK is false but MSG91_AUTH_KEY / OTP_TEMPLATE_ID are not set');
    throw new AppError('INTERNAL_ERROR', 'SMS provider is not configured', 500);
  }

  // Our phones are stored E.164 (+919876543210); MSG91 wants bare digits with
  // the country code and no '+'. Stripping non-digits covers both forms.
  const mobile = String(phone).replace(/\D/g, '');

  let response;
  try {
    response = await axios.post(
      MSG91_FLOW_URL,
      {
        template_id: env.OTP_TEMPLATE_ID,
        short_url: '0',
        recipients: [{ mobiles: mobile, OTP: code }],
      },
      {
        headers: {
          authkey: env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        timeout: MSG91_TIMEOUT_MS,
      }
    );
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error(`[MSG91] OTP send failed for ${_maskPhone(phone)}: ${detail}`);
    throw new AppError('INTERNAL_ERROR', 'Could not send OTP. Please try again.', 502);
  }

  // MSG91 answers HTTP 200 with {"type":"error"} for template, DLT and
  // balance problems, so a 2xx alone does not mean it was accepted.
  if (!response.data || response.data.type !== 'success') {
    console.error(`[MSG91] OTP rejected for ${_maskPhone(phone)}: ${JSON.stringify(response.data)}`);
    throw new AppError('INTERNAL_ERROR', 'Could not send OTP. Please try again.', 502);
  }
}

module.exports = { sendOtp, verifyOtp };
