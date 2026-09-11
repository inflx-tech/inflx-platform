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

async function unknownCityIds(ids) {
  const { byId } = await cityIndex();
  return (ids || []).filter(id => !byId.has(Number(id)));
}

module.exports = {
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
