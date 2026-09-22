'use strict';

/**
 * Item 11, J1 — hourly at :15, India time: a Remote return the brand has not confirmed by the
 * stamped due date confirms itself (rules v1.27 §11.2, §25).
 * Contract: features/item11-remote · checks 27, 50
 *
 * `:15` is the free minute — :05 Delayed, :20 handshake + settlement-retry, :25 social,
 * :35 pitch, :40 set-expiry, :45 store-visit auto-confirm, :50 negotiation, :55 reminders.
 *
 * Reads ONLY `shipments.autoconfirm_due_at`, stamped when the return was DELIVERED to the
 * branch (or when she marked a no-courier return sent) from the admin number as it stood then.
 * Never the live setting — changing the number moves no date already promised.
 *
 * IT SKIPS A RETURN THE BRAND HAS REPORTED. §11.2: the return confirms itself "unless the
 * Brand has reported an item missing or damaged".
 *
 * Idempotent three ways, all copied from item 10's shoot-auto-confirm:
 *   1. the selection needs confirmed_at IS NULL and autoconfirmed_at IS NULL;
 *   2. the row is re-read FOR UPDATE SKIP LOCKED inside the transaction;
 *   3. the write is a compare-and-swap, and rowCount === 0 means another worker had it.
 *
 * NO MONEY MOVES HERE. The return was settled when the courier collected it.
 */

const remoteJobs = require('../services/remoteJobs.service');

async function run({ now = new Date() } = {}) {
  console.log('[CRON remote-return-autoconfirm] Running...');
  try {
    const out = await remoteJobs.autoConfirmReturns({ now });
    console.log(`[CRON remote-return-autoconfirm] Checked ${out.checked}, confirmed ${out.confirmed}, skipped (reported) ${out.skippedReported}, skipped (gate closed) ${out.skippedGate}, failed ${out.failed}.`);
    return out;
  } catch (e) {
    console.error('[CRON remote-return-autoconfirm] Failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { run };
