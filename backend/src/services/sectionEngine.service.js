'use strict';

/**
 * sectionEngine.service.js — resolve a screen's section_config into a rendered
 * { sections: [...] } payload.
 *
 *   load config for (screen, scope) → global base + city/vertical overrides
 *   → for each ENABLED shelf in position order, run its rule
 *   → interpolate the title, attach items (already 4-ID-tracked by the rule)
 *   → assemble { sections }.
 *
 * Phase A seeds GLOBAL scope only; the override-merge is implemented so Phase B
 * can author city/vertical rows without an engine change. Results are memoized
 * per (shelf, scope, params) via ttlCache (in-process; Redis-swappable — see
 * utils/ttlCache.js for why Redis is not used yet).
 */

const db = require('../config/db');
const { runRule } = require('./sectionRules.service');
const cache = require('../utils/ttlCache');

const CATEGORY_LABELS = {
  dining: 'Eat', shopping: 'Shop', groom: 'Groom', stay_fit: 'Stay Fit',
  travel: 'Travel', home: 'Home', events: 'Events', booking: 'Book',
};

function interpolate(title, { city, categoryKey, creatorHandle }) {
  return (title || '')
    .replace(/\{city\}/g, city || 'your city')
    .replace(/\{category\}/g, (categoryKey && CATEGORY_LABELS[categoryKey]) || categoryKey || 'Category')
    .replace(/\{creator\}/g, creatorHandle ? `@${creatorHandle}` : 'Creator');
}

// Unique section key for repeatable rails (top_in / category rails differ by
// category_key + item_type); plain shelves keep their shelf_key.
function sectionKey(row) {
  if (row.category_key || (row.item_type && row.shelf_key === 'top_in')) {
    return [row.shelf_key, row.category_key, row.item_type].filter(Boolean).join(':');
  }
  return row.shelf_key;
}

/**
 * Load enabled shelves for (screen, scopeType, scopeValue), merging global base
 * with a city/vertical override layer. An override row replaces a global row
 * with the same (shelf_key, category_key, item_type) identity.
 */
async function loadConfig(screen, scopeType = 'global', scopeValue = null) {
  const { rows: globalRows } = await db.query(
    `SELECT * FROM section_config
      WHERE screen = $1 AND scope_type = 'global' AND enabled = true
      ORDER BY position ASC`,
    [screen]
  );
  if (scopeType === 'global' || !scopeValue) return globalRows;

  const { rows: overrideRows } = await db.query(
    `SELECT * FROM section_config
      WHERE screen = $1 AND scope_type = $2 AND scope_value = $3
      ORDER BY position ASC`,
    [screen, scopeType, scopeValue]
  );
  if (!overrideRows.length) return globalRows;

  const idOf = (r) => [r.shelf_key, r.category_key || '', r.item_type || ''].join('|');
  const overridden = new Set(overrideRows.map(idOf));
  const merged = globalRows
    .filter(r => !overridden.has(idOf(r)))
    .concat(overrideRows.filter(r => r.enabled))
    .sort((a, b) => a.position - b.position);
  return merged;
}

// Admin-managed category → member-business linkage (follower_categories.
// member_categories). Loaded once per buildSections and injected into each
// rule's ctx as categoryCats so the listing rules filter by what the admin
// actually linked, not the legacy hardcoded CATEGORY_MAP (whose keys don't even
// match the table keys). Empty/failed read → {} → rules fall back to CATEGORY_MAP.
async function loadCategoryMembers() {
  try {
    const { rows } = await db.query(
      `SELECT key, member_categories FROM follower_categories`
    );
    const map = {};
    for (const r of rows) {
      if (Array.isArray(r.member_categories) && r.member_categories.length) {
        map[r.key] = r.member_categories;
      }
    }
    return map;
  } catch (e) {
    console.error('[sectionEngine] follower_categories members read failed — CATEGORY_MAP fallback:', e.message);
    return {};
  }
}

async function getFollowedIds(followerId) {
  if (!followerId) return new Set();
  const { rows } = await db.query(
    `SELECT influencer_id FROM follower_follows WHERE follower_id = $1`,
    [followerId]
  );
  return new Set(rows.map(r => r.influencer_id));
}

async function resolveInfluencerByHandle(handle) {
  if (!handle) return null;
  const { rows } = await db.query(
    `SELECT i.id, i.instagram_handle, i.followers_count, i.profile_image_url,
            u.name
       FROM influencers i JOIN users u ON u.id = i.user_id
      WHERE LOWER(i.instagram_handle) = LOWER($1)
      LIMIT 1`,
    [handle]
  );
  return rows[0] || null;
}

/**
 * Build the { sections } payload for a screen.
 * @param {object} opts
 *  - screen, scopeType, scopeValue
 *  - city, followerId, categoryKey, influencer
 */
async function buildSections(opts) {
  const { screen, scopeType = 'global', scopeValue = null,
          city = null, followerId = null, categoryKey = null, influencer = null,
          lat = null, lng = null } = opts;

  const [rows, followedIds, catMembers] = await Promise.all([
    loadConfig(screen, scopeType, scopeValue),
    getFollowedIds(followerId),
    loadCategoryMembers(),
  ]);

  const creatorHandle = influencer?.instagram_handle || null;
  const sections = [];

  for (const row of rows) {
    const cfg = row.config_json || {};
    const rowCategoryKey = row.category_key || categoryKey || null;
    const ctx = {
      city,
      followerId,
      followedIds,
      categoryKey: rowCategoryKey,
      // admin-linked member businesses for this key (null → rules fall back to CATEGORY_MAP)
      categoryCats: rowCategoryKey ? (catMembers[rowCategoryKey] || null) : null,
      influencer,
      itemType: row.item_type || null,
      limit: row.item_limit || 8,
      windowDays: cfg.window_days || 7,
      config: cfg,
      lat, lng,   // follower coords → distance ranking (listing rules)
    };

    // Personalized rules (depend on this follower's graph / the creator) must
    // not share a cache entry across followers — key includes those.
    const key = JSON.stringify([
      screen, scopeType, scopeValue, sectionKey(row), row.rule, ctx.itemType,
      ctx.categoryKey, ctx.limit, city, followerId, influencer?.id || null,
      // round coords to ~100m so nearby followers share a cache entry
      lat != null ? Math.round(lat * 1000) / 1000 : null,
      lng != null ? Math.round(lng * 1000) / 1000 : null,
    ]);

    let items = [];
    try {
      items = await cache.getOrSet(key, () => runRule(row.rule, ctx));
    } catch (err) {
      console.error(`[sectionEngine] rule '${row.rule}' for shelf '${row.shelf_key}' failed:`, err.message);
      items = []; // graceful — a broken shelf never 500s the feed
    }

    sections.push({
      key: sectionKey(row),
      shelf_key: row.shelf_key,
      title: interpolate(row.title, { city, categoryKey: ctx.categoryKey, creatorHandle }),
      type: row.shelf_type,
      item_type: row.item_type || null,
      rule: row.rule,
      config: cfg,
      items,
    });
  }

  return { sections };
}

module.exports = {
  buildSections,
  loadConfig,
  resolveInfluencerByHandle,
  getFollowedIds,
  interpolate,
  sectionKey,
};
