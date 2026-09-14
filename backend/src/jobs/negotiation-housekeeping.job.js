'use strict';

/**
 * Item 6 — hourly housekeeping, replacing the retired 48-hour negotiation-expiry job:
 *   · pool entries past their stamped lifetime close, and both sides are told;
 *     a "closing soon" notice goes once when seven days remain (APPROVAL Q8);
 *   · reminders for a silent reply at 48 hours and 7 days, to the side whose move it is only,
 *     stopped when the move changes hands or the invitation closes (APPROVAL Q10).
 * Never a decline. The set's cutoff is the only deadline (set-expiry.job closes open threads).
 * Contract: features/item6-negotiation · rules v1.18 §7B, §25
 */
const pool = require('../services/pool.service');
const negotiation = require('../services/negotiation.service');

async function run({ now = new Date() } = {}) {
  console.log('[CRON negotiation-housekeeping] Running...');
  const out = { pool: null, reminders: null };
  try { out.pool = await pool.expire({ now }); } catch (e) { console.error('[CRON negotiation-housekeeping] pool failed:', e.message); out.pool = { error: e.message }; }
  try { out.reminders = await negotiation.sendReminders({ now }); } catch (e) { console.error('[CRON negotiation-housekeeping] reminders failed:', e.message); out.reminders = { error: e.message }; }
  console.log('[CRON negotiation-housekeeping] Done:', JSON.stringify(out));
  return out;
}

module.exports = { run };
