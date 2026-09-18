'use strict';

/**
 * Item 10 (approval §2.5, rules §25 "stays in Needs You with reminders") — hourly at :55, India
 * time: one nudge to whoever's turn it is when a sent plan, or a turn on the time thread, has sat
 * 48 hours; never more than once per 48 hours; nothing after the posting date (the Delayed flag
 * takes over); nothing whose gate is closed.
 *
 * Deliberately NOT extended to pitch threads in this item — recorded as its own piece of work.
 * Contract: features/item10-store-visit
 */
const shootPlan = require('../services/shootPlan.service');

async function run({ now = new Date() } = {}) {
  console.log('[CRON shoot-reminders] Running...');
  try {
    const out = await shootPlan.remind({ now });
    console.log(`[CRON shoot-reminders] Checked ${out.checked}, sent ${out.sent}.`);
    return out;
  } catch (e) {
    console.error('[CRON shoot-reminders] Failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { run };
