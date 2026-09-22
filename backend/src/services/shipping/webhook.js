'use strict';

/**
 * shipping/webhook.js — one handler, every provider, including the simulator.
 * Contract: features/item11-remote §6.3 · approval §3.5, §3.6 · checks 16, 17
 *
 * THE POINT OF THIS FILE
 * Admin's Test parcels page (R18) does not "pretend" a delivery happened. It posts to the same
 * endpoint Shiprocket will post to, and the update walks the same path: recorded raw, deduped,
 * applied forward-only, then handed to whatever cares. So notifications, Needs You, the wallet
 * and the Delayed flag are exercised by the simulator exactly as they will be in production,
 * and switching providers changes nothing above this file.
 *
 * THREE PROPERTIES, EACH BOUGHT WITH ONE MECHANISM
 *   idempotent      — a UNIQUE INDEX on shipment_events.dedupe_key. The DATABASE refuses the
 *                     duplicate; the handler does not have to remember to.
 *   order-tolerant  — every state write is `COALESCE(col, $ts)` under `WHERE col IS NULL`. An
 *                     event that arrives late records itself and moves nothing. `applied`
 *                     says which of the two happened, so the record is honest either way.
 *   auditable       — the raw body is stored before anything is parsed, always, even when the
 *                     event is one we do not recognise.
 *
 * WHY EFFECTS ARE REGISTERED AND NOT IMPORTED
 * This folder must not know what a collaboration is (item 16 reuses it). So item 11 REGISTERS
 * what should happen after a shipment moves; the layer calls back. The dependency points one
 * way only, and `shipping-isolation.test.js` proves it.
 */

const db = require('../../config/db');
const { EVENTS, EVENT_LIST, dedupeKey, ShippingError } = require('./contract');
const shipping = require('./index');

/* ───────────────────────────────────────────── the effect registry */

const _effects = [];

/**
 * Register something to run after an event has been recorded and the shipment moved.
 * Called with ({ event, shipment, before, applied, amount, reason, occurredAt }, conn).
 * Runs INSIDE the transaction, so an effect that throws rolls the event back with it.
 * Notifications are deliberately NOT effects — they go out after commit (see `notifyAfter`).
 */
function onApplied(fn) { _effects.push(fn); return () => { const i = _effects.indexOf(fn); if (i >= 0) _effects.splice(i, 1); }; }
/** For tests. */
function _clearEffects() { _effects.length = 0; }

/* ───────────────────────────────────────────── the state machine */

/**
 * Which column an event writes, and the guard that makes it forward-only.
 * `count` events (a failed attempt) are additive rather than a single timestamp.
 */
const APPLY = {
  [EVENTS.COLLECTED]: {
    sql: `UPDATE shipments SET collected_at = $2, updated_at = now()
           WHERE id = $1 AND collected_at IS NULL AND cancelled_at IS NULL`,
  },
  [EVENTS.OUT_FOR_DELIVERY]: {
    sql: `UPDATE shipments SET out_for_delivery_at = $2, updated_at = now()
           WHERE id = $1 AND out_for_delivery_at IS NULL AND delivered_at IS NULL
             AND returned_to_store_at IS NULL AND cancelled_at IS NULL`,
  },
  [EVENTS.DELIVERED]: {
    sql: `UPDATE shipments SET delivered_at = $2, updated_at = now()
           WHERE id = $1 AND delivered_at IS NULL AND returned_to_store_at IS NULL
             AND cancelled_at IS NULL`,
  },
  [EVENTS.RETURNED_TO_STORE]: {
    sql: `UPDATE shipments SET returned_to_store_at = $2, updated_at = now()
           WHERE id = $1 AND returned_to_store_at IS NULL AND delivered_at IS NULL
             AND cancelled_at IS NULL`,
  },
  [EVENTS.CANCELLED]: {
    sql: `UPDATE shipments SET cancelled_at = COALESCE(cancelled_at, $2), updated_at = now()
           WHERE id = $1 AND cancelled_at IS NULL AND collected_at IS NULL`,
  },
  [EVENTS.ATTEMPT_FAILED]: {
    // Not a single timestamp: three failed attempts are three facts. Still forward-only —
    // a parcel already delivered or already back at the store cannot fail an attempt.
    sql: `UPDATE shipments
             SET attempt_failed_count = attempt_failed_count + 1,
                 last_attempt_failed_at = $2, last_attempt_reason = $3, updated_at = now()
           WHERE id = $1 AND delivered_at IS NULL AND returned_to_store_at IS NULL
             AND cancelled_at IS NULL`,
    withReason: true,
  },
  // A weight charge moves no shipment column — it is entirely a money event, and the money is
  // an effect (item 11 registers it). Recording it is what this layer owes.
  [EVENTS.WEIGHT_CHARGE]: { sql: null },
};

