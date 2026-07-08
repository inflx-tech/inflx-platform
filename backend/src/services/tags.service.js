'use strict';

/**
 * tags.service.js — Phase 1a (contract: merch-engine-p1a-product-tags).
 *
 * Product tags are stored as normalized slugs on brand_products.tags (text[]).
 * Two kinds, stored identically: FIXED tags (the brand picked from the admin
 * tag_vocabulary) and FREE tags (the brand typed its own). The vocabulary is a
 * curation tool that governs what the listing picker OFFERS and what admin
 * Collections rule on — the legacy flat flow does NOT hard-gate what a product
 * may carry (free tags allowed there).
 *
 * DRILL-DOWN flow is CURATED-ONLY (founder, 2026-07-08, contract
 * listing-tags-at-add): stores pick only admin's world tags — store-typed
 * names differ per store and read as noise. Enforced via curatedProductTags().
 * Scoping is WORLD-aware: fashion's three category keys share one 'fashion'
 * tag pool.
 *
 * Tags ORGANIZE only; they never make a product visible (Phase 2 push/allocation
 * gate governs visibility).
 */

const db = require('../config/db');

const MAX_TAGS = 25;
const MAX_LEN = 40;

// Normalize any raw tag (label or slug) → a safe lowercase slug.
function slugify(raw) {
  return String(raw == null ? '' : raw)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')                       // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '')                           // trim hyphens
    .slice(0, MAX_LEN);
}

// Clean a raw tags array (mix of fixed + free) into unique, capped slugs.
// Non-array → []. Empty is valid (tags are optional).
function sanitizeProductTags(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const t of input) {
    const s = slugify(t);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

// World key for tag scoping — category keys in the same world share one tag
// pool (fashion / fashion_walkin / fashion_online → 'fashion').
function tagWorldOf(category) {
  const c = String(category || '');
  if (c.startsWith('fashion')) return 'fashion';
  return c;
}

// Active fixed tags offered to a brand of the given business category:
// its own scope + its world scope + the cross-business 'ALL' scope
// (own/world-scope tags first).
async function listTagOptions(category) {
  const scopes = [...new Set([category || '', tagWorldOf(category)])];
  const { rows } = await db.query(
    `SELECT id, scope, label, slug, sort_order
       FROM tag_vocabulary
      WHERE status = 'active' AND (scope = ANY($1) OR scope = 'ALL')
      ORDER BY (scope = 'ALL') ASC, sort_order ASC, label ASC`,
    [scopes]
  );
  return rows;
}

// Curated-only cleaner (drill-down flow): sanitize, then keep ONLY slugs that
// exist in the brand's active vocabulary (own + world + ALL scopes). Unknown /
// free tags are dropped silently — tags are optional organizers.
async function curatedProductTags(category, input) {
  const slugs = sanitizeProductTags(input);
  if (!slugs.length) return [];
  const allowed = new Set((await listTagOptions(category)).map((r) => r.slug));
  return slugs.filter((s) => allowed.has(s));
}

module.exports = { slugify, sanitizeProductTags, listTagOptions, curatedProductTags, tagWorldOf, MAX_TAGS, MAX_LEN };
