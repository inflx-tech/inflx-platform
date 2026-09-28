'use strict';

/**
 * Gift items — things a brand gives away with a free gift offer but never sells (rules 1.7, O13).
 * Contract: features/offer-builder-v2
 *
 * Four fields: name, photo, value (₹, shown to shoppers as "worth ₹650" and used in the gift check),
 * stock (each gift given takes one; restocked here). No category, sizes or price. They never appear
 * in the shop, in buy pools, in "products without offers" or in creator terms — only in a free gift
 * offer's gift pool, and like products, in only one live offer at a time.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { calendarDay, todayInIndia } = require('../utils/indiaDay');

function clean(body, partial) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new AppError('VALIDATION_ERROR', 'Give the gift item a name.', 422, 'name');
    if (name.length > 120) throw new AppError('VALIDATION_ERROR', 'Keep the name under 120 characters.', 422, 'name');
    out.name = name;
  }
  if (!partial || body.value !== undefined) {
    const v = Number(body.value);
    if (!(v > 0)) throw new AppError('VALIDATION_ERROR', 'The value must be more than ₹0.', 422, 'value');
    out.value = Math.round(v * 100) / 100;
  }
  if (!partial || body.stock !== undefined) {
    const s = Number(body.stock);
    if (!Number.isInteger(s) || s < 0) throw new AppError('VALIDATION_ERROR', 'Stock must be a whole number, 0 or more.', 422, 'stock');
    out.stock = s;
  }
  if (body.photo_url !== undefined) {
    const u = body.photo_url ? String(body.photo_url).trim() : null;
    if (u && !/^https?:\/\//i.test(u) && !u.startsWith('/')) throw new AppError('VALIDATION_ERROR', 'Upload the photo again.', 422, 'photo_url');
    out.photo_url = u;
  }
  return out;
}

function row(r) {
  return {
    id: r.id, name: r.name, photo_url: r.photo_url, value: Number(r.value), stock: Number(r.stock),
    used_in: r.offer_name ? { offer_id: r.offer_id, name: r.offer_name, from: calendarDay(r.from_day), until: calendarDay(r.until), now: !!r.is_now } : null,
    created_at: r.created_at,
  };
}

const USED_IN = `LEFT JOIN LATERAL (
    SELECT o.id AS offer_id, o.name AS offer_name, lower(i.lock_days) AS from_day, (upper(i.lock_days) - 1) AS until,
           (i.lock_days @> $2::date) AS is_now
      FROM offer_pool_items i JOIN brand_offers o ON o.id = i.offer_id
     WHERE i.gift_item_id = g.id AND i.removed_at IS NULL AND NOT isempty(i.lock_days) AND upper(i.lock_days) > $2::date
     ORDER BY lower(i.lock_days) LIMIT 1) u ON true`;

async function list(brandId, { today = todayInIndia() } = {}) {
  const { rows } = await db.query(
    `SELECT g.*, u.* FROM gift_items g ${USED_IN} WHERE g.brand_id = $1 ORDER BY g.created_at DESC, g.id`, [brandId, today]);
  return rows.map(row);
}

async function create(brandId, body = {}) {
  const v = clean(body, false);
  const { rows } = await db.query(
    `INSERT INTO gift_items (brand_id, name, photo_url, value, stock) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [brandId, v.name, v.photo_url || null, v.value, v.stock]);
  return row(rows[0]);
}

async function update(brandId, id, body = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) throw new AppError('NOT_FOUND', 'Gift item not found', 404);
  const v = clean(body, true);
  const keys = Object.keys(v);
  if (!keys.length) throw new AppError('VALIDATION_ERROR', 'Nothing to change.', 422);
  const sets = keys.map((k, i) => `${k} = $${i + 3}`);
  const { rows } = await db.query(
    `UPDATE gift_items SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND brand_id = $2 RETURNING *`,
    [id, brandId, ...keys.map((k) => v[k])]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Gift item not found', 404);
  return row(rows[0]);
}

module.exports = { list, create, update };
