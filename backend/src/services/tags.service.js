'use strict';

/**
 * tags.service.js — Phase 1a (contract: merch-engine-p1a-product-tags).
 *
 * Product tags are stored as normalized slugs on brand_products.tags (text[]).
 * Two kinds, stored identically: FIXED tags (the brand picked from the admin
 * tag_vocabulary) and FREE tags (the brand typed its own). The vocabulary is a
 * curation tool that governs what the listing picker OFFERS and what admin
 * Collections rule on — it does NOT hard-gate what a product may carry, because
 * brands are explicitly allowed to add their own free tags.
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

// Active fixed tags offered to a brand of the given business category:
// its own scope + the cross-business 'ALL' scope (own-scope tags first).
async function listTagOptions(category) {
  const { rows } = await db.query(
    `SELECT id, scope, label, slug, sort_order
       FROM tag_vocabulary
      WHERE status = 'active' AND scope IN ($1, 'ALL')
      ORDER BY (scope = 'ALL') ASC, sort_order ASC, label ASC`,
    [category || '']
  );
  return rows;
}

module.exports = { slugify, sanitizeProductTags, listTagOptions, MAX_TAGS, MAX_LEN };
