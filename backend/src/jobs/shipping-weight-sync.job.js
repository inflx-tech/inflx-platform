'use strict';

/**
 * Once a day at 03:30, India time: read the courier's weight differences and charge each one.
 * Contract: features/shiprocket-connector-repair · checks 22, 23 · rules v1.27 §11.2
 *
 * WHY A JOB. Item 11 was built expecting a weight difference to ARRIVE, as a courier update.
 * Shiprocket does not push one — it keeps a list. So the list is read, and each row is handed
 * to the SAME webhook handler every other courier update goes through: recorded raw, deduped,
 * and passed to whatever registered an interest (item 11 charges the brand's wallet, or records
 * a due; it never blocks the creator).
 *
 * IDEMPOTENT by Shiprocket's own row id — the list covers seven days and is read daily, so every
 * difference is seen about seven times and charged once (the unique index on
 * shipment_events.dedupe_key refuses the rest).
 *
 * DOES NOTHING unless the platform is on the real courier: both switches must be on.
 */

const env = require('../config/env');
const shipping = require('../services/shipping');
const webhook = require('../services/shipping/webhook');
const remoteEffects = require('../services/remoteEffects');
const { EVENTS } = require('../services/shipping/contract');

async function run() {
  if (env.SHIPPING_PROVIDER !== 'shiprocket' || !env.SHIPROCKET_ENABLED) {
    return { skipped: true };
  }
  console.log('[CRON shipping-weight-sync] Running...');

  let rows;
  try {
    rows = await shipping.PROVIDERS.shiprocket.weightCharges();
  } catch (e) {
    console.error('[CRON shipping-weight-sync] Could not read the list:', e.message);
    return { error: e.message };
  }

  const out = { read: rows.length, charged: 0, alreadyCharged: 0, notOurs: 0, failed: 0 };
  for (const r of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const done = await webhook.handle({
        provider: 'shiprocket',
        event: EVENTS.WEIGHT_CHARGE,
        trackingNumber: r.trackingNumber,
        occurredAt: r.occurredAt,
        providerEventId: r.providerEventId,
        amount: r.amount,
        reason: r.reason,
        payload: r.payload,
      });
      if (done.unknownShipment) out.notOurs += 1;
      else if (done.duplicate) out.alreadyCharged += 1;
      else out.charged += 1;
    } catch (e) {
      out.failed += 1;
      console.error('[CRON shipping-weight-sync] failed for', r.trackingNumber, e.message);
    }
  }
  // The same flush a pushed update gets — nobody is told about a charge that rolled back.
  await remoteEffects.flush();

  console.log(`[CRON shipping-weight-sync] Read ${out.read}, charged ${out.charged}, already charged ${out.alreadyCharged}, not ours ${out.notOurs}, failed ${out.failed}.`);
  return out;
}

module.exports = { run };
