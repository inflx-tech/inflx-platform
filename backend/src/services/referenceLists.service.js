'use strict';

/**
 * referenceLists.service.js — the lists a setting can point at.
 * Contract: features/item2-pitch-invitation-settings · rules v1.10 §8A (D4, A8)
 *
 * Four lists, one place: creator niches, languages, the eight fashion sub-categories,
 * and states → cities. Everything here is read on every pitch, invite and profile
 * view, and changes rarely, so it is cached briefly in process — the same pattern as
 * handshakeSettings.service. An admin edit is felt within a minute.
 *
 * City matching by NAME is deliberate and temporary. Branch cities and the creator's
 * profile city are still typed free-hand (item 3 switches both to the picker), so in
 * item 2 the typed value is matched against ref_cities.name_norm. A typed city that is
 * not on the list simply resolves to nothing — it is shown as "Not set" and fails a
 * city filter, exactly as the founder chose (Q6b/c).
 */

const db = require('../config/db');
const places = require('./places.service');

const CACHE_MS = 60_000;
const cache = new Map();   // key -> { at, value }

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function invalidate() { cache.clear(); }

// ── The lists ────────────────────────────────────────────────────────────────

async function creatorNiches() {
  return cached('niches', async () => {
    const { rows } = await db.query(
      `SELECT code, label, sort FROM ref_creator_niches WHERE active ORDER BY sort, label`
    );
    return rows;
  });
}

async function languages() {
  return cached('languages', async () => {
    const { rows } = await db.query(
      `SELECT code, label, sort FROM ref_languages WHERE active ORDER BY sort, label`
    );
    return rows;
  });
}

async function brandCategories() {
  return cached('brandCategories', async () => {
    const { rows } = await db.query(
      `SELECT code, label, sort FROM ref_brand_categories ORDER BY sort, label`
    );
    return rows;
  });
}

/** States with their cities nested — the shape the state-then-city picker consumes. */
async function statesWithCities() {
  return cached('states', async () => {
    const { rows: states } = await db.query(`SELECT id, name, sort FROM ref_states ORDER BY sort, name`);
    const { rows: cities } = await db.query(
      `SELECT id, state_id, name, sort FROM ref_cities ORDER BY sort, name`
    );
    const byState = new Map(states.map(s => [s.id, { ...s, cities: [] }]));
    for (const c of cities) {
      const s = byState.get(c.state_id);
      if (s) s.cities.push({ id: c.id, name: c.name, sort: c.sort });
    }
    return [...byState.values()];
  });
}

