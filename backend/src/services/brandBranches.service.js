'use strict';

/**
 * brandBranches.service.js — a brand's store locations (table brand_branches, mig 172).
 * Contract: features/item3-discovery-profiles-groups · rules v1.11 §8A, §11.1 · prompt D2, A2
 *
 * Rules: exactly one main branch per brand; the main branch cannot be removed, only
 * replaced by making another branch main; creators only ever see city names. A branch is
 * created from a Google place id: the server resolves address, city and state and adds
 * the city to the canonical list when it is new (referenceLists.resolvePlace).
 */

const db = require('../config/db');
const ref = require('./referenceLists.service');

const MSG = Object.freeze({
  NAME_REQUIRED: 'Enter a branch name.',
  ADDRESS_REQUIRED: 'Search and pick your branch address.',
  MAIN_BRANCH: "The main branch can't be removed. Make another branch the main one first.",
});

function shape(r) {
  return {
    id: r.id,
    name: r.name,
    formattedAddress: r.formatted_address || null,
    pincode: r.pincode || null,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    googlePlaceId: r.google_place_id || null,
    cityId: r.city_id == null ? null : Number(r.city_id),
    cityName: r.city_name || null,
    stateId: r.state_id == null ? null : Number(r.state_id),
    stateName: r.state_name || null,
    isMain: !!r.is_main,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT = `
  SELECT bb.*, rc.name AS city_name, rs.name AS state_name
    FROM brand_branches bb
    LEFT JOIN ref_cities rc ON rc.id = bb.city_id
    LEFT JOIN ref_states rs ON rs.id = bb.state_id`;

async function list(brandId) {
  const { rows } = await db.query(`${SELECT} WHERE bb.brand_id = $1 ORDER BY bb.is_main DESC, bb.created_at ASC`, [brandId]);
  return rows.map(shape);
}

async function get(brandId, id) {
  const { rows } = await db.query(`${SELECT} WHERE bb.brand_id = $1 AND bb.id = $2`, [brandId, id]);
  return rows[0] ? shape(rows[0]) : null;
}

/** Public: the unique city names of a brand's branches, main first. */
async function cityNames(brandId) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (rc.id) rc.id, rc.name, bool_or(bb.is_main) OVER (PARTITION BY rc.id) AS any_main
       FROM brand_branches bb JOIN ref_cities rc ON rc.id = bb.city_id
      WHERE bb.brand_id = $1`, [brandId]);
  return rows.sort((a, b) => (b.any_main - a.any_main) || a.name.localeCompare(b.name)).map(r => ({ id: r.id, name: r.name }));
}

async function mainCity(brandId) {
  const { rows } = await db.query(
    `SELECT rc.id, rc.name, rs.name AS state_name FROM brand_branches bb
       JOIN ref_cities rc ON rc.id = bb.city_id JOIN ref_states rs ON rs.id = rc.state_id
      WHERE bb.brand_id = $1 AND bb.is_main LIMIT 1`, [brandId]);
  return rows[0] ? { id: rows[0].id, name: rows[0].name, stateName: rows[0].state_name } : null;
}

async function count(brandId) {
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM brand_branches WHERE brand_id = $1`, [brandId]);
  return rows[0].n;
}

function validationError(field, code, message) {
  const e = new Error(message); e.code = 'VALIDATION_ERROR'; e.field = field; e.details = { fields: [{ field, code, message }] }; return e;
}

/**
 * Create from a Google place id. body: { name, place_id, is_main?, session? }
 * Returns { branch, cityAdded }.
 */
