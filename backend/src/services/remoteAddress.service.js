'use strict';

/**
 * remoteAddress.service.js — F2, F3, F4: her delivery address.
 * Contract: features/item11-remote · rules v1.27 §11.2, §2B, §28 · mockups R3, R4a, R4b, R16
 *
 * THE FIRST CREATOR STREET ADDRESS INFLX HAS EVER HELD.
 *
 * Four rules, and every one of them is here rather than on a screen:
 *   1. It is checked against the courier network BEFORE it can be sent. No delivery → she
 *      cannot send it and is told why. No return pickup → she can, and the brand is warned
 *      before marking anything Return.
 *   2. It LOCKS when sent (§28). A second send and any edit are refused.
 *   3. It is a SNAPSHOT. Her profile changing later changes nothing here.
 *   4. ONE correction, and only after the courier brought the parcel back to the store.
 *
 * Privacy is not enforced here — it is enforced where data LEAVES, in remoteShoot.read and in
 * production.controller's projection. A rule applied at the write is a rule one new endpoint
 * can walk around.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const refs = require('./referenceLists.service');
const shipping = require('./shipping');
const shoot = require('./remoteShoot.service');
const { MSG, NOTIFY11 } = require('./productionCopy');
const { logAction } = require('./production.service');

const trim = (v) => String(v == null ? '' : v).trim();

/** A valid Indian mobile, in the shape item 10's normalisePhone uses. */
function normalisePhone(raw) {
  const digits = trim(raw).replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

/* ───────────────────────────────────────────── F2 — the coverage check */

/**
 * Is this pincode reachable? Asked as she types (R3) and again, authoritatively, at send.
 *
 * The PICKUP end matters too: a parcel is collected from the brand's main branch, and a
 * pincode couriers cannot reach is a pickup that cannot happen either.
 */
async function coverage(ciId, scope, pincode, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);

  const pin = trim(pincode);
  if (!/^\d{6}$/.test(pin)) throw new AppError('VALIDATION_ERROR', MSG.PINCODE_REQUIRED, 422, 'pincode');

  const branch = await pickupBranch(r, null, conn);
  const api = shipping.newProvider().api;
  const out = await api.checkCoverage({
    pickupPincode: branch ? branch.pincode : null,
    deliveryPincode: pin,
  });

  return {
    pincode: pin,
    delivers: out.delivers,
    returnPickup: out.returnPickup,
    checkedAt: out.checkedAt,
    // The screen shows one of these three; the server decides which, so both apps agree.
    message: !out.delivers ? MSG.NOT_DELIVERABLE(pin)
      : !out.returnPickup
        ? `Couriers deliver to ${pin} but can't collect returns from it. You can still send it — ${r.brand_name} will be told before they choose what to send back.`
        : `Couriers deliver and collect returns at ${pin}.`,
  };
}

/** The branch a parcel is collected from: the one the brand chose, else its main one. */
async function pickupBranch(r, branchId, conn = db) {
  const { rows } = await conn.query(
    `SELECT bb.*, rc.name AS city_name, rs.name AS state_name
       FROM brand_branches bb
       LEFT JOIN ref_cities rc ON rc.id = bb.city_id
       LEFT JOIN ref_states rs ON rs.id = bb.state_id
      WHERE bb.brand_id = $1 ${branchId ? 'AND bb.id = $2' : 'AND bb.is_main'}
      LIMIT 1`,
    branchId ? [r.brand_id, branchId] : [r.brand_id]);
  return rows[0] || null;
}

/* ───────────────────────────────────────────── F3 — send it */

/**
 * One call. The confirm sheet (R4a) is the review, so there is no server-side draft — item 10
 * settled that for the visit plan (its Q5) and the same reasoning holds.
 */
async function send(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  if (r.address_sent_at) throw new AppError('ADDRESS_ALREADY_SENT', MSG.ADDRESS_ALREADY_SENT(r.brand_name), 422, 'status');

  const fields = await validate(body);
  const branch = await pickupBranch(r, null, conn);
  const api = shipping.newProvider().api;
  const cov = await api.checkCoverage({ pickupPincode: branch ? branch.pincode : null, deliveryPincode: fields.pincode });
  if (!cov.delivers) {
    throw new AppError('NOT_DELIVERABLE', MSG.NOT_DELIVERABLE(fields.pincode), 422, 'pincode');
  }

  // Compare-and-swap: two taps, or two devices, produce ONE sent address.
  const { rows } = await conn.query(
    `UPDATE production_events
        SET ship_to_name = $2, ship_to_phone = $3, ship_to_street = $4, ship_to_pincode = $5,
            ship_to_state_id = $6, ship_to_city_id = $7, ship_to_state_name = $8, ship_to_city_name = $9,
            ship_to_note = $10, ship_to_sizes = $11,
            coverage_delivers = $12, coverage_return_pickup = $13, coverage_checked_at = now(),
            address_sent_at = now(), updated_at = now()
      WHERE id = $1 AND address_sent_at IS NULL
      RETURNING id`,
    [r.id, fields.name, fields.phone, fields.street, fields.pincode,
     fields.stateId, fields.cityId, fields.stateName, fields.cityName,
     fields.note, fields.sizes, cov.delivers, cov.returnPickup]);
  if (!rows[0]) throw new AppError('ADDRESS_ALREADY_SENT', MSG.ADDRESS_ALREADY_SENT(r.brand_name), 422, 'status');

  await logAction(conn, r.id, scope.userId, 'influencer', 'address_sent',
    `She sent her delivery address (${fields.cityName}, ${fields.pincode})`,
    { returnPickup: cov.returnPickup });

  await shoot.notifyBrand(r, NOTIFY11.ADDRESS_SENT,
    `${shoot.first(r.creator_name)} sent her delivery address. Pick the products and book the parcel.`
    + (cov.returnPickup ? '' : " Couriers can't collect returns from her pincode — you'll be warned before marking anything Return."));

  return shoot.read(ciId, scope, conn);
}

