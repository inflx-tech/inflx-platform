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

// Schedule window (mig 124, features/section-scheduling/): a shelf is served
// only while starts_at <= now() < ends_at; NULL = unbounded. Expired sections
// disappear silently (SECTION_SYSTEM_SPEC §4.1, founder decision #4). A
// scheduled-out override row no longer suppresses its global base row.
const SCHEDULE_WINDOW = `(starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at > now())`;

/**
 * Load enabled shelves for (screen, scopeType, scopeValue), merging layers:
 * global < vertical(/other scope) < CITY (P5, features/section-analytics-city/).
 * An upper row replaces a lower row with the same (shelf_key, category_key,
 * item_type) identity. City rows (scope_type='city', scope_value=lowercased
 * city) apply to that screen for followers in that city — previously the
 * schema allowed them but no follower call path could ever merge them.
 */
async function loadConfig(screen, scopeType = 'global', scopeValue = null, city = null) {
  const idOf = (r) => [r.shelf_key, r.category_key || '', r.item_type || ''].join('|');
  const mergeUp = (base, over) => {
    if (!over.length) return base;
    const overridden = new Set(over.map(idOf));
    return base
      .filter(r => !overridden.has(idOf(r)))
      .concat(over.filter(r => r.enabled))
      .sort((a, b) => a.position - b.position);
  };

  const { rows: globalRows } = await db.query(
    `SELECT * FROM section_config
      WHERE screen = $1 AND scope_type = 'global' AND enabled = true
        AND ${SCHEDULE_WINDOW}
      ORDER BY position ASC`,
    [screen]
  );
  let merged = globalRows;

  if (scopeType !== 'global' && scopeType !== 'city' && scopeValue) {
    const { rows: overrideRows } = await db.query(
      `SELECT * FROM section_config
        WHERE screen = $1 AND scope_type = $2 AND scope_value = $3
          AND ${SCHEDULE_WINDOW}
        ORDER BY position ASC`,
      [screen, scopeType, scopeValue]
    );
    merged = mergeUp(merged, overrideRows);
  }

  const cityVal = String((scopeType === 'city' ? scopeValue : city) || '').trim().toLowerCase();
  if (cityVal) {
    const { rows: cityRows } = await db.query(
      `SELECT * FROM section_config
        WHERE screen = $1 AND scope_type = 'city' AND LOWER(scope_value) = $2
          AND ${SCHEDULE_WINDOW}
        ORDER BY position ASC`,
      [screen, cityVal]
    );
    merged = mergeUp(merged, cityRows);
  }
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
          lat = null, lng = null, brandId = null } = opts;

  const [rows, followedIds, taxMaps] = await Promise.all([
    loadConfig(screen, scopeType, scopeValue, city),
    getFollowedIds(followerId),
    categoryTaxonomy.getMaps(),   // single source: tile → member businesses + labels
  ]);

  const creatorHandle = influencer?.instagram_handle || null;
  const sections = [];

  // (Collections feature removed 2026-06-23 — dead/dormant, 0 live placements.
  // A stray rule='collection' config row falls through to the rule lookup →
  // empty + logged; no special expansion.)
  for (const row of rows) {
    const cfg = { ...(row.config_json || {}) };
    // Honest timer (mig 124): admin enabled a countdown without a time →
    // the shelf's own ends_at drives it, so the timer dies WITH the section.
    if (row.ends_at && cfg.timer && typeof cfg.timer === 'object' && !cfg.timer.ends_at) {
      cfg.timer = { ...cfg.timer, ends_at: row.ends_at };
    }
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
    // banner (tap → Results re-runs the rule). Phase 2 (rule-controls program):
    // hide-when-empty — a banner whose rule matches NOTHING in this context is a
    // dead-end tap, so it is probed below (rule at limit 1) and dropped when dry.
    const isBannerGateway = row.rule === 'library_products' && cfg.presentation_type === 'banner';
    if (isBannerGateway && libUnresolved) continue; // deleted/hidden rule → permanent dead end

    const ctx = {
      // ── Standardized placement context (App Builder Phase 1) ──────────────
      // Every rule receives WHERE it is placed so it can self-filter: the same
      // section behaves differently by scope/world/business/viewer. Existing
      // rules ignore the fields they don't use.
      scope: screen,                                       // home | category | offers | creator_store | creator_category | business
      vertical: scopeType === 'vertical' ? scopeValue : (rowCategoryKey || null), // the world (food/fashion/…)
      brandId,                                             // set when rendering a business page → brand-scoped rules
      city,
      followerId,
      followedIds,                                         // viewer's followed creator ids
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
      brandId || null,                  // distinct cache per business page
      cfg.library_section_id || null,   // distinct cache per placed library section
      // round coords to ~100m so nearby followers share a cache entry
      lat != null ? Math.round(lat * 1000) / 1000 : null,
      lng != null ? Math.round(lng * 1000) / 1000 : null,
    ]);

    // Banner gateway: probe the rule at limit 1 under the section's own cache key
    // (it already carries brand/creator/city/coords context) — drop when nothing
    // matches HERE; emit the same shell shape as before when something does.
    if (isBannerGateway) {
      let probe = [];
      try {
        probe = await cache.getOrSet(`${key}:exists`, () => runRule(row.rule, { ...ctx, limit: 1 }));
      } catch (err) {
        console.error(`[sectionEngine] banner probe for shelf '${row.shelf_key}' failed:`, err.message);
        probe = []; // broken probe → hide the banner rather than dead-end the tap
      }
      if (!probe.length) continue;
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
        starts_at: row.starts_at || null,
        ends_at: row.ends_at || null,
        items: [],
      });
      continue;
    }

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

    // Phase 2 — rule-driven hero-tiles share the banner's hide-when-empty
    // semantics (their items COME from the rule; static frames keep rule='static'
    // + items in config.tiles and are never dropped here).
    if (row.rule === 'library_products' && cfg.presentation_type === 'hero_tiles' && !items.length) continue;

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
      starts_at: row.starts_at || null,
      ends_at: row.ends_at || null,
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