async function create(brandId, body, { userId } = {}) {
  const name = String(body?.name || '').trim();
  if (!name) throw validationError('name', 'BRANCH_NAME_REQUIRED', MSG.NAME_REQUIRED);
  if (!body?.place_id) throw validationError('place_id', 'BRANCH_ADDRESS_REQUIRED', MSG.ADDRESS_REQUIRED);
  const place = await ref.resolvePlace(body.place_id, { session: body.session, userId });
  const existing = await count(brandId);
  const makeMain = existing === 0 || body.is_main === true;
  const branch = await db.withTransaction(async (tx) => {
    if (makeMain) await tx.query(`UPDATE brand_branches SET is_main = false, updated_at = now() WHERE brand_id = $1 AND is_main`, [brandId]);
    const { rows } = await tx.query(
      `INSERT INTO brand_branches (brand_id, name, google_place_id, formatted_address, pincode, lat, lng, city_id, state_id, is_main)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [brandId, name, place.placeId, place.formattedAddress, place.pincode, place.lat, place.lng, place.city ? place.city.id : null, place.state.id, makeMain]
    );
    return rows[0].id;
  });
  await syncMainToBrandRow(brandId);
  return { branch: await get(brandId, branch), cityAdded: !!(place.city && place.city.added) };
}

/** Update name and/or address and/or main flag. */
async function update(brandId, id, body, { userId } = {}) {
  const current = await get(brandId, id);
  if (!current) return null;
  const sets = [];
  const params = [brandId, id];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  let cityAdded = false;
  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw validationError('name', 'BRANCH_NAME_REQUIRED', MSG.NAME_REQUIRED);
    sets.push(`name = ${p(name)}`);
  }
  if (body.place_id !== undefined) {
    if (!body.place_id) throw validationError('place_id', 'BRANCH_ADDRESS_REQUIRED', MSG.ADDRESS_REQUIRED);
    const place = await ref.resolvePlace(body.place_id, { session: body.session, userId });
    cityAdded = !!(place.city && place.city.added);
    sets.push(`google_place_id = ${p(place.placeId)}`, `formatted_address = ${p(place.formattedAddress)}`,
      `pincode = ${p(place.pincode)}`, `lat = ${p(place.lat)}`, `lng = ${p(place.lng)}`,
      `city_id = ${p(place.city ? place.city.id : null)}`, `state_id = ${p(place.state.id)}`);
  }
  await db.withTransaction(async (tx) => {
    if (body.is_main === true && !current.isMain) {
      await tx.query(`UPDATE brand_branches SET is_main = false, updated_at = now() WHERE brand_id = $1 AND is_main`, [brandId]);
      sets.push(`is_main = true`);
    }
    if (sets.length) {
      await tx.query(`UPDATE brand_branches SET ${sets.join(', ')}, updated_at = now() WHERE brand_id = $1 AND id = $2`, params);
    }
  });
  await syncMainToBrandRow(brandId);
  return { branch: await get(brandId, id), cityAdded };
}

async function makeMain(brandId, id) {
  const current = await get(brandId, id);
  if (!current) return null;
  await db.withTransaction(async (tx) => {
    await tx.query(`UPDATE brand_branches SET is_main = false, updated_at = now() WHERE brand_id = $1 AND is_main`, [brandId]);
    await tx.query(`UPDATE brand_branches SET is_main = true, updated_at = now() WHERE brand_id = $1 AND id = $2`, [brandId, id]);
  });
  await syncMainToBrandRow(brandId);
  return get(brandId, id);
}

/** The main branch cannot be removed. A branch with planned shoots can (founder Q10). */
async function remove(brandId, id) {
  const current = await get(brandId, id);
  if (!current) return null;
  if (current.isMain) { const e = new Error(MSG.MAIN_BRANCH); e.code = 'MAIN_BRANCH'; e.field = 'id'; throw e; }
  // Item 4 — a Store Visit set names this branch (campaign_sets.branch_id, ON DELETE RESTRICT).
  // Refuse with words rather than let the foreign key answer with a database error.
  const { rows: used } = await db.query(`SELECT 1 FROM campaign_sets WHERE branch_id = $1 LIMIT 1`, [id]);
  if (used.length) { const e = new Error(require('./campaignCopy').MSG.BRANCH_IN_USE); e.code = 'BRANCH_IN_USE'; e.field = 'id'; throw e; }
  await db.query(`DELETE FROM brand_branches WHERE brand_id = $1 AND id = $2`, [brandId, id]);
  return current;
}

/**
 * Keep the legacy discovery columns on the brand row in step with the main branch (the
 * shopper app ranks by brands.lat/lng and users.city). Nothing else reads these for item 3.
 */
async function syncMainToBrandRow(brandId) {
  const { rows } = await db.query(
    `SELECT bb.lat, bb.lng, bb.formatted_address, bb.pincode, rc.name AS city, rs.name AS state
       FROM brand_branches bb LEFT JOIN ref_cities rc ON rc.id = bb.city_id LEFT JOIN ref_states rs ON rs.id = bb.state_id
      WHERE bb.brand_id = $1 AND bb.is_main LIMIT 1`, [brandId]);
  const m = rows[0];
  if (!m) return;
  await db.query(
    `UPDATE brands SET lat = COALESCE($2, lat), lng = COALESCE($3, lng), latitude = COALESCE($2, latitude), longitude = COALESCE($3, longitude),
            formatted_address = COALESCE($4, formatted_address), pincode = COALESCE($5, pincode), address_line = COALESCE($4, address_line)
      WHERE id = $1`, [brandId, m.lat, m.lng, m.formatted_address, m.pincode]);
  if (m.city) {
    await db.query(`UPDATE users u SET city = $2, state = COALESCE($3, u.state) FROM brands b WHERE b.user_id = u.id AND b.id = $1`, [brandId, m.city, m.state]);
  }
}

/**
 * A brand with no branch row gets a 'Main Branch' from its typed registration address — the
 * same rule migration 172 (pass 2) applied to the brands that existed before item 3. Called
 * right after /brands/register so a new brand shows its city from day one. The city is
 * matched by name (never auto-added here — founder Q8); state through the alias table.
 */
async function ensureMainFromBrandRow(brandId) {
  const { rows: n } = await db.query(`SELECT count(*)::int AS n FROM brand_branches WHERE brand_id = $1`, [brandId]);
  if (n[0].n > 0) return null;
  const { rows } = await db.query(
    `SELECT b.formatted_address, b.address_line, b.pincode, b.lat, b.lng, u.city, u.state
       FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`, [brandId]);
  const r = rows[0];
  if (!r) return null;
  let stateId = r.state ? await ref.findStateId(r.state) : null;
  let cityId = null;
  if (r.city && String(r.city).trim()) {
    const { rows: c } = await db.query(
      `SELECT id, state_id FROM ref_cities WHERE name_norm = lower(trim($1)) ORDER BY (state_id = $2) DESC NULLS LAST, id LIMIT 1`,
      [r.city, stateId]);
    if (c[0]) { cityId = c[0].id; if (!stateId) stateId = c[0].state_id; }
  }
  const { rows: ins } = await db.query(
    `INSERT INTO brand_branches (brand_id, name, formatted_address, pincode, lat, lng, city_id, state_id, is_main)
     VALUES ($1, 'Main Branch', $2, $3, $4, $5, $6, $7, true) RETURNING id`,
    [brandId, (r.formatted_address || r.address_line || '').trim() || null, (r.pincode || '').trim() || null, r.lat, r.lng, cityId, stateId]);
  return get(brandId, ins[0].id);
}

module.exports = { MSG, list, get, count, cityNames, mainCity, create, update, makeMain, remove, shape, ensureMainFromBrandRow };
