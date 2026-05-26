'use strict';

/**
 * razorpay.service.js — Phase A6.5 + A13
 *
 * Thin wrapper over the official `razorpay` npm SDK (v2.9.6, already in
 * backend/package.json). Three responsibilities:
 *
 *   1. createSubscription({ plan_id, total_count, notes }) — creates a
 *      recurring subscription on Razorpay for the given plan. Returns
 *      { id, plan_id, status, short_url }.
 *   2. fetchSubscription(subscription_id) — for status reconciliation
 *      from webhooks or manual sync.
 *   3. cancelSubscription(subscription_id, { cancel_at_cycle_end })
 *      — for future downgrade / cancellation flows (not exposed in
 *      A6.5 UX yet, but cheap to ship).
 *
 * Lazy-initializes the SDK client on first use so the module can be
 * required during boot smoke without Razorpay keys present (existing
 * env.js defaults: RAZORPAY_KEY_ID='rzp_test_mock', SECRET=''). The
 * client throws on actual API calls when keys are unset, which is the
 * correct behaviour — let upgrade() surface the failure.
 *
 * All amounts go through utils/money.js toPaise at the API boundary
 * per the rupees-everywhere convention (migration 021).
 */

const env = require('../config/env');

let _client = null;

/**
 * Lazy SDK init — required so backend can boot in environments without
 * Razorpay keys (tests, mock-mode dev). Calls fail loudly only when
 * the live path is actually invoked.
 */
function _getClient() {
  if (_client) return _client;
  const Razorpay = require('razorpay');
  _client = new Razorpay({
    key_id:     env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  return _client;
}

/**
 * Create a recurring subscription on Razorpay.
 *
 * @param {object}   opts
 * @param {string}   opts.plan_id        — plan_NXyz123… from Razorpay dashboard
 * @param {number}   opts.total_count    — number of billing cycles (e.g. 12 for monthly × 1yr, 5 for yearly × 5yr)
 * @param {object}   [opts.notes]        — arbitrary key→string map; we set brand_id + tier_key + billing_period for webhook correlation
 * @param {boolean}  [opts.customer_notify=true] — Razorpay emails the customer the UPI Autopay collect link if Checkout isn't used
 * @returns {Promise<{ id: string, plan_id: string, status: string, short_url?: string }>}
 */
async function createSubscription({ plan_id, total_count, notes, customer_notify = true }) {
  if (!plan_id) throw new Error('createSubscription: plan_id required');
  if (!total_count) throw new Error('createSubscription: total_count required');

  const client = _getClient();
  const sub = await client.subscriptions.create({
    plan_id,
    total_count,
    customer_notify: customer_notify ? 1 : 0,
    notes: notes || {},
  });

  return {
    id:        sub.id,
    plan_id:   sub.plan_id,
    status:    sub.status,
    short_url: sub.short_url,
  };
}

/**
 * Fetch a subscription by id — used for state reconciliation in
 * webhook handlers (read fresh state in case the webhook payload is
 * stale) and future admin tooling.
 */
async function fetchSubscription(subscription_id) {
  if (!subscription_id) throw new Error('fetchSubscription: subscription_id required');
  const client = _getClient();
  return client.subscriptions.fetch(subscription_id);
}

/**
 * Cancel a subscription. By default cancels at cycle end so the brand
 * keeps the current period they paid for; pass `cancel_at_cycle_end:
 * false` to cancel immediately (refunds handled separately on
 * Razorpay).
 */
async function cancelSubscription(subscription_id, { cancel_at_cycle_end = true } = {}) {
  if (!subscription_id) throw new Error('cancelSubscription: subscription_id required');
  const client = _getClient();
  return client.subscriptions.cancel(subscription_id, cancel_at_cycle_end);
}

module.exports = {
  createSubscription,
  fetchSubscription,
  cancelSubscription,
};
