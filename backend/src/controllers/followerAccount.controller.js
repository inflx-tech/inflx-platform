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

  return success(res, { follower, addresses });
});

// ── Addresses ────────────────────────────────────────────────────────────────

const createAddress = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { label, line1, line2, city, pincode, is_default,
          receiver_name, receiver_phone, landmark } = req.body;
  if (!line1) throw new AppError('VALIDATION_ERROR', 'line1 is required', 422, 'line1');

  if (is_default) {
    await db.query(
      `UPDATE follower_addresses SET is_default = false WHERE follower_id = $1`,
      [follower.id]
    );
  }

  // retire-google: prefer client-sent coords ("use current location"); otherwise the typed
  // city's centre from our own list. No Google. An address with neither is refused.
  let lat = Number.isFinite(parseFloat(req.body.lat)) ? parseFloat(req.body.lat) : null;
  let lng = Number.isFinite(parseFloat(req.body.lng)) ? parseFloat(req.body.lng) : null;
  if (lat == null || lng == null) {
    const centre = await ref.cityCentreForName(city);
    if (centre) { lat = centre.lat; lng = centre.lng; }
  }
  if (lat == null || lng == null) {
    throw new AppError('VALIDATION_ERROR',
      "We couldn't place that address. Pick your city from the list, or use 'Current location'.",
      422, 'city');
  }

  const { rows } = await db.query(
    `INSERT INTO follower_addresses
       (follower_id, label, line1, line2, city, pincode, is_default, lat, lng,
        receiver_name, receiver_phone, landmark)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [follower.id, label || null, line1, line2 || null, city || null, pincode || null, !!is_default, lat, lng,
     receiver_name || null, receiver_phone || null, landmark || null]
  );

  if (is_default) {
    await db.query(
      `UPDATE followers SET default_address_id = $1 WHERE id = $2`,
      [rows[0].id, follower.id]
    );
  }

  return success(res, { address: rows[0] }, 201);
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
    `SELECT * FROM follower_addresses
      WHERE id = $1 AND follower_id = $2 AND deleted_at IS NULL`,
    [id, follower.id]
  );
  if (!existing[0]) throw new AppError('NOT_FOUND', 'Address not found', 404);

  const { label, line1, line2, city, pincode, is_default } = req.body;

  if (is_default) {
    await db.query(
      `UPDATE follower_addresses SET is_default = false WHERE follower_id = $1`,
      [follower.id]
    );
  }

  const { rows } = await db.query(
    `UPDATE follower_addresses SET
       label      = COALESCE($1, label),
       line1      = COALESCE($2, line1),
       line2      = COALESCE($3, line2),
       city       = COALESCE($4, city),
       pincode    = COALESCE($5, pincode),
       is_default = COALESCE($6, is_default)
     WHERE id = $7
     RETURNING *`,
    [label || null, line1 || null, line2 || null, city || null, pincode || null,
      is_default !== undefined ? is_default : null, id]
  );

  if (is_default) {
    await db.query(`UPDATE followers SET default_address_id = $1 WHERE id = $2`, [id, follower.id]);
  }

  return success(res, { address: rows[0] });
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