/** Flat city lookup: id -> { id, name, state_id, state_name }. */
async function cityIndex() {
  return cached('cityIndex', async () => {
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.name_norm, c.state_id, s.name AS state_name
         FROM ref_cities c JOIN ref_states s ON s.id = c.state_id`
    );
    const byId = new Map();
    const byNorm = new Map();
    for (const r of rows) {
      byId.set(r.id, r);
      // First match wins on a duplicate name across states (none in the seed; if one
      // appears later the picker still disambiguates because it stores ids).
      if (!byNorm.has(r.name_norm)) byNorm.set(r.name_norm, r);
    }
    return { byId, byNorm };
  });
}

// ── Helpers the settings and eligibility code lean on ────────────────────────

const norm = (s) => String(s || '').trim().toLowerCase();

/** The canonical city id for a typed city name, or null when it is not on the list. */
async function cityIdForName(name) {
  if (!name) return null;
  const { byNorm } = await cityIndex();
  const hit = byNorm.get(norm(name));
  return hit ? hit.id : null;
}

/** Map a list of typed names to the ids that match (unmatched names are dropped). */
async function cityIdsForNames(names) {
  const { byNorm } = await cityIndex();
  const out = new Set();
  for (const n of names || []) {
    const hit = byNorm.get(norm(n));
    if (hit) out.add(hit.id);
  }
  return [...out];
}

/** "N cities in M states" needs the state of each chosen city. */
async function describeCityIds(ids) {
  const { byId } = await cityIndex();
  const states = new Set();
  let cities = 0;
  for (const id of ids || []) {
    const c = byId.get(Number(id));
    if (c) { cities += 1; states.add(c.state_id); }
  }
  return { cities, states: states.size };
}

/** Return the subset of `codes` that are NOT on the given list (empty = all valid). */
function unknownCodes(codes, list) {
  const known = new Set(list.map(x => x.code));
  return (codes || []).filter(c => !known.has(c));
}

/** Cities by id with their state, for label lookups (reference/cities?ids=). */
async function citiesByIds(ids) {
  const { byId } = await cityIndex();
  const out = [];
  for (const id of ids || []) {
    const c = byId.get(Number(id));
    if (c) out.push({ id: c.id, name: c.name, stateId: c.state_id, stateName: c.state_name });
  }
  return out;
}

// ── Item 3: Google place → canonical state + city, adding the CITY when new ──
//
// States are never added (founder Q9). A state is found by exact name, then through
// ref_state_aliases (Google spellings such as "NCT of Delhi"). A city is found by its
// normalised name inside that state; when absent it is INSERTED with source='google'
// under UNIQUE (state_id, name_norm), so two users adding the same city at the same
// moment end with one row and only the first is told "new on INFLX".

const STATE_UNKNOWN = 'STATE_UNKNOWN';
const PLACE_NOT_FOUND = 'PLACE_NOT_FOUND';
const resolveCache = new Map();          // place_id -> { at, value }   (10 minutes, founder decision 7)
const RESOLVE_CACHE_MS = 10 * 60_000;
const rateBuckets = new Map();           // userId -> [timestamps]     (60 per minute per user)

function rateLimited(userId) {
  if (!userId) return false;
  const now = Date.now();
  const arr = (rateBuckets.get(userId) || []).filter(t => now - t < 60_000);
  arr.push(now);
  rateBuckets.set(userId, arr);
  return arr.length > 60;
}

async function findStateId(rawState) {
  const n = norm(rawState);
  if (!n) return null;
  const { rows } = await db.query(`SELECT id FROM ref_states WHERE lower(name) = $1`, [n]);
  if (rows[0]) return rows[0].id;
  const { rows: al } = await db.query(`SELECT state_id FROM ref_state_aliases WHERE alias_norm = $1`, [n]);
  return al[0] ? al[0].state_id : null;
}

/** Find-or-add a city in a state. Returns { id, name, added }. */
async function findOrAddCity(stateId, rawCity) {
  const n = norm(rawCity);
  if (!n) return null;
  const { rows } = await db.query(`SELECT id, name FROM ref_cities WHERE state_id = $1 AND name_norm = $2`, [stateId, n]);
  if (rows[0]) return { id: rows[0].id, name: rows[0].name, added: false };
  const display = String(rawCity).trim();
  const { rows: ins } = await db.query(
    `INSERT INTO ref_cities (state_id, name, name_norm, sort, source)
     VALUES ($1, $2, $3, 999, 'google')
     ON CONFLICT (state_id, name_norm) DO NOTHING
     RETURNING id, name`,
    [stateId, display, n]
  );
  invalidate();
  if (ins[0]) return { id: ins[0].id, name: ins[0].name, added: true };
  const { rows: again } = await db.query(`SELECT id, name FROM ref_cities WHERE state_id = $1 AND name_norm = $2`, [stateId, n]);
  return again[0] ? { id: again[0].id, name: again[0].name, added: false } : null;
}

/**
 * Resolve a Google place id into an address the platform can store.
 * @returns {{ placeId, formattedAddress, pincode, lat, lng, state:{id,name}, city:{id,name,added} }}
 * @throws Error with .code = PLACE_NOT_FOUND | STATE_UNKNOWN | RATE_LIMITED
 */
async function resolvePlace(placeId, { session, userId } = {}) {
  if (!placeId) { const e = new Error('place_id is required'); e.code = PLACE_NOT_FOUND; throw e; }
  if (rateLimited(userId)) { const e = new Error('Too many address lookups. Try again in a minute.'); e.code = 'RATE_LIMITED'; throw e; }
  const hit = resolveCache.get(placeId);
  let d = hit && Date.now() - hit.at < RESOLVE_CACHE_MS ? hit.value : null;
  if (!d) {
    d = await places.details(placeId, { sessiontoken: session });
    if (!d) { const e = new Error('place not found'); e.code = PLACE_NOT_FOUND; throw e; }
    resolveCache.set(placeId, { at: Date.now(), value: d });
  }
  const stateId = await findStateId(d.state);
  if (!stateId) {
    await db.query(`INSERT INTO ref_unknown_states (raw_state, raw_city, place_id, user_id) VALUES ($1,$2,$3,$4)`,
      [d.state || null, d.city || null, placeId, userId || null]).catch(() => {});
    console.warn('[places] STATE_UNKNOWN', JSON.stringify({ state: d.state, city: d.city, placeId }));
    const e = new Error("We couldn't match this address to a state. Try a nearby address."); e.code = STATE_UNKNOWN; throw e;
  }
  const { rows: st } = await db.query(`SELECT id, name FROM ref_states WHERE id = $1`, [stateId]);
  // Google's locality is the city; when absent fall back to the area name so a village
  // address still lands somewhere sensible (the founder can review source=google rows).
  const city = await findOrAddCity(stateId, d.city || d.area_name);
  return {
    placeId,
    formattedAddress: d.formatted_address || null,
    pincode: d.pincode || null,
    lat: d.lat == null ? null : d.lat,
    lng: d.lng == null ? null : d.lng,
    state: { id: st[0].id, name: st[0].name },
    city: city ? { id: city.id, name: city.name, added: city.added } : null,
  };
}

/** Test seam: forget cached place details and rate buckets. */
function resetResolveState() { resolveCache.clear(); rateBuckets.clear(); }

async function unknownCityIds(ids) {
  const { byId } = await cityIndex();
  return (ids || []).filter(id => !byId.has(Number(id)));
}

module.exports = {
  STATE_UNKNOWN, PLACE_NOT_FOUND,
  resolvePlace, findOrAddCity, findStateId, citiesByIds, resetResolveState,
  creatorNiches,
  languages,
  brandCategories,
  statesWithCities,
  cityIndex,
  cityIdForName,
  cityIdsForNames,
  describeCityIds,
  unknownCodes,
  unknownCityIds,
  invalidate,
};
