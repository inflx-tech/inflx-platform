'use strict';

/**
 * creatorAddress.service.js — the delivery address a creator keeps in her profile.
 * Contract: features/creator-address-bank-save · 03-expected-outputs.md (A1–A9)
 *
 * Until now she typed her street address into every Remote collaboration, from nothing. She now
 * keeps one in her profile, and the Remote form starts from it.
 *
 * Three rules:
 *   1. PRIVATE. Only she reads it. A brand gets an address only when she sends one for a
 *      collaboration, and what it gets is that collaboration's own snapshot.
 *   2. The profile address and a sent address never write to each other. Changing the address on
 *      one parcel leaves her profile alone; changing her profile leaves every sent parcel alone.
 *      (The one exception she chooses herself: "Keep this address in my profile", on a Remote
 *      form opened with no profile address — see keepIfNone.)
 *   3. It is checked the way a Remote address is checked — the same rules, the same words — so an
 *      address that saves here is one the Remote form will take. The courier check is NOT made
 *      here: whether a courier reaches her depends on which store is sending, and is asked on
 *      each collaboration, as it always was.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');

const shape = (a) => (a ? {
  name: a.name, phone: a.phone, street: a.street, pincode: a.pincode,
  stateId: a.state_id, cityId: a.city_id, stateName: a.state_name, cityName: a.city_name,
  note: a.note || '', updatedAt: a.updated_at,
} : null);

/** Her influencer row, as much of it as an empty form starts from. */
async function owner(userId, conn = db) {
  const { rows: [o] } = await conn.query(
    `SELECT i.id, COALESCE(i.full_name, u.name) AS name, u.phone,
            i.state_id, i.city_id, rs.name AS state_name, rc.name AS city_name
       FROM influencers i JOIN users u ON u.id = i.user_id
       LEFT JOIN ref_states rs ON rs.id = i.state_id
       LEFT JOIN ref_cities rc ON rc.id = i.city_id
      WHERE i.user_id = $1`, [userId]);
  if (!o) throw new AppError('NOT_FOUND', 'Influencer profile not found. Please register first.', 404);
  return o;
}

async function forInfluencer(influencerId, conn = db) {
  const { rows: [a] } = await conn.query(`SELECT * FROM creator_delivery_addresses WHERE influencer_id = $1`, [influencerId]);
  return shape(a);
}

/** What the Delivery address screen opens with: her address, or what an empty form starts from. */
async function read(userId) {
  const o = await owner(userId);
  return {
    address: await forInfluencer(o.id),
    prefill: {
      name: o.name || '',
      phone: o.phone ? String(o.phone).replace(/\D/g, '').slice(-10) : '',
      stateId: o.state_id || null, cityId: o.city_id || null,
      stateName: o.state_name || '', cityName: o.city_name || '',
    },
  };
}

async function upsert(influencerId, f, conn = db) {
  const { rows: [a] } = await conn.query(
    `INSERT INTO creator_delivery_addresses
       (influencer_id, name, phone, street, pincode, state_id, city_id, state_name, city_name, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (influencer_id) DO UPDATE
       SET name = EXCLUDED.name, phone = EXCLUDED.phone, street = EXCLUDED.street, pincode = EXCLUDED.pincode,
           state_id = EXCLUDED.state_id, city_id = EXCLUDED.city_id,
           state_name = EXCLUDED.state_name, city_name = EXCLUDED.city_name,
           note = EXCLUDED.note, updated_at = now()
     RETURNING *`,
    [influencerId, f.name, f.phone, f.street, f.pincode, f.stateId, f.cityId, f.stateName, f.cityName, f.note]);
  return shape(a);
}

async function save(userId, body = {}) {
  const o = await owner(userId);
  // Required here, not at the top: remoteAddress → remoteShoot → this file would be a circle.
  const { validate } = require('./remoteAddress.service');
  const f = await validate({ ...body, sizes: '' });
  return { address: await upsert(o.id, f) };
}

async function remove(userId) {
  const o = await owner(userId);
  await db.query(`DELETE FROM creator_delivery_addresses WHERE influencer_id = $1`, [o.id]);
  return { address: null };
}

/**
 * "Keep this address in my profile" — ticked on a Remote form that opened with no profile
 * address. It only ever FILLS an empty profile: a creator who already keeps an address is never
 * overwritten by one parcel's change. `f` is the address already checked by the Remote send.
 */
async function keepIfNone(influencerId, f, conn = db) {
  await conn.query(
    `INSERT INTO creator_delivery_addresses
       (influencer_id, name, phone, street, pincode, state_id, city_id, state_name, city_name, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (influencer_id) DO NOTHING`,
    [influencerId, f.name, f.phone, f.street, f.pincode, f.stateId, f.cityId, f.stateName, f.cityName, f.note]);
}

module.exports = { read, save, remove, forInfluencer, keepIfNone, shape };
