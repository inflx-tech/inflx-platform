'use strict';

/**
 * checkout-expiry (shopper-ordering, rules 6.8) — every 5 minutes. An online payment has 15
 * minutes; when it hasn't finished, the hold ends: nothing is ordered and the stock and gifts go
 * back. One transaction per checkout, row-locked; status 'pending' is the guard that makes a
 * second run a no-op. A payment that still arrives later is handled by shopperCheckout.paymentArrived.
 */

const checkout = require('../services/shopperCheckout.service');

async function run() {
  const out = await checkout.expireHolds();
  if (out.expired) console.log(`[CRON checkout-expiry] ${out.expired} hold(s) ended, stock returned`);
  return out;
}

module.exports = { run };