/* ───────────────────────────────────────────── F4 — correct it, once */

async function correct(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  if (!r.address_sent_at) throw new AppError('CORRECTION_NOT_ALLOWED', MSG.CORRECTION_NOT_ALLOWED, 422, 'status');
  if (r.address_corrected_at) throw new AppError('CORRECTION_USED', MSG.CORRECTION_USED, 422, 'status');

  // §11.2: only after the courier RETURNED the parcel to the store. Not at any other moment.
  const parcel = await shipping.lastOutbound(r.id, conn);
  if (!parcel || !parcel.returned_to_store_at) {
    throw new AppError('CORRECTION_NOT_ALLOWED', MSG.CORRECTION_NOT_ALLOWED, 422, 'status');
  }

  const fields = await validate(body);
  const branch = await pickupBranch(r, parcel.branch_id, conn);
  const api = shipping.newProvider().api;
  const cov = await api.checkCoverage({ pickupPincode: branch ? branch.pincode : null, deliveryPincode: fields.pincode });
  if (!cov.delivers) throw new AppError('NOT_DELIVERABLE', MSG.NOT_DELIVERABLE(fields.pincode), 422, 'pincode');

  const { rows } = await conn.query(
    `UPDATE production_events
        SET ship_to_name = $2, ship_to_phone = $3, ship_to_street = $4, ship_to_pincode = $5,
            ship_to_state_id = $6, ship_to_city_id = $7, ship_to_state_name = $8, ship_to_city_name = $9,
            ship_to_note = $10, ship_to_sizes = $11,
            coverage_delivers = $12, coverage_return_pickup = $13, coverage_checked_at = now(),
            address_corrected_at = now(), updated_at = now()
      WHERE id = $1 AND address_corrected_at IS NULL
      RETURNING id`,
    [r.id, fields.name, fields.phone, fields.street, fields.pincode,
     fields.stateId, fields.cityId, fields.stateName, fields.cityName,
     fields.note, fields.sizes, cov.delivers, cov.returnPickup]);
  if (!rows[0]) throw new AppError('CORRECTION_USED', MSG.CORRECTION_USED, 422, 'status');

  await logAction(conn, r.id, scope.userId, 'influencer', 'address_corrected',
    `She corrected her address after the parcel came back (${fields.cityName}, ${fields.pincode})`, null);
  await shoot.notifyBrand(r, NOTIFY11.ADDRESS_SENT,
    `${shoot.first(r.creator_name)} corrected her address. You can book the parcel again.`);

  return shoot.read(ciId, scope, conn);
}

/* ───────────────────────────────────────────── validation (§7, verbatim) */

/**
 * Every message is the gap-check prompt's §7, word for word, and the SERVER is where they are
 * decided — the app shows the same strings from its mirror of productionCopy.
 */
async function validate(body) {
  const name = trim(body.name);
  if (!name || name.length > 80) throw new AppError('VALIDATION_ERROR', MSG.NAME_REQUIRED, 422, 'name');

  const phone = normalisePhone(body.phone);
  if (!phone) throw new AppError('VALIDATION_ERROR', MSG.PHONE_REQUIRED, 422, 'phone');

  const street = trim(body.street);
  if (!street) throw new AppError('VALIDATION_ERROR', MSG.STREET_REQUIRED, 422, 'street');
  // courier-ready-addresses: 190 is all a courier keeps of an address. Anything past it would be
  // cut off the label without her knowing — usually the landmark, which is the useful part.
  if (street.length > 190) throw new AppError('VALIDATION_ERROR', MSG.STREET_LONG, 422, 'street');

  const pincode = trim(body.pincode);
  if (!/^\d{6}$/.test(pincode)) throw new AppError('VALIDATION_ERROR', MSG.PINCODE_REQUIRED, 422, 'pincode');

  const stateId = Number(body.stateId);
  const cityId = Number(body.cityId);
  if (!Number.isInteger(stateId) || stateId <= 0) throw new AppError('VALIDATION_ERROR', MSG.STATE_REQUIRED, 422, 'stateId');
  if (!Number.isInteger(cityId) || cityId <= 0) throw new AppError('VALIDATION_ERROR', MSG.CITY_REQUIRED, 422, 'cityId');

  // §2B: state and city are stored as REFERENCES to the list, never as typed names — so every
  // matching rule on the platform reads the same vocabulary. The names are snapshotted
  // alongside so a renamed row never rewrites what was on a label.
  //
  // resolveStateCity joins the two and requires BOTH ids to match, so a city from another
  // state comes back null — the city field is the honest place to say so.
  const resolved = await refs.resolveStateCity(stateId, cityId);
  if (!resolved) throw new AppError('VALIDATION_ERROR', MSG.CITY_REQUIRED, 422, 'cityId');

  const note = trim(body.note);
  if (note.length > 200) throw new AppError('VALIDATION_ERROR', MSG.NOTE_LONG, 422, 'note');
  const sizes = trim(body.sizes);
  if (sizes.length > 100) throw new AppError('VALIDATION_ERROR', MSG.SIZES_LONG, 422, 'sizes');

  return {
    name, phone, street, pincode,
    stateId, cityId,
    stateName: resolved.stateName, cityName: resolved.cityName,
    note: note || null, sizes: sizes || null,
  };
}

module.exports = { coverage, send, correct, validate, normalisePhone, pickupBranch };
