'use strict';

/**
 * brandBranches.service.js — a brand's store locations (table brand_branches, mig 172).
 * Contract: features/item3-discovery-profiles-groups · rules v1.11 §8A, §11.1 · prompt D2, A2
 *
 * Rules: exactly one main branch per brand; the main branch cannot be removed, only
 * replaced by making another branch main; creators only ever see city names.
 *
 * registration-and-profile (spec §1.1, §4, §9): every address is exactly four parts — street
 * (typed), pincode (6 digits), state (picked), city (picked, in that state). The Google place
 * search is gone from branch add and edit; a branch carries no place id and no coordinates.
 * When a brand adds its SECOND branch it must say which of the two is the main one — never
 * assumed. From the third branch on, make-main covers it.
 *
 * courier-ready-addresses (founder, 7 Oct 2026): the street address is held to what a courier
 * will accept as a pickup — 10 to 140 characters, with a shop or door number — because Shiprocket
 * refuses anything less and, on 6 Oct 2026, would have refused ten of the fourteen branches on
 * the platform. A branch also carries a landmark (the courier's second address line) and its
 * own phone. Branches that already exist are not rewritten: `courierProblem` says what each
 * lacks, and the two moments it matters — saving that branch, shipping from it — say it too.
 */

const db = require('../config/db');
const ref = require('./referenceLists.service');

const MSG = Object.freeze({
  NAME_REQUIRED: 'Enter a branch name.',
  ADDRESS_REQUIRED: 'Enter the street address.',
  ADDRESS_SHORT: 'Add the shop or door number, building and street. A courier has to find it.',
  ADDRESS_NUMBER: 'Add the shop or door number. Couriers need it to find the store.',
  ADDRESS_LONG: 'Keep the address under 140 characters.',
  LANDMARK_LONG: 'Keep the landmark under 45 characters.',
  PHONE: 'Enter a 10-digit mobile number.',
  PINCODE: 'Enter a 6-digit PIN code.',
  CITY_REQUIRED: 'Pick the state, then the city.',
  // What a branch a courier would refuse says on the booking screen's branch list.
  NEEDS_ADDRESS: 'Needs a street address and pincode',
  NEEDS_NUMBER: 'Needs a shop or door number',
  MAIN_CHOICE_REQUIRED: 'Which one is your main branch?',
  MAIN_BRANCH: "The main branch can't be removed. Make another branch the main one first.",
});

const STREET_MIN = 10;
const STREET_MAX = 140;
const LANDMARK_MAX = 45;

const STREET_MESSAGE = Object.freeze({
  BRANCH_ADDRESS_REQUIRED: MSG.ADDRESS_REQUIRED,
  BRANCH_ADDRESS_LONG: MSG.ADDRESS_LONG,
  BRANCH_ADDRESS_SHORT: MSG.ADDRESS_SHORT,
  BRANCH_ADDRESS_NUMBER: MSG.ADDRESS_NUMBER,
});

/**
 * What is wrong with a street address as somewhere a courier must find — a code, or null. Pure.
 *
 * "A number" means a shop, door, plot or road number. A six-digit run is a pincode and does not
 * count: "MG Road, Vijayawada 520010" tells a courier nothing "MG Road, Vijayawada" did not.
 */
function streetProblem(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return 'BRANCH_ADDRESS_REQUIRED';
  if (t.length > STREET_MAX) return 'BRANCH_ADDRESS_LONG';
  if (t.length < STREET_MIN) return 'BRANCH_ADDRESS_SHORT';
  if (!/\d/.test(t.replace(/(^|\D)\d{6}(?!\d)/g, '$1 '))) return 'BRANCH_ADDRESS_NUMBER';
  return null;
}
const streetMessage = (code) => STREET_MESSAGE[code] || MSG.ADDRESS_REQUIRED;

/**
 * Why a courier would refuse to collect from this branch, in the words the booking screen
 * shows — or null when it would not. Takes a row or a shaped branch.
 *
 * An address written before this rule may be longer than 140 characters; that alone is not a
 * reason to refuse it (the courier's own limit is 190, and the connector keeps to it).
 */
