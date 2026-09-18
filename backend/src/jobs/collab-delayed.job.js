'use strict';

/**
 * Item 10 — hourly at :05, India time: the day after a set's posting date, every signed
 * collaboration in it whose shoot is not complete is flagged Delayed, with the stage it stopped
 * at, and both sides are told once (rules v1.24 §11.1, §25).
 *
 * NOTHING ELSE MOVES. The flag is two columns on campaign_influencers; status, set, agreement,
 * escrow and wallets are untouched, and item 4's set-expiry (which keeps any set with a signed
 * member) never sees it. Item 12 will set the same flag for content not live.
 * Idempotent: delayed_at IS NULL selects, FOR UPDATE SKIP LOCKED locks, the update sets it.
 * Contract: features/item10-store-visit
 */
const shootPlan = require('../services/shootPlan.service');

async function run({ today = null } = {}) {
  console.log('[CRON collab-delayed] Running...');
  try {
    const out = await shootPlan.flagDelayed({ today });
    console.log(`[CRON collab-delayed] Checked ${out.checked}, flagged ${out.flagged}, skipped (gate closed) ${out.skippedGate}, failed ${out.failed}.`);
    return out;
  } catch (e) {
    console.error('[CRON collab-delayed] Failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { run };
