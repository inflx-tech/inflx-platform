'use strict';

/**
 * categoryTaxonomy.service.js — THE single source of truth for the follower
 * category-tile → business-type linkage.
 * Contract: features/merch-engine-p25a-categories-one-brain ("categories: one brain").
 *
 * (Distinct from taxonomy.service.js, which is the drill-down LISTING engine —
 * category_nodes + facets for product listing. This module is the follower-app
 * DISCOVERY taxonomy: the top-level tiles and which brand.category values each contains.)
 *
 * Before this service the follower app had FIVE places defining "which business types
 * belong to a category" (sectionRules CATEGORY_MAP, follower.service CATEGORY_MAP,
 * listing SUPER_CATEGORIES, sectionEngine CATEGORY_LABELS, plus the admin table) — keyed
 * inconsistently, so editing a tile in admin moved some screens and not others. This
 * module makes the admin-managed `follower_categories` table the ONLY source; every
 * backend category filter reads from here.
 *
 * - Reads active tiles (cached 60s in-process; bust via clearCache() on admin write).
 * - normalizeBusinessType applies the locked fashion merge (fashion_walkin/online → fashion).
 * - TILE_KEY_ALIASES lets legacy keys still resolve during the transition (the mobile
 *   app still sends eat/shop/groom/travel until contract 2.5b; section_config seeds used
 *   dining/shopping). Removable once 2.5b ships the new keys end-to-end.
 * - A minimal hardcoded fallback (the 5 launch tiles) is used ONLY if the table read
 *   throws — never as a second source of truth, never an empty feed.
 */

const db = require('../config/db');

// Locked 2026-06-15: fashion_walkin + fashion_online collapse to a single `fashion`.
// Mirrors the schema-resolution alias in schema.service.js / listing.service.js.
const BUSINESS_TYPE_ALIASES = { fashion_walkin: 'fashion', fashion_online: 'fashion' };

// Transition-only: legacy tile keys → the 5 launch-tile keys. Keeps the Deals tab and
// any not-yet-updated caller working until contract 2.5b updates the mobile app.
const TILE_KEY_ALIASES = {
  eat: 'food', dining: 'food',
  shop: 'fashion', shopping: 'fashion',
  groom: 'beauty',
  travel: 'car_rental', booking: 'car_rental',
};

// Minimal fallback = the 5 launch tiles. ONLY used if follower_categories is unreachable.
const FALLBACK_TILES = [
  { key: 'fashion',    label: 'Fashion',     icon: '👗', members: ['fashion'] },
  { key: 'furniture',  label: 'Furniture',   icon: '🛋️', members: ['furniture'] },
  { key: 'food',       label: 'Food',        icon: '🍽️', members: ['restaurant'] },
  { key: 'beauty',     label: 'Beauty',      icon: '✨', members: ['salon'] },
  { key: 'car_rental', label: 'Car Rentals', icon: '🚗', members: ['car_rental'] },
];

const TTL_MS = 60000;
let cache = null; // { tiles, membersByKey, labelsByKey, tileByType, at }

function normalizeBusinessType(bt) {
  if (!bt) return bt;
  const k = String(bt).toLowerCase().trim();
  return BUSINESS_TYPE_ALIASES[k] || k;
}

function resolveTileKey(key) {
  const k = String(key == null ? '' : key).toLowerCase().trim();
  return TILE_KEY_ALIASES[k] || k;
}

// Build the lookup maps from raw tiles, normalising member business types and adding
// alias keys so callers can use either a new or a legacy key transparently.
function shape(tiles) {
  const membersByKey = {};
  const labelsByKey = {};
  const tileByType = {};
  for (const t of tiles) {
    const members = Array.from(
      new Set((t.members || []).map(normalizeBusinessType).filter(Boolean))
    );
    membersByKey[t.key] = members;
    labelsByKey[t.key] = t.label;
    for (const m of members) if (!tileByType[m]) tileByType[m] = t.key;
  }
  // Mirror legacy keys onto their real tile so old callers keep resolving.
  for (const [legacy, real] of Object.entries(TILE_KEY_ALIASES)) {
    if (membersByKey[real] && !membersByKey[legacy]) {
      membersByKey[legacy] = membersByKey[real];
      labelsByKey[legacy] = labelsByKey[real];
    }
  }
  return { tiles, membersByKey, labelsByKey, tileByType };
}

async function load() {
  try {
    const { rows } = await db.query(
      `SELECT key, label, icon, sort_order, member_categories
         FROM follower_categories
        WHERE status = 'active'
        ORDER BY sort_order ASC, label ASC`
    );
    if (rows.length) {
      const tiles = rows.map(r => ({
        key: r.key, label: r.label, icon: r.icon,
        members: Array.isArray(r.member_categories) ? r.member_categories : [],
      }));
      return shape(tiles);
    }
  } catch (e) {
    console.error('[categoryTaxonomy] follower_categories read failed — fallback tiles:', e.message);
  }
  return shape(FALLBACK_TILES);
}

async function get() {
  const now = Date.now();
  if (cache && (now - cache.at) < TTL_MS) return cache;
  const data = await load();
  cache = { ...data, at: now };
  return cache;
}

// ── public read API ──────────────────────────────────────────────────────────
async function getMaps() { return get(); }
async function getTiles() { return (await get()).tiles; }
async function getMembersMap() { return (await get()).membersByKey; }
async function membersFor(key) { return (await get()).membersByKey[resolveTileKey(key)] || []; }
async function tileForBusinessType(bt) {
  return (await get()).tileByType[normalizeBusinessType(bt)] || null;
}
async function labelFor(key) { return (await get()).labelsByKey[resolveTileKey(key)] || null; }

// Sync read of the warm cache — for in-SQL rule builders that cannot await. The section
// engine warms the cache (await getMaps()) before any rule runs, so this is populated.
// Returns null if the cache is cold (caller treats null as "no category filter").
function membersForSync(key) {
  return (cache && cache.membersByKey[resolveTileKey(key)]) || null;
}

function clearCache() { cache = null; }

module.exports = {
  normalizeBusinessType,
  resolveTileKey,
  getMaps,
  getTiles,
  getMembersMap,
  membersFor,
  membersForSync,
  tileForBusinessType,
  labelFor,
  clearCache,
  BUSINESS_TYPE_ALIASES,
  TILE_KEY_ALIASES,
};
