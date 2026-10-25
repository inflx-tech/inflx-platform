'use strict';

/**
 * post-performance-v2 — daily at 06:10 India time, after the hour's Level 1 tick (:25 of the hour
 * before): read the campaign post links that are due on the day curve (day 1, 2, 3, 5, 7, 10, 14,
 * 21, 30 after tracking starts, then every 14 days to day 90), one Apify run per platform, up to
 * 50 links a run, behind the item 3b budget guard. A skipped day leaves the due dates due, so the
 * next run catches up. Contract: features/post-performance-v2 · spec P5, P6
 */
const postStats = require('../services/postStats.service');

async function run({ trigger = 'schedule' } = {}) {
  console.log('[CRON post-stats] Running...');
  try {
    const out = await postStats.runDue({ trigger });
    if (out.skipped) console.log(`[CRON post-stats] Skipped: ${out.skipped} (month spend ${out.spend && out.spend.usd})`);
    else console.log(`[CRON post-stats] ${out.due} link(s) due, ${out.ran} run(s), ${out.read} read; stopped ${JSON.stringify(out.stopped)}`);
    return out;
  } catch (e) {
    console.error('[CRON post-stats] Failed:', e.message);
    return { ran: 0, read: 0, error: e.message };
  }
}

module.exports = { run };
