'use strict';

const axios = require('axios');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');

const OTP_TTL_MINUTES = 10;
const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/';
const MSG91_TIMEOUT_MS = 10000;

const TEST_FIXED_CODE = '000000';

/**
 * Is this number on the test allowlist? (Stage 0, job D)
 *
 * Membership in test_phone_numbers is the ONLY route to a fixed code. There is
 * deliberately no environment flag: OTP_MOCK was exactly that, and it was left on
 * in production from 19 Aug until 20 Aug, during which every account on the
 * platform could be signed into with 000000.
 *
 * A lookup failure returns false — the safe direction. If the table is missing or
 * the database is unreachable, the caller sends a real SMS rather than silently
 * falling back to a code anyone can guess.
 */
async function _isAllowlistedTestNumber(phone) {
  try {
    const { rows } = await db.query(
      `SELECT 1 FROM test_phone_numbers WHERE phone = $1`, [phone]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[OTP] test-number lookup failed, treating as REAL:', err.message);
    return false;
  }
}

/**
 * Generate and store an OTP for the given phone number.
 *
 * Real numbers ALWAYS get a real random code and a real SMS. Numbers on the test
 * allowlist get the fixed code and no SMS, so the founder can hold dozens of
 * practice accounts without spending credits or waiting for texts.
 *
 * Under the test runner the SMS is never dispatched (see _sendViaMSG91); the suite
 * reads whatever code was stored straight out of otp_codes.
 */
async function sendOtp(phone) {
  const isTestNumber = await _isAllowlistedTestNumber(phone);
  const code = isTestNumber ? TEST_FIXED_CODE : _generateCode();

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

  // An allow-listed number has a code the founder already knows; sending it by SMS
  // spends a credit to tell him nothing.
  if (isTestNumber) {
    console.log(`[OTP] ${_maskPhone(phone)} is an allow-listed test number — no SMS sent`);
    return;
  }

  await _sendViaMSG91(phone, code);
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
  // Under the test runner we never touch the network: a live send would spend
  // SMS credits and text a real handset on every factory login. Tests assert
  // against the stored code instead. This is gated on NODE_ENV, deliberately
  // NOT on a config flag — a flag is what let mock codes reach production.
  if (process.env.NODE_ENV === 'test') return;

  if (!env.MSG91_AUTH_KEY || !env.OTP_TEMPLATE_ID) {
    console.error('[MSG91] MSG91_AUTH_KEY / OTP_TEMPLATE_ID are not set');
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

/**
 * Item 20 — a code for something OTHER than signing in (linking a brand to its owner's creator
 * account). It is sent the same way and follows the same test-number rule, but it is NOT written to
 * otp_codes: the caller keeps it in its own table. So it can never be used at /auth/verify-otp, and
 * sending it never cancels a sign-in code the number's owner is waiting for.
 * @returns {Promise<string>} the six-digit code that was sent
 */
async function sendCodeFor(phone) {
  const isTestNumber = await _isAllowlistedTestNumber(phone);
  const code = isTestNumber ? TEST_FIXED_CODE : _generateCode();
  if (isTestNumber) {
    console.log(`[OTP] ${_maskPhone(phone)} is an allow-listed test number — no SMS sent`);
    return code;
  }
  await _sendViaMSG91(phone, code);
  return code;
}

module.exports = { sendOtp, verifyOtp, sendCodeFor };
