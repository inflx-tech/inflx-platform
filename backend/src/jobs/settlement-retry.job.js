'use strict';

/**
 * settlement-retry.job — Wave 3 commit 3.
 *
 * Retries commerce settlement transfers that were recorded but never completed:
 *   - the brand onboarded a Route payout account AFTER the sale, or
 *   - a transient Razorpay Route failure left razorpay_transfer_id null.
 *
 * Eligible: completed commerce transactions that were already settled
 * (tcs_amount recorded) but have no transfer id yet, whose brand now HAS a
 * linked account and a positive brand_net. Per-transaction failures are logged
 * and counted; they don't stop the batch.
 */

const db = require('../config/db');
const settlementService = require('../services/settlement.service');

// Item 17 (rules v1.31 §17A, W3): RETIRED. A sale's share is added to the brand's wallet when its
// return window closes; nothing is transferred to a bank account, so there is nothing to retry.
// The job stays registered and does nothing, so the schedule and its callers need no change.
async function run() {
  return { retried: 0, succeeded: 0, failed: 0, retired: true };
}

module.exports = { run };
