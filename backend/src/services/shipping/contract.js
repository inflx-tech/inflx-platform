'use strict';

/**
 * shipping/contract.js — the interface every provider implements, and the event vocabulary
 * every provider is translated into.
 * Contract: features/item11-remote §6 · approval §3.5
 *
 * THE ONE RULE THIS FOLDER EXISTS TO KEEP
 * **The shipping layer knows nothing about collaborations.** Not a contract, not a campaign,
 * not a creator. Its inputs are addresses, boxes, weights and a `shipments` row; its outputs
 * are prices, tracking numbers, labels and events. That is the whole reason item 16 can book a
 * customer's order through it without item 11 being anywhere near the code.
 *
 * It is enforced, not hoped for: `shipping-isolation.test.js` walks every file in this folder
 * and fails on any require of production*, contracts or campaign_*.
 *
 * WHY AN INTERFACE AND NOT A SHIPROCKET CLIENT
 * There is no Shiprocket account yet. Everything in item 11 is tested against a simulator that
 * implements this same interface and feeds the SAME webhook handler, so when the account
 * arrives nothing above this folder changes — notifications, Needs You, the wallet and Delayed
 * already ran against real events.
 */

/**
 * ── The interface ──────────────────────────────────────────────────────────
 * A provider is a plain object with these seven functions. None of them touches the database;
 * the caller persists what comes back.
 *
 *   name: 'simulator' | 'shiprocket' | 'none'
 *
 *   checkCoverage({ pickupPincode, deliveryPincode })
 *     → { delivers: boolean, returnPickup: boolean, checkedAt: ISO }
 *
 *   quote({ pickupPincode, deliveryPincode, pickupCity, deliveryCity, weightKg, box, direction })
 *     → { amount, gstAmount, gstIncluded: true, currency: 'INR' }
 *     → or null for a return the provider will not price (approval §2.3 — the caller then
 *       falls back to the outbound price for the same box and weight)
 *
 *   registerPickup({ name, phone, street, pincode, cityName, stateName })
 *     → { providerPickupId }
 *
 *   book(shipment)   → { courierName, trackingNumber, providerRef }
 *   cancel(shipment) → { cancelled: true }
 *   bookReturn(shipment, { pickupDay }) → { courierName, trackingNumber, providerRef }
 *   label(shipment)  → { buffer: Buffer, contentType: 'application/pdf' }
 */

/**
 * ── The event vocabulary ───────────────────────────────────────────────────
 * Seven INFLX events, whatever a provider calls them. A provider adapter's only job on the
 * inbound side is to map its own words onto these and supply a stable `occurredAt`.
 */
const EVENTS = Object.freeze({
  COLLECTED:        'collected',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  ATTEMPT_FAILED:   'attempt_failed',
  DELIVERED:        'delivered',
  RETURNED_TO_STORE:'returned_to_store',
  WEIGHT_CHARGE:    'weight_charge',
  CANCELLED:        'cancelled',
});
const EVENT_LIST = Object.freeze(Object.values(EVENTS));

/**
 * The forward order of the states a parcel passes through. Used to decide whether an event
 * that arrives late should move anything.
 *
 * ORDER-TOLERANCE, stated once: an event is ALWAYS recorded. It only MOVES state when the
 * column it writes is still NULL. So "out for delivery" arriving after "delivered" writes its
 * row, finds out_for_delivery_at already set (or the parcel already delivered) and changes
 * nothing. There is no clever reordering and no rejection — both would lose information.
 */
const TERMINAL = Object.freeze([EVENTS.DELIVERED, EVENTS.RETURNED_TO_STORE, EVENTS.CANCELLED]);

/**
 * The idempotency key. The same update twice is one event — enforced by a UNIQUE INDEX on this
 * column, so the DATABASE refuses the duplicate rather than the application remembering to.
 *
 * `occurredAt` is part of the key on purpose: two genuinely different failed attempts are two
 * events, and they differ only by when they happened.
 *
 * ⚠️ `shipmentId` IS REQUIRED, and it is what makes the key unique rather than merely
 * plausible. An earlier version keyed on the tracking number, which is absent when the caller
 * already knows the shipment (Admin's Test parcels does) — so two different parcels collecting
 * at the same instant produced the SAME key, and the second event was silently swallowed as a
 * duplicate. The layer's own test caught it. The shipment id is always known by the time the
 * key is built, because the key is built INSIDE the transaction that found the row.
 */
function dedupeKey({ provider, shipmentId, event, occurredAt, providerEventId }) {
  if (providerEventId) return `${provider}|${providerEventId}`;
  const at = occurredAt instanceof Date ? occurredAt.toISOString() : String(occurredAt);
  return `${provider}|${shipmentId}|${event}|${at}`;
}

/** The three box presets of the mockups (R6), in centimetres. */
const BOX_PRESETS = Object.freeze({
  small:  { l: 25, w: 20, h: 5 },
  medium: { l: 35, w: 25, h: 10 },
  large:  { l: 45, w: 35, h: 15 },
});

/** Volumetric weight, the divisor every Indian aggregator uses. */
const volumetricKg = ({ l, w, h }) => (Number(l) * Number(w) * Number(h)) / 5000;

/** Dimensions from a preset name, or the typed ones. */
function boxOf(box) {
  if (!box) return null;
  if (box.preset && BOX_PRESETS[box.preset]) return { ...BOX_PRESETS[box.preset], preset: box.preset };
  const l = Number(box.l), w = Number(box.w), h = Number(box.h);
  if (!(l > 0 && w > 0 && h > 0)) return null;
  return { l, w, h, preset: 'other' };
}

/** A provider refusing to act because it is switched off, or because it is not its shipment. */
class ShippingError extends Error {
  constructor(code, message) { super(message); this.name = 'ShippingError'; this.code = code; }
}

module.exports = { EVENTS, EVENT_LIST, TERMINAL, dedupeKey, BOX_PRESETS, boxOf, volumetricKg, ShippingError };