function courierProblem(b) {
  const street = b && (b.formatted_address !== undefined ? b.formatted_address : b.formattedAddress);
  if (!street || !String(street).trim() || !(b && b.pincode)) return MSG.NEEDS_ADDRESS;
  const code = streetProblem(street);
  return code === 'BRANCH_ADDRESS_SHORT' || code === 'BRANCH_ADDRESS_NUMBER' ? MSG.NEEDS_NUMBER : null;
}

/** The landmark as stored: trimmed, or null. undefined in → undefined out (not sent, not changed). */
function landmarkOf(v) {
  if (v === undefined) return undefined;
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (t.length > LANDMARK_MAX) throw validationError('landmark', 'BRANCH_LANDMARK_LONG', MSG.LANDMARK_LONG);
  return t || null;
}

/** The store phone as stored: ten digits, or null (= the brand's login number). */
function phoneOf(v) {
  if (v === undefined) return undefined;
  const raw = String(v == null ? '' : v).trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) throw validationError('phone', 'BRANCH_PHONE', MSG.PHONE);
  return ten;
}

/** The street and its landmark as one line — what a label or a return address prints. */
function fullStreet(b) {
  const street = b && (b.formatted_address !== undefined ? b.formatted_address : b.formattedAddress);
  return [street, b && b.landmark].map((x) => String(x || '').trim()).filter(Boolean).join(', ');
}

/**
 * Item 10 (founder, 18 Sep): the Google search is not answering, and a Store Visit set now needs
 * a branch with a street address. So an address may be TYPED as well as picked. A typed address
 * carries no place id, no coordinates and no map pin; "Open in Maps" falls back to searching the
 * text. The city and state come from the branch as it stands (edit) or from the brand's
 * registration city (create) — never guessed from the text.
 *
 * @returns {{ formattedAddress: string, pincode: string|null }}
 */
function typedAddress(body, { requirePin = true } = {}) {
  const text = String(body.address_text || '').replace(/\s+/g, ' ').trim();
  const problem = streetProblem(text);
  if (problem) throw validationError('address_text', problem, streetMessage(problem));
  const pin = body.pincode == null || body.pincode === '' ? null : String(body.pincode).trim();
  if ((pin == null && requirePin) || (pin != null && !/^\d{6}$/.test(pin))) throw validationError('pincode', 'BRANCH_PINCODE', MSG.PINCODE);
  return { formattedAddress: text, pincode: pin };
}

/** The picked state + city, resolved; the city must sit in the state. */
async function pickedCity(body) {
  const r = await ref.resolveStateCity(body.state_id, body.city_id);
  if (!r) throw validationError('city_id', 'BRANCH_CITY_REQUIRED', MSG.CITY_REQUIRED);
  return r;
}

