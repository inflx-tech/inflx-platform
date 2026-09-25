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
// Item 11 — the Remote half. Six moves, one rule, and the one exemption from the
// posting-date stop: an OVERDUE RETURN keeps reminding her past it (rules v1.27 §11.2).
const remoteJobs = require('../services/remoteJobs.service');
// Item 12 — the five content moves (continuing past the posting date, approval Q6), and the
// 24-hour sweep of uploads never confirmed (approval §2.1).
const contentJobs = require('../services/contentJobs.service');
const content = require('../services/content.service');

async function run({ now = new Date() } = {}) {
  console.log('[CRON shoot-reminders] Running...');
  try {
    const visit = await shootPlan.remind({ now });
    const remote = await remoteJobs.remindRemote({ now });
    const contentArm = await contentJobs.remindContent({ now });
    const swept = await content.sweep();
    const out = { checked: visit.checked + remote.checked + contentArm.checked, sent: visit.sent + remote.sent + contentArm.sent, visit, remote, content: contentArm, swept };
    console.log(`[CRON shoot-reminders] Checked ${out.checked}, sent ${out.sent} (visit ${visit.sent}, remote ${remote.sent}, content ${contentArm.sent}); uploads swept ${swept.deleted}.`);
    return out;
  } catch (e) {
    console.error('[CRON shoot-reminders] Failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { run };
