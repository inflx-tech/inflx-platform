'use strict';

/**
 * shipping/index.js — which provider, and the small amount of persistence the layer owns.
 * Contract: features/item11-remote §6 · approval §3.5
 *
 * THE PROVIDER RULE, in one sentence:
 *   **an existing shipment always uses the provider written on its own row; a new one uses
 *   env.SHIPPING_PROVIDER.**
 *
 * That is what makes check 33 true — a simulated shipment can never reach the Shiprocket
 * adapter and a real one never the simulator — and it is why `provider` is written once at
 * creation and appears in no UPDATE anywhere in the codebase.
 *
 * This file may touch the database (shipments, shipment_events, brand_branch_pickups) and
 * nothing else. It does not know what a collaboration is.
 */

const crypto = require('crypto');
const db = require('../../config/db');
const env = require('../../config/env');
const { ShippingError } = require('./contract');

const simulator = require('./simulator');
const shiprocket = require('./shiprocket');

const PROVIDERS = { simulator, shiprocket };

/** The provider a NEW shipment will use. */
function newProviderName() {
  const n = String(env.SHIPPING_PROVIDER || 'simulator').toLowerCase();
  if (!PROVIDERS[n]) {
    throw new ShippingError('UNKNOWN_PROVIDER', `SHIPPING_PROVIDER is "${n}", which is not a provider.`);
  }
  // The second switch. Even if SHIPPING_PROVIDER says shiprocket, the adapter's own transport
  // refuses until SHIPROCKET_ENABLED is true — so a half-configured server books nothing
  // rather than booking something nobody meant.
  return n;
}

/**
 * The provider for a shipment that already exists.
 * @param {{provider:string}|string} shipmentOrName
 */
function provider(shipmentOrName) {
  const n = typeof shipmentOrName === 'string'
    ? shipmentOrName
    : (shipmentOrName && shipmentOrName.provider);

  if (n === 'none') {
    // Approval Q1 — the no-courier return. There is nothing to call. Anyone reaching for a
    // provider on one of these has made a mistake worth hearing about.
    throw new ShippingError('NO_PROVIDER',
      'This return is not being carried by a courier — she is sending it back herself.');
  }
  const p = PROVIDERS[String(n || '').toLowerCase()];
  if (!p) throw new ShippingError('UNKNOWN_PROVIDER', `No shipping provider named "${n}".`);
  return p;
}

/** The provider object for a new shipment, plus its name to write on the row. */
function newProvider() {
  const n = newProviderName();
  return { name: n, api: PROVIDERS[n] };
}

/* ───────────────────────────────────────────── pickup registration (§2.5) */

const addressHash = (a) => crypto.createHash('sha256')
  // The landmark is part of the address a courier is given, so adding or changing one is an
  // address change like any other (features/courier-ready-addresses).
  .update([a.name, a.phone, a.street, a.pincode, a.cityName, a.stateName, a.landmark].map((x) => String(x || '')).join('|'))
  .digest('hex');

/**
 * Make sure this branch is a pickup location with this provider, and that the provider knows
 * its CURRENT address. Called at the first booking from a branch, and again whenever the
 * branch's address changes (the hash differs).
 *
 * Shaped this way because Shiprocket unknown 1 — whether one INFLX account may hold a pickup
 * location per brand branch — cannot be answered until the account exists. Keyed on
 * (branch_id, provider), it is correct whichever way that answer goes.
 */
async function ensurePickup(branchId, address, conn = db) {
  const p = newProvider();
  const hash = addressHash(address);

  const { rows } = await conn.query(
    `SELECT * FROM brand_branch_pickups WHERE branch_id = $1 AND provider = $2`,
    [branchId, p.name]
  );
  if (rows[0] && rows[0].address_hash === hash) return rows[0].provider_pickup_id;

  const { providerPickupId } = await p.api.registerPickup(address);
  const { rows: saved } = await conn.query(
    `INSERT INTO brand_branch_pickups (branch_id, provider, provider_pickup_id, address_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (branch_id, provider)
       DO UPDATE SET provider_pickup_id = EXCLUDED.provider_pickup_id,
                     address_hash = EXCLUDED.address_hash,
                     updated_at = now()
     RETURNING provider_pickup_id`,
    [branchId, p.name, providerPickupId, hash]
  );
  return saved[0].provider_pickup_id;
}

/* ───────────────────────────────────────────── reads the callers need */

const byId = async (id, conn = db) =>
  (await conn.query(`SELECT * FROM shipments WHERE id = $1`, [id])).rows[0] || null;

const byTracking = async (providerName, trackingNumber, conn = db) =>
  (await conn.query(
    `SELECT * FROM shipments WHERE provider = $1 AND tracking_number = $2`,
    [providerName, trackingNumber]
  )).rows[0] || null;

/** Every shipment on one shoot, outbound first, newest last. */
const forEvent = async (productionEventId, conn = db) =>
  (await conn.query(
    `SELECT * FROM shipments WHERE production_event_id = $1
      ORDER BY (direction = 'return'), created_at`,
    [productionEventId]
  )).rows;

/**
 * The live outbound parcel — the one the unique index allows: not cancelled, not brought back.
 * A rebook makes a new one and this returns that.
 */
const liveOutbound = async (productionEventId, conn = db) =>
  (await conn.query(
    `SELECT * FROM shipments
      WHERE production_event_id = $1 AND direction = 'outbound'
        AND cancelled_at IS NULL AND returned_to_store_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [productionEventId]
  )).rows[0] || null;

/** The most recent outbound parcel whatever became of it — what the screens show. */
const lastOutbound = async (productionEventId, conn = db) =>
  (await conn.query(
    `SELECT * FROM shipments WHERE production_event_id = $1 AND direction = 'outbound'
      ORDER BY created_at DESC LIMIT 1`,
    [productionEventId]
  )).rows[0] || null;

const liveReturn = async (productionEventId, conn = db) =>
  (await conn.query(
    `SELECT * FROM shipments WHERE production_event_id = $1 AND direction = 'return'
        AND cancelled_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [productionEventId]
  )).rows[0] || null;

module.exports = {
  provider, newProvider, newProviderName, PROVIDERS,
  ensurePickup, addressHash,
  byId, byTracking, forEvent, liveOutbound, lastOutbound, liveReturn,
  ShippingError,
};