/* ───────────────────────────────────────────── the handler */

/**
 * @param {object} u              the normalised update
 * @param {string} u.provider     'simulator' | 'shiprocket'
 * @param {string} u.event        one of EVENTS
 * @param {string} [u.trackingNumber]
 * @param {string} [u.shipmentId] when the caller already knows it (the Test parcels page does)
 * @param {string|Date} u.occurredAt
 * @param {object} u.payload      the RAW body
 * @returns {Promise<{ok, duplicate, applied, shipment, event}>}
 */
async function handle(u) {
  const provider = String(u.provider || '').toLowerCase();
  const event = String(u.event || '');
  if (!EVENT_LIST.includes(event)) {
    throw new ShippingError('UNKNOWN_EVENT', `"${event}" is not a shipment event.`);
  }

  const occurredAt = u.occurredAt ? new Date(u.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    throw new ShippingError('BAD_TIMESTAMP', 'The update carries no usable timestamp.');
  }

  const out = await db.withTransaction(async (tx) => {
    // Find the shipment. Locked, so two deliveries of the same webhook cannot interleave.
    const found = u.shipmentId
      ? (await tx.query(`SELECT * FROM shipments WHERE id = $1 FOR UPDATE`, [u.shipmentId])).rows[0]
      : (await tx.query(
          `SELECT * FROM shipments WHERE provider = $1 AND tracking_number = $2 FOR UPDATE`,
          [provider, u.trackingNumber])).rows[0];

    if (!found) {
      // Not ours, or not ours yet. A provider must still get a 200 — retrying for ever helps
      // nobody — but the body is kept so it can be looked at.
      return { ok: false, unknownShipment: true, duplicate: false, applied: false, event };
    }
    if (found.provider !== provider) {
      // Check 33, at the one place it could actually happen.
      throw new ShippingError('PROVIDER_MISMATCH',
        `This shipment belongs to ${found.provider}; the update came from ${provider}.`);
    }

    // The key is built HERE, not before the transaction, because it needs the shipment's id —
    // the tracking number is absent whenever the caller already knows which parcel it means.
    const key = dedupeKey({
      provider, shipmentId: found.id, event, occurredAt, providerEventId: u.providerEventId,
    });

    // Record FIRST, raw, always. If the insert conflicts, this exact update has been seen.
    const ins = await tx.query(
      `INSERT INTO shipment_events
         (shipment_id, provider, event, provider_event_id, dedupe_key, occurred_at, amount, reason, payload, applied)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [found.id, provider, event, u.providerEventId || null, key, occurredAt,
       u.amount == null ? null : Number(u.amount), u.reason || null,
       JSON.stringify(u.payload == null ? {} : u.payload)]
    );
    if (!ins.rows[0]) {
      return { ok: true, duplicate: true, applied: false, shipment: found, event };
    }

    // Then move the shipment forward — and only forward.
    const rule = APPLY[event];
    let applied = false;
    if (rule && rule.sql) {
      const params = rule.withReason ? [found.id, occurredAt, u.reason || null] : [found.id, occurredAt];
      const { rowCount } = await tx.query(rule.sql, params);
      applied = rowCount > 0;
    } else if (event === EVENTS.WEIGHT_CHARGE) {
      applied = true;                 // nothing on the shipment moves; the money is an effect
    }

    if (applied) {
      await tx.query(`UPDATE shipment_events SET applied = true WHERE id = $1`, [ins.rows[0].id]);
    }

    const after = (await tx.query(`SELECT * FROM shipments WHERE id = $1`, [found.id])).rows[0];

    for (const fn of _effects) {
      // eslint-disable-next-line no-await-in-loop
      await fn({ event, shipment: after, before: found, applied, amount: u.amount == null ? null : Number(u.amount), reason: u.reason || null, occurredAt }, tx);
    }

    return { ok: true, duplicate: false, applied, shipment: after, before: found, event };
  });

  return out;
}

module.exports = { handle, onApplied, _clearEffects, EVENTS };
