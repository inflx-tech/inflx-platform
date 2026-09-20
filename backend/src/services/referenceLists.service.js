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

/**
 * States with their cities nested — the shape the state-then-city picker consumes.
 * { offered: true } — only the states and cities flagged is_offered (registration-and-profile
 * §1.4): the six southern states and their 146 district headquarters. Registration and the
 * profile pickers read this; matching, search and display keep reading the whole table.
 */
async function statesWithCities({ offered = false } = {}) {
  return cached(offered ? 'states:offered' : 'states', async () => {
    const where = offered ? 'WHERE is_offered' : '';
    const { rows: states } = await db.query(`SELECT id, name, sort FROM ref_states ${where} ORDER BY sort, name`);
    const { rows: cities } = await db.query(
      `SELECT id, state_id, name, sort FROM ref_cities ${where} ORDER BY sort, name`
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

// ── retire-google (19–20 Sep 2026): no Google service anywhere ───────────────
//
// A state is found by exact name, then through ref_state_aliases (kept for typed names from
// older bundles and the website). Cities are never added at runtime any more: the list is the
// fixed offered set (registration-and-profile §1.4). A phone's coordinates are turned into a
// city by picking the nearest offered city centre (migration 190) — this replaces Google
// reverse geocoding for the follower app's "current location" label and the feed's city.

async function findStateId(rawState) {
  const n = norm(rawState);
  if (!n) return null;
  const { rows } = await db.query(`SELECT id FROM ref_states WHERE lower(name) = $1`, [n]);
  if (rows[0]) return rows[0].id;
  const { rows: al } = await db.query(`SELECT state_id FROM ref_state_aliases WHERE alias_norm = $1`, [n]);
  return al[0] ? al[0].state_id : null;
}

/**
 * The nearest offered city to a coordinate, with the distance, or null when the point is
 * absurdly far from every offered city (more than maxKm, default 300) or the coordinates
 * are not numbers. { id, name, stateId, stateName, lat, lng, km }.
 */
async function nearestCity(lat, lng, { maxKm = 300 } = {}) {
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.state_id, s.name AS state_name, c.lat, c.lng,
            round(6371 * acos(least(1.0, cos(radians($1)) * cos(radians(c.lat)) * cos(radians(c.lng) - radians($2))
                                       + sin(radians($1)) * sin(radians(c.lat)))))::int AS km
       FROM ref_cities c JOIN ref_states s ON s.id = c.state_id
      WHERE c.is_offered AND c.lat IS NOT NULL AND c.lng IS NOT NULL
      ORDER BY km ASC, c.sort ASC LIMIT 1`, [la, ln]);
  const r = rows[0];
  if (!r || r.km > maxKm) return null;
  return { id: r.id, name: r.name, stateId: r.state_id, stateName: r.state_name, lat: Number(r.lat), lng: Number(r.lng), km: r.km };
}

/** The centre of a city typed by name (any state), or null. For addresses typed without a pin. */
async function cityCentreForName(name) {
  const n = norm(name);
  if (!n) return null;
  const { rows } = await db.query(`SELECT id, name, lat, lng FROM ref_cities WHERE name_norm = $1 AND lat IS NOT NULL ORDER BY is_offered DESC, id LIMIT 1`, [n]);
  return rows[0] ? { id: rows[0].id, name: rows[0].name, lat: Number(rows[0].lat), lng: Number(rows[0].lng) } : null;
}

/**
 * registration-and-profile: resolve a picked state_id + city_id pair to names, or null when
 * either is missing or the city is not in that state. The pair is what registration and the
 * profile now store — there is no longer any path that writes an unresolved city name.
 */
async function resolveStateCity(stateId, cityId) {
  const s = Number(stateId), c = Number(cityId);
  if (!Number.isInteger(s) || !Number.isInteger(c)) return null;
  const { rows } = await db.query(
    `SELECT c.id AS city_id, c.name AS city_name, s.id AS state_id, s.name AS state_name
       FROM ref_cities c JOIN ref_states s ON s.id = c.state_id WHERE c.id = $1 AND s.id = $2`, [c, s]);
  return rows[0] ? { cityId: rows[0].city_id, cityName: rows[0].city_name, stateId: rows[0].state_id, stateName: rows[0].state_name } : null;
}

/** The same, from typed names — one OTA generation of old phones still sends them. */
async function resolveStateCityNames(stateName, cityName) {
  const stateId = await findStateId(stateName);
  if (!stateId) return null;
  const { rows } = await db.query(`SELECT id FROM ref_cities WHERE state_id = $1 AND name_norm = lower(trim($2))`, [stateId, String(cityName || '')]);
  return rows[0] ? resolveStateCity(stateId, rows[0].id) : null;
}

async function unknownCityIds(ids) {
  const { byId } = await cityIndex();
  return (ids || []).filter(id => !byId.has(Number(id)));
}

module.exports = {
  findStateId, citiesByIds,
  nearestCity, cityCentreForName,
  resolveStateCity, resolveStateCityNames,
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
