'use strict';

/**
 * followerAccount.controller.js — the shopper's account and delivery addresses.
 *
 * Kept from the retired follower.controller when the old shopper app was removed (follower-app-v2,
 * 29 Sep 2026). Addresses stay for the checkout discussion (rules O8). Exact location is never
 * stored (rules v1.7 §5.3): /reverse-geocode only turns a point into the nearest offered city.
 *
 *   POST   /followers/register        PATCH /followers/me        GET /followers/me
 *   POST   /follower/addresses        GET   /follower/addresses
 *   PATCH  /follower/addresses/:id    DELETE /follower/addresses/:id
 *   GET    /follower/reverse-geocode
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
// retire-google (20 Sep 2026): a coordinate becomes a city by nearest offered city centre.
const ref = require('../services/referenceLists.service');

async function getFollowerByUserId(userId) {
  const { rows } = await db.query(
    `SELECT f.id, f.user_id, f.default_address_id, f.city_id, f.shop_for, f.style_tag_ids, f.welcomed_at,
            u.name, u.city AS user_city, u.phone
     FROM followers f
     JOIN users u ON u.id = f.user_id
     WHERE f.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

// ── POST /followers/register ──────────────────────────────────────────────────

const register = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { name, city, state } = req.body;

  if (name || city || state) {
    await db.query(
      `UPDATE users SET
         name  = COALESCE($1, name),
         city  = COALESCE($2, city),
         state = COALESCE($3, state)
       WHERE id = $4`,
      [name || null, city || null, state || null, userId]
    );
  }

  const { rows } = await db.query(
    `INSERT INTO followers (user_id, city) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET city = COALESCE(EXCLUDED.city, followers.city)
     RETURNING id, user_id, city_id, shop_for, style_tag_ids, welcomed_at`,
    [userId, city || null]
  );

  return success(res, { follower: rows[0] }, 201);
});

// ── GET /followers/me ─────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found. Please register first.', 404);

  const { rows: addresses } = await db.query(
    `SELECT * FROM follower_addresses
      WHERE follower_id = $1 AND deleted_at IS NULL
      ORDER BY is_default DESC`,
    [follower.id]
  );

  // shopper-app-fixes (F4): the sign-in screen asks "Your name" once when she has never given one.
  const { nameNeeded } = require('../services/shopperEngagement.service');
  return success(res, { follower, addresses, name_needed: nameNeeded(follower.name) });
});

// ── Addresses ────────────────────────────────────────────────────────────────

// Addresses are entered by hand (shopper-ordering, rules 6.7): name, 10-digit phone, house, area,
// landmark (optional), 6-digit pincode, city, state from the list, Home / Work / Other. Up to 10.
// Any 6-digit pincode is accepted; there is no courier coverage check yet. A past order keeps its
// own copy of the address, so editing or deleting one never changes an order.
const MAX_ADDRESSES = 10;
const LABELS = ['Home', 'Work', 'Other'];

async function addressFields(body, { partial = false } = {}) {
  const b = body || {};
  const out = {};
  const txt = (v, max) => (v === undefined ? undefined : v === null ? null : String(v).trim().slice(0, max) || null);
  const need = (k, v, msg) => { if (!partial && !v) throw new AppError('VALIDATION_ERROR', msg, 422, k); };
  const name = txt(b.receiver_name ?? b.name, 80);
  const phone = b.receiver_phone ?? b.phone;
  const house = txt(b.house ?? b.line1, 200);
  const area = txt(b.area ?? b.line2, 200);
  const city = txt(b.city, 60);
  const state = txt(b.state, 60);
  const pin = b.pincode === undefined ? undefined : String(b.pincode || '').trim();
  need('receiver_name', name, 'Enter the name');
  need('house', house, 'Enter the house, flat or building');
  need('area', area, 'Enter the area or street');
  need('city', city, 'Enter the city');
  need('state', state, 'Choose the state');
  if (!partial || phone !== undefined) {
    const digits = String(phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(digits)) throw new AppError('VALIDATION_ERROR', 'Enter a 10-digit mobile number', 422, 'receiver_phone');
    out.receiver_phone = digits;
  }
  if (!partial || pin !== undefined) {
    if (!/^[1-9]\d{5}$/.test(pin || '')) throw new AppError('VALIDATION_ERROR', 'Enter a 6-digit pincode', 422, 'pincode');
    out.pincode = pin;
  }
  if (state) {
    const { rows } = await db.query(`SELECT name FROM ref_states WHERE lower(name) = lower($1)`, [state]).catch(() => ({ rows: [{ name: state }] }));
    const known = await db.query(`SELECT count(*)::int AS n FROM ref_states`).then((r) => r.rows[0].n).catch(() => 0);
    if (known && !rows[0]) throw new AppError('VALIDATION_ERROR', 'Choose the state from the list', 422, 'state');
    out.state = rows[0] ? rows[0].name : state;
  }
  const label = b.label === undefined ? undefined : LABELS.find((l) => l.toLowerCase() === String(b.label || '').toLowerCase()) || 'Other';
  Object.assign(out, { receiver_name: name, house, area, line1: house, line2: area, city, landmark: txt(b.landmark, 120), label });
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

const createAddress = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);
  const a = await addressFields(req.body);
  const { rows: [{ n }] } = await db.query(
    `SELECT count(*)::int AS n FROM follower_addresses WHERE follower_id = $1 AND deleted_at IS NULL`, [follower.id]);
  if (n >= MAX_ADDRESSES) throw new AppError('VALIDATION_ERROR', `You can keep up to ${MAX_ADDRESSES} addresses. Delete one to add another.`, 422);
  const makeDefault = !!req.body.is_default || n === 0;
  // The city's centre, when we know the city, helps the arrival estimate; never required (6.7).
  const centre = await ref.cityCentreForName(a.city).catch(() => null);
  const row = await db.withTransaction(async (conn) => {
    if (makeDefault) await conn.query(`UPDATE follower_addresses SET is_default = false WHERE follower_id = $1`, [follower.id]);
    const { rows } = await conn.query(
      `INSERT INTO follower_addresses
         (follower_id, label, line1, line2, house, area, city, state, pincode, is_default, lat, lng,
          receiver_name, receiver_phone, landmark)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [follower.id, a.label || 'Home', a.line1, a.line2, a.house, a.area, a.city, a.state, a.pincode, makeDefault,
        centre ? centre.lat : null, centre ? centre.lng : null, a.receiver_name, a.receiver_phone, a.landmark || null]);
    if (makeDefault) await conn.query(`UPDATE followers SET default_address_id = $1 WHERE id = $2`, [rows[0].id, follower.id]);
    return rows[0];
  });
  return success(res, { address: row }, 201);
});

const listAddresses = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { rows } = await db.query(
    `SELECT * FROM follower_addresses
      WHERE follower_id = $1 AND deleted_at IS NULL
      ORDER BY is_default DESC`,
    [follower.id]
  );

  return success(res, { addresses: rows });
});

const updateAddress = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);
  const { id } = req.params;
  const { rows: existing } = await db.query(
    `SELECT * FROM follower_addresses WHERE id = $1 AND follower_id = $2 AND deleted_at IS NULL`, [id, follower.id]);
  if (!existing[0]) throw new AppError('NOT_FOUND', 'Address not found', 404);
  const a = await addressFields(req.body, { partial: true });
  const cols = ['label', 'line1', 'line2', 'house', 'area', 'city', 'state', 'pincode', 'receiver_name', 'receiver_phone', 'landmark'];
  const sets = [];
  const vals = [];
  for (const c of cols) if (a[c] !== undefined) { vals.push(a[c]); sets.push(`${c} = $${vals.length}`); }
  const makeDefault = req.body.is_default === true;
  const row = await db.withTransaction(async (conn) => {
    if (makeDefault) {
      await conn.query(`UPDATE follower_addresses SET is_default = false WHERE follower_id = $1`, [follower.id]);
      sets.push('is_default = true');
      await conn.query(`UPDATE followers SET default_address_id = $1 WHERE id = $2`, [id, follower.id]);
    }
    if (!sets.length) return existing[0];
    vals.push(id);
    const { rows } = await conn.query(`UPDATE follower_addresses SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return rows[0];
  });
  return success(res, { address: row });
});

// SOFT delete. follower_orders.address_id references this table with no ON DELETE clause, so a
// hard delete would either fail on the FK or destroy the shipping address of a past order.
const deleteAddress = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { id } = req.params;

  const { rows: existing } = await db.query(
    `SELECT id, is_default FROM follower_addresses
      WHERE id = $1 AND follower_id = $2 AND deleted_at IS NULL`,
    [id, follower.id]
  );
  if (!existing[0]) throw new AppError('NOT_FOUND', 'Address not found', 404);

  await db.query(
    `UPDATE follower_addresses SET deleted_at = now(), is_default = false WHERE id = $1`,
    [id]
  );

  // Never leave the follower pointing at a deleted default — checkout reads it.
  const { rows: promoted } = await db.query(
    `SELECT id FROM follower_addresses
      WHERE follower_id = $1 AND deleted_at IS NULL
      ORDER BY is_default DESC, id
      LIMIT 1`,
    [follower.id]
  );
  const nextDefault = promoted[0]?.id || null;
  if (nextDefault) {
    await db.query(`UPDATE follower_addresses SET is_default = true WHERE id = $1`, [nextDefault]);
  }
  await db.query(
    `UPDATE followers SET default_address_id = $1 WHERE id = $2`,
    [nextDefault, follower.id]
  );

  return success(res, { deleted: true, default_address_id: nextDefault });
});

// ── PATCH /followers/me ──────────────────────────────────────────────────────
// The editable fields live on `users`. Phone is the login identity: never here.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const updateMe = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const hasName  = Object.prototype.hasOwnProperty.call(req.body || {}, 'name');
  const hasEmail = Object.prototype.hasOwnProperty.call(req.body || {}, 'email');
  if (!hasName && !hasEmail) {
    throw new AppError('VALIDATION_ERROR', 'Nothing to update', 422);
  }

  let name = null;
  if (hasName) {
    name = String(req.body.name ?? '').trim();
    if (name.length < 2 || name.length > 100) {
      throw new AppError('VALIDATION_ERROR', 'Name must be 2-100 characters', 422, 'name');
    }
  }

  // Explicit null/'' clears the email; anything else must be a valid address.
  let email = null;
  let clearEmail = false;
  if (hasEmail) {
    const raw = req.body.email;
    if (raw === null || String(raw).trim() === '') {
      clearEmail = true;
    } else {
      email = String(raw).trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 200) {
        throw new AppError('VALIDATION_ERROR', 'Enter a valid email address', 422, 'email');
      }
    }
  }

  let rows;
  try {
    ({ rows } = await db.query(
      `UPDATE users SET
         name       = COALESCE($1, name),
         email      = CASE WHEN $3::boolean THEN NULL ELSE COALESCE($2, email) END,
         updated_at = now()
       WHERE id = $4
       RETURNING id, name, email, phone, city, state`,
      [name, email, clearEmail, req.user.sub]
    ));
  } catch (e) {
    // users.email is UNIQUE — surface it as a field error, never a raw 500.
    if (e.code === '23505') {
      throw new AppError('VALIDATION_ERROR', 'That email is already in use', 422, 'email');
    }
    throw e;
  }

  return success(res, { follower: { ...follower, ...rows[0], id: follower.id, user_id: req.user.sub } });
});

// GET /v1/follower/reverse-geocode?lat&lng → the nearest offered city (public). The point is used
// and forgotten; nothing is stored.
const reverseGeocode = asyncHandler(async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AppError('VALIDATION_ERROR', 'lat/lng required', 422, 'lat');
  }
  const near = await ref.nearestCity(lat, lng);
  return success(res, { area_name: near ? near.name : null, city: near ? near.name : null, city_id: near ? near.id : null, state: near ? near.stateName : null, km: near ? near.km : null });
});

module.exports = {
  getFollowerByUserId, register, getMe, updateMe,
  createAddress, listAddresses, updateAddress, deleteAddress, reverseGeocode,
};
