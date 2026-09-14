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

/**
 * Split a total into parts by percentage so that the parts sum EXACTLY to the
 * total, with no paise lost or invented. Item 7, decision 4.4.
 *
 * Every part but the last is rounded; the last takes the remainder. A whole-
 * rupee total splits into whole rupees (₹9,999 → 2500 / 2500 / 4999), because
 * that is what the agreement prints and what the screens show; a total that
 * carries paise splits at the paise.
 *
 * This is the ONE splitter. The escrow writer and every screen must call it,
 * or the document says one thing and the money does another.
 *
 * @param   {number|string} total  the amount to split, in rupees
 * @param   {Array<number|string>} pcts  percentages, summing to 100
 * @returns {number[]} parts in rupees, summing exactly to `total`
 */
function splitAmount(total, pcts) {
  const totalPaise = Math.round((parseFloat(total) || 0) * 100);
  if (!Array.isArray(pcts) || pcts.length === 0) return [];
  // A whole-rupee total keeps whole-rupee parts; anything else splits at the paise.
  const unit = totalPaise % 100 === 0 ? 100 : 1;
  const out = [];
  let used = 0;
  for (let i = 0; i < pcts.length - 1; i++) {
    const part = Math.round((totalPaise * (parseFloat(pcts[i]) || 0)) / 100 / unit) * unit;
    out.push(part);
    used += part;
  }
  out.push(totalPaise - used);
  return out.map((p) => p / 100);
}

module.exports = { toPaise, fromPaise, splitAmount };
