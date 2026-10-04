'use strict';

/**
 * returnWindow.service.js — the return window: ONE platform number, in hours.
 * Contract: features/shopper-walk-fixes · 01-spec.md W11, W13 (founder, 4 Oct 2026)
 *
 *   "this return window is fixed by our platform INFLX… same for all… not decided by individual
 *    business or brand… as an admin we can set any number of days even 24hrs or any hours to days…
 *    after delivery sale commission to creator, platform sale percentage, and money return to brand
 *    all should follow the time set in admin for return window."
 *
 * So:
 *   · The number lives in payment_config.return_window_hours (Admin › Money › Settings). No category,
 *     brand or product has one of its own any more.
 *   · A sale is STAMPED with the window in force when it is made (return_window_ends_at =
 *     created_at + the window). Changing the admin number never moves a sale already made.
 *   · For an order that is delivered to a shopper, the window RUNS FROM DELIVERY: it closes at
 *     delivered_at + the stamped length. Until it is delivered nothing is released.
 *   · When it closes, the creator's commission and the brand's share are added to their wallets, and
 *     INFLX's share counts as earned (it is recognised with the brand's settlement). A return asked
 *     for inside the window holds all three until it is settled.
 */

const paymentConfig = require('./paymentConfig.service');

const HOUR_MS = 60 * 60 * 1000;
const MIN_HOURS = 1;
const MAX_HOURS = 8760;            // 365 days
const DEFAULT_HOURS = 168;         // 7 days

/** The window in force now, in whole hours. */
async function hours() {
  const cfg = await paymentConfig.getConfig();
  const h = Math.round(Number(cfg.returnWindowHours));
  return Number.isFinite(h) && h >= MIN_HOURS ? Math.min(MAX_HOURS, h) : DEFAULT_HOURS;
}

/** "7 days" · "24 hours" · "36 hours" · "1 day". Whole days read as days; anything else as hours. */
function words(h) {
  const n = Math.max(1, Math.round(Number(h) || 0));
  if (n % 24 === 0 && n !== 24) { const d = n / 24; return `${d} day${d === 1 ? '' : 's'}`; }
  return `${n} hour${n === 1 ? '' : 's'}`;
}

/** "7-day" · "24-hour" · "36-hour": the window as it reads before a noun ("the 7-day return window"). */
function adjective(h) {
  const n = Math.max(1, Math.round(Number(h) || 0));
  return n % 24 === 0 && n !== 24 ? `${n / 24}-day` : `${n}-hour`;
}

const lengthMs = (h) => Math.round(Number(h)) * HOUR_MS;

/** The stamp for a sale made now: created + the window in force. */
async function stampFor(from = new Date()) {
  return new Date(new Date(from).getTime() + lengthMs(await hours()));
}

/** The length stamped on a sale, in ms (its stamp minus when it was made). 0 when it has no stamp. */
function stampedMs(sale) {
  if (!sale || !sale.return_window_ends_at || !sale.created_at) return 0;
  return Math.max(0, new Date(sale.return_window_ends_at).getTime() - new Date(sale.created_at).getTime());
}

/** When a DELIVERED sale's window closes; null while it is not delivered. */
function closesAt(sale, deliveredAt) {
  if (!deliveredAt) return null;
  return new Date(new Date(deliveredAt).getTime() + stampedMs(sale));
}

/** What a shopper is told on a product: { hours, words, line }. */
async function forShopper() {
  const h = await hours();
  return { hours: h, words: words(h), line: `Within ${words(h)} of delivery` };
}

module.exports = { MIN_HOURS, MAX_HOURS, DEFAULT_HOURS, HOUR_MS, hours, words, adjective, lengthMs, stampFor, stampedMs, closesAt, forShopper };
