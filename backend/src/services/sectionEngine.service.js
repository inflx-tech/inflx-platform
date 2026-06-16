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
const categoryTaxonomy = require('./categoryTaxonomy.service');
const sectionLibrary = require('./sectionLibrary.service');
const collectionLibrary = require('./collectionLibrary.service');

// Last-resort labels for {category} interpolation if a key isn't in the taxonomy
// (e.g. a legacy section_config key during transition). The tile's real label from
// categoryTaxonomy is preferred — passed in as categoryLabel.
const CATEGORY_LABELS = {
  dining: 'Eat', shopping: 'Shop', groom: 'Groom', stay_fit: 'Stay Fit',
  travel: 'Travel', home: 'Home', events: 'Events', booking: 'Book',
};

function interpolate(title, { city, categoryKey, categoryLabel, creatorHandle }) {
  const catLabel = categoryLabel || (categoryKey && CATEGORY_LABELS[categoryKey]) || categoryKey || 'Category';
  return (title || '')
    .replace(/\{city\}/g, city || 'your city')
    .replace(/\{category\}/g, catLabel)
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

  const [rows, followedIds, taxMaps] = await Promise.all([
    loadConfig(screen, scopeType, scopeValue),
    getFollowedIds(followerId),
    categoryTaxonomy.getMaps(),   // single source: tile → member businesses + labels
  ]);

  const creatorHandle = influencer?.instagram_handle || null;
  const sections = [];

  // Collections (Phase 4a): expand a `rule='collection'` placement into a
  // collection_header row + one synthetic library_products row per member section,
  // tagged with a group id. The normal loop then renders each (members reuse the
  // Phase-3 evaluator + context). Unresolved/empty collection → nothing.
  const expandedRows = [];
  for (const row of rows) {
    if (row.rule === 'collection' && (row.config_json || {}).collection_id) {
      const ccfg = row.config_json || {};
      let coll = null;
      try { coll = await collectionLibrary.getForRender(ccfg.collection_id); }
      catch (e) { console.error('[sectionEngine] collection render failed:', e.message); }
      if (coll && coll.sections.length) {
        // Phase 6 — Hero+Tiles (C): render the collection as ONE hero block whose
        // tiles are its member sections (each tile taps through to Results running
        // that member's rule), instead of the inline header + member rows.
        if (ccfg.presentation_type === 'hero_tiles') {
          const hero = ccfg.hero || {};
          expandedRows.push({
            ...row, shelf_type: 'hero_tiles', rule: 'static', item_type: null, category_key: null,
            title: hero.title || coll.name,
            config_json: {
              ...ccfg,
              hero: { title: hero.title || coll.name, eyebrow: hero.eyebrow || null, image_url: hero.image_url || coll.image_url || null },
              tiles: coll.sections.map(s => ({ library_section_id: s.id, label: s.name, image_url: s.image_url || null })),
            },
          });
          continue;
        }
        const grp = row.shelf_key;
        expandedRows.push({
          ...row, shelf_key: `${row.shelf_key}__hdr`, shelf_type: 'collection_header',
          rule: 'static', item_type: null, category_key: null, title: coll.name,
          config_json: { collection_header: true, image_url: coll.image_url }, _collGroup: grp,
        });
        coll.sections.forEach((sec, i) => expandedRows.push({
          ...row, id: null, shelf_key: `${row.shelf_key}__m${i}`, shelf_type: 'products',
          item_type: 'products', rule: 'library_products', category_key: null, title: sec.name,
          config_json: { library_section_id: sec.id }, _collGroup: grp,
        }));
      }
      continue; // unresolved/empty → emit nothing
    }
    expandedRows.push(row);
  }

  for (const row of expandedRows) {
    const cfg = row.config_json || {};
    let rowCategoryKey = row.category_key || categoryKey || null;
    let categoryCats = rowCategoryKey ? (taxMaps.membersByKey[rowCategoryKey] || null) : null;
    let ruleDef = null;
    let libResolved = false;

    // Data-driven section (Phase 3a): resolve the placed library section's rule.
    // The section's OWN business_type sets the category members (the surface's
    // creator/brand/city stack on top inside the rule). 'ALL' = no business filter.
    if (row.rule === 'library_products' && cfg.library_section_id) {
      const lib = await sectionLibrary.getRuleJson(cfg.library_section_id);
      if (lib) {
        libResolved = true;
        ruleDef = lib.rule || {};
        if (lib.business_type && lib.business_type !== 'ALL') {
          rowCategoryKey = lib.business_type;
          categoryCats = taxMaps.membersByKey[lib.business_type] || null;
        } else {
          categoryCats = null;
        }
      }
    }
    // Safety (3c): an unresolved library placement (no/hidden/deleted section) must
    // NOT fall through to "all gated products" — render it empty instead.
    const libUnresolved = row.rule === 'library_products' && !libResolved;

    // Phase 6 — Banner-Gateway (B): a library section placement shown as a tappable
    // banner. It is a GATEWAY (tap → Results re-runs the rule), so we do NOT pre-run
    // the rule here; emit always so the marketing banner shows regardless of matches.
    if (row.rule === 'library_products' && cfg.presentation_type === 'banner' && libResolved) {
      sections.push({
        key: sectionKey(row),
        shelf_key: row.shelf_key,
        title: interpolate(row.title, {
          city, categoryKey: rowCategoryKey,
          categoryLabel: rowCategoryKey ? taxMaps.labelsByKey[rowCategoryKey] : null,
          creatorHandle,
        }),
        type: 'banner_gateway',
        item_type: row.item_type || null,
        rule: row.rule,
        config: cfg,
        items: [],
      });
      continue;
    }

    const ctx = {
      city,
      followerId,
      followedIds,
      categoryKey: rowCategoryKey,
      // admin-linked member businesses for this key, from the single taxonomy source
      categoryCats,
      ruleDef,                       // data-driven rule definition (library_products)
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
      cfg.library_section_id || null,   // distinct cache per placed library section
      // round coords to ~100m so nearby followers share a cache entry
      lat != null ? Math.round(lat * 1000) / 1000 : null,
      lng != null ? Math.round(lng * 1000) / 1000 : null,
    ]);

    let items = [];
    if (libUnresolved) {
      items = []; // unresolved library placement → empty (never the whole catalogue)
    } else {
      try {
        items = await cache.getOrSet(key, () => runRule(row.rule, ctx));
      } catch (err) {
        console.error(`[sectionEngine] rule '${row.rule}' for shelf '${row.shelf_key}' failed:`, err.message);
        items = []; // graceful — a broken shelf never 500s the feed
      }
    }

    sections.push({
      key: sectionKey(row),
      shelf_key: row.shelf_key,
      title: interpolate(row.title, {
        city, categoryKey: ctx.categoryKey,
        categoryLabel: ctx.categoryKey ? taxMaps.labelsByKey[ctx.categoryKey] : null,
        creatorHandle,
      }),
      type: row.shelf_type,
      item_type: row.item_type || null,
      rule: row.rule,
      config: cfg,
      items,
      _collGroup: row._collGroup || null,   // internal: collection grouping (stripped below)
    });
  }

  // Collections post-pass: drop a collection_header whose members all rendered
  // empty (no empty titled band). Then strip the internal grouping marker.
  const groupHasItems = {};
  for (const s of sections) {
    if (s._collGroup && s.type !== 'collection_header' && Array.isArray(s.items) && s.items.length) {
      groupHasItems[s._collGroup] = true;
    }
  }
  const out = sections.filter(s =>
    !(s.type === 'collection_header' && s._collGroup && !groupHasItems[s._collGroup]));
  out.forEach(s => { delete s._collGroup; });

  return { sections: out };
}

module.exports = {
  buildSections,
  loadConfig,
  resolveInfluencerByHandle,
  getFollowedIds,
  interpolate,
  sectionKey,
};
