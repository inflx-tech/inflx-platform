'use strict';

/**
 * money.js — Razorpay boundary helpers.
 *
 * After migration 021, every monetary value in the INFLX DB and every
 * API response is in RUPEES. The only place paise still lives is the
 * Razorpay API itself, which requires paise for order/payout creation
 * and returns paise in webhook payloads.
 *
 * These helpers are the ONLY places in the backend that convert between
 * the two units. Never scatter `* 100` / `/ 100` throughout business
 * logic — route them through here so the boundary is obvious.
 */

/**
 * Convert rupees → paise for sending to Razorpay.
 * Accepts rupees as a number or numeric string.
 */
function toPaise(rupees) {
  const r = parseFloat(rupees);
  if (!isFinite(r)) return 0;
  return Math.round(r * 100);
}

/**
 * Convert paise → rupees when receiving from Razorpay (webhook payloads,
 * order responses). Returns a number with 2-decimal precision.
 */
function fromPaise(paise) {
  const p = parseFloat(paise);
  if (!isFinite(p)) return 0;
  return Math.round(p) / 100;
}

module.exports = { toPaise, fromPaise };