function shape(r) {
  return {
    id: r.id,
    name: r.name,
    formattedAddress: r.formatted_address || null,
    landmark: r.landmark || null,
    // The store's own number; null means the brand's login number is what a courier is given.
    phone: r.phone || null,
    pincode: r.pincode || null,
    courierReady: !courierProblem(r),
    courierProblem: courierProblem(r),
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
 * Create from the four parts. body: { name, address_text, pincode, state_id, city_id, is_main? }
 * The first branch is main. The SECOND requires is_main to be stated (true or false) —
 * MAIN_CHOICE_REQUIRED otherwise. Returns { branch }.
 */
async function create(brandId, body) {
  const name = String(body?.name || '').trim();
  if (!name) throw validationError('name', 'BRANCH_NAME_REQUIRED', MSG.NAME_REQUIRED);
  if (body?.place_id && !body?.address_text) throw validationError('address_text', 'BRANCH_ADDRESS_REQUIRED', MSG.ADDRESS_REQUIRED);
  const t = typedAddress(body || {});
  const landmark = landmarkOf(body.landmark) || null;
  const phone = phoneOf(body.phone) || null;
  const place = await pickedCity(body || {});
  const existing = await count(brandId);
  if (existing === 1 && typeof body.is_main !== 'boolean') throw validationError('is_main', 'MAIN_CHOICE_REQUIRED', MSG.MAIN_CHOICE_REQUIRED);
  const makeMain = existing === 0 || body.is_main === true;
  const branch = await db.withTransaction(async (tx) => {
    if (makeMain) await tx.query(`UPDATE brand_branches SET is_main = false, updated_at = now() WHERE brand_id = $1 AND is_main`, [brandId]);
    const { rows } = await tx.query(
      `INSERT INTO brand_branches (brand_id, name, google_place_id, formatted_address, pincode, lat, lng, city_id, state_id, is_main, landmark, phone)
       VALUES ($1,$2,NULL,$3,$4,NULL,NULL,$5,$6,$7,$8,$9) RETURNING id`,
      [brandId, name, t.formattedAddress, t.pincode, place.cityId, place.stateId, makeMain, landmark, phone]
    );
    return rows[0].id;
  });
  await syncMainToBrandRow(brandId);
  return { branch: await get(brandId, branch), cityAdded: false };
}

/** Update name and/or any of the four address parts and/or the main flag. */
async function update(brandId, id, body) {
  const current = await get(brandId, id);
  if (!current) return null;
  const sets = [];
  const params = [brandId, id];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw validationError('name', 'BRANCH_NAME_REQUIRED', MSG.NAME_REQUIRED);
    sets.push(`name = ${p(name)}`);
  }
  if (body.address_text !== undefined || body.pincode !== undefined) {
    const t = typedAddress({ address_text: body.address_text !== undefined ? body.address_text : current.formattedAddress,
                             pincode: body.pincode !== undefined ? body.pincode : current.pincode });
    sets.push(`google_place_id = NULL`, `formatted_address = ${p(t.formattedAddress)}`, `pincode = ${p(t.pincode)}`, `lat = NULL`, `lng = NULL`);
  }
  // Not sent → not changed: an app that predates the two fields must not wipe them.
  const landmark = landmarkOf(body.landmark);
  if (landmark !== undefined) sets.push(`landmark = ${p(landmark)}`);
  const phone = phoneOf(body.phone);
  if (phone !== undefined) sets.push(`phone = ${p(phone)}`);
  if (body.state_id !== undefined || body.city_id !== undefined) {
    const place = await pickedCity({ state_id: body.state_id !== undefined ? body.state_id : current.stateId,
                                     city_id: body.city_id !== undefined ? body.city_id : current.cityId });
    sets.push(`city_id = ${p(place.cityId)}`, `state_id = ${p(place.stateId)}`);
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
  return { branch: await get(brandId, id), cityAdded: false };
}

/**
 * registration-and-profile §7: the brand's address IS its main branch. PATCH /brands/me with
 * any of address_line / pincode / state_id / city_id lands here. Creates the main branch when
 * the brand somehow has none.
 */
async function setMainAddress(brandId, body) {
  const { rows } = await db.query(`SELECT id FROM brand_branches WHERE brand_id = $1 AND is_main LIMIT 1`, [brandId]);
  if (rows[0]) return update(brandId, rows[0].id, body);
  return create(brandId, { name: 'Main Branch', ...body, is_main: true });
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
  // registration-and-profile: the main branch is the address; the brand row's address_line /
  // pincode and the users row's city / state follow it. Coordinates are no longer written.
  await db.query(
    `UPDATE brands SET formatted_address = COALESCE($2, formatted_address), pincode = COALESCE($3, pincode), address_line = COALESCE($2, address_line)
      WHERE id = $1`, [brandId, m.formatted_address, m.pincode]);
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
async function ensureMainFromBrandRow(brandId, ids = null) {
  const { rows: n } = await db.query(`SELECT count(*)::int AS n FROM brand_branches WHERE brand_id = $1`, [brandId]);
  if (n[0].n > 0) return null;
  const { rows } = await db.query(
    `SELECT b.formatted_address, b.address_line, b.pincode, b.lat, b.lng, u.city, u.state
       FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`, [brandId]);
  const r = rows[0];
  if (!r) return null;
  // registration-and-profile: registration hands over the resolved ids directly.
  let stateId = ids && ids.stateId ? ids.stateId : (r.state ? await ref.findStateId(r.state) : null);
  let cityId = ids && ids.cityId ? ids.cityId : null;
  if (!cityId && r.city && String(r.city).trim()) {
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

module.exports = {
  MSG, list, get, count, cityNames, mainCity, create, update, setMainAddress, makeMain, remove, shape, ensureMainFromBrandRow,
  streetProblem, streetMessage, courierProblem, fullStreet, STREET_MIN, STREET_MAX, LANDMARK_MAX,
};
