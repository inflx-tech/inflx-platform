'use strict';

/**
 * Item 3b — hourly: measure the social accounts that are due (profile every 7 days, posts
 * every 15 days, retries the next day), a batch at a time, under the monthly budget.
 * Contract: features/item3b-social-numbers · prompt §3.2
 */
const measure = require('../services/socialMeasure.service');

async function run() {
  console.log('[CRON social-measure] Running...');
  try {
    const out = await measure.tick({ trigger: 'schedule' });
    if (out.skipped) console.log(`[CRON social-measure] Skipped: ${out.skipped} (month spend ${out.spend && out.spend.usd})`);
    else console.log(`[CRON social-measure] Ran ${out.ran} account(s)`);
    return out;
  } catch (e) {
    console.error('[CRON social-measure] Failed:', e.message);
    return { ran: 0, error: e.message };
  }
}

module.exports = { run };
