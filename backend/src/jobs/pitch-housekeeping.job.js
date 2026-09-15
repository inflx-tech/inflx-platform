'use strict';

/**
 * Item 8 — hourly pitch housekeeping, at :35, between item 6's set expiry (:40)
 * and its social measurement (:25) so no two lanes touch a negotiation at once.
 *
 * Three things, all idempotent:
 *   · remind the brand at 7 days and at 21, once each, while it still owes the
 *     FIRST answer — the response clock governs that answer only (approval Q2);
 *   · close a pitch the brand never answered when its response period runs out;
 *   · close a pitch early when her proposed date comes within item 4's floor,
 *     because no set can be built for it after that.
 *
 * Never a decline, and never a cooldown: only a rejection starts one.
 * Contract: features/item8-pitch · rules v1.21 §8, §25
 */
const pitch = require('../services/pitch.service');

async function run({ now = null } = {}) {
  console.log('[CRON pitch-housekeeping] Running...');
  let out;
  try {
    out = await pitch.housekeeping({ now });
  } catch (e) {
    console.error('[CRON pitch-housekeeping] failed:', e.message);
    out = { error: e.message };
  }
  console.log('[CRON pitch-housekeeping] Done:', JSON.stringify(out));
  return out;
}

module.exports = { run };
