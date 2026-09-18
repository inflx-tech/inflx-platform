'use strict';

/**
 * Item 10 — hourly at :45, India time: a store visit she marked attended that the brand has not
 * confirmed by the stamped due date confirms itself (rules v1.24 §11.1). Safe because completing
 * a shoot moves no money — it only opens the content step.
 *
 * Reads ONLY production_events.auto_confirm_due_at, stamped when she marked attended from the
 * admin number as it stood then; never the live setting, so changing the number afterwards moves
 * no due date already promised (check 19). Idempotent: the selection needs auto_confirmed_at IS
 * NULL and brand_completed_at IS NULL, the row is locked FOR UPDATE SKIP LOCKED, and the update
 * is a compare-and-swap (check 18, 20).
 * Contract: features/item10-store-visit
 */
const shootPlan = require('../services/shootPlan.service');

async function run({ now = new Date() } = {}) {
  console.log('[CRON shoot-auto-confirm] Running...');
  try {
    const out = await shootPlan.autoConfirmDue({ now });
    console.log(`[CRON shoot-auto-confirm] Checked ${out.checked}, confirmed ${out.confirmed}, skipped (gate closed) ${out.skippedGate}, failed ${out.failed}.`);
    return out;
  } catch (e) {
    console.error('[CRON shoot-auto-confirm] Failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { run };
