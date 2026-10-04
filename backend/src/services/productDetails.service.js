'use strict';

/**
 * productDetails.service.js — what the brand entered when listing a product, as a SHOPPER reads it.
 * Contract: features/shopper-walk-fixes · 01-spec.md O3, W5, W6 · board S3, S4
 *
 * The founder (3 Oct 2026): "all details which provided while listing is missed… make them clear in
 * order and logical manner". Until now a shopper was sent the description and nothing else; the
 * listing's own details (brand, fit, neck, sleeve, material, care…) sit in brand_products.facets and
 * never left the server.
 *
 * One fixed order (W6), skipping whatever the listing left empty:
 *   Brand · Category · Fit · Neck · Sleeve · Material · Pattern · Occasion · Care · every other
 *   detail in the listing form's own order · (then, on the page) Description · Returns.
 * Nothing is invented (W5): no rating, no review count, no tax line. Colour and size are not
 * repeated here — the page shows them as choices.
 *
 * The names of the details ("Fabric / Material") come from the listing form's own definitions
 * (facet_definitions), so the shopper reads the same word the brand filled in.
 */

const db = require('../config/db');

// Shown as choices or as their own line on the page — never as a row of the details list.
const NOT_A_ROW = new Set(['size', 'color_tone', 'color', 'colour', 'images', 'price', 'brand']);
// The details a shopper looks for first, in this order (W6). Everything else follows in the
// listing form's own order.
const FIRST = ['fit', 'neck', 'sleeve', 'fabric_material', 'material', 'pattern_print', 'occasion', 'care'];

const CACHE_MS = 5 * 60 * 1000;
let cache = null;       // { at, defs: Map<key, { label, sort }> }

/** key → { label, sort } from the listing form's definitions. Never throws: a details list without names still reads. */
async function definitions(conn = db) {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.defs;
  const defs = new Map();
  try {
    const { rows } = await conn.query(
      `SELECT facet_key, min(label) AS label, min(sort_order) AS sort FROM facet_definitions GROUP BY facet_key`);
    for (const r of rows) defs.set(r.facet_key, { label: r.label, sort: Number(r.sort) || 0 });
  } catch (_) { /* the table is absent on an old database: the keys are shown in plain words instead */ }
  cache = { at: Date.now(), defs };
  return defs;
}

function asObj(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

/** "fabric_material" → "Fabric material" — only for a detail the listing form has no name for. */
const plain = (key) => { const s = String(key).replace(/_/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

/** A detail's value as words: lists joined, true/false as Yes/No, blanks dropped. */
function wordsOf(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) { const xs = v.map(wordsOf).filter(Boolean); return xs.length ? xs.join(', ') : null; }
  if (typeof v === 'object') return null;
  const s = String(v).trim();
  return s || null;
}

/** The brand name the listing carries (e.g. "Park Avenue"), or null. */
function brandLabelOf(product) {
  const f = asObj(product && product.facets);
  return f ? wordsOf(f.brand) : null;
}

/**
 * The details list of one product: [{ key, label, value }], in the fixed order.
 * `defs` is the map from definitions(); pass it once for a whole post's products.
 */
function specsOf(product, defs = new Map()) {
  const f = asObj(product && product.facets) || {};
  const rows = [];
  for (const [key, raw] of Object.entries(f)) {
    if (key.startsWith('_') || NOT_A_ROW.has(key)) continue;
    const value = wordsOf(raw);
    if (!value) continue;
    const d = defs.get(key);
    rows.push({ key, label: d ? d.label : plain(key), value, sort: d ? d.sort : 9999 });
  }
  const rank = (r) => { const i = FIRST.indexOf(r.key); return i >= 0 ? i : FIRST.length; };
  rows.sort((a, b) => rank(a) - rank(b) || a.sort - b.sort || a.label.localeCompare(b.label));
  return rows.map(({ key, label, value }) => ({ key, label, value }));
}

/** leaf id → "Men › Topwear › T-Shirts" for a set of category leaves. */
async function categoryPaths(leafIds, conn = db) {
  const out = new Map();
  const ids = [...new Set((leafIds || []).filter(Boolean))];
  if (!ids.length) return out;
  const { rows } = await conn.query(
    `WITH RECURSIVE up AS (
       SELECT id AS leaf, id, parent_id, name, depth FROM category_nodes WHERE id = ANY($1::uuid[])
       UNION ALL
       SELECT up.leaf, n.id, n.parent_id, n.name, n.depth FROM category_nodes n JOIN up ON n.id = up.parent_id)
     SELECT leaf, name, depth FROM up ORDER BY leaf, depth`, [ids]);
  const names = new Map();
  for (const r of rows) names.set(r.leaf, [...(names.get(r.leaf) || []), r.name]);
  for (const [leaf, list] of names) out.set(leaf, list.filter(Boolean).join(' › '));
  return out;
}

/** Tests only. */
function _resetCache() { cache = null; }

module.exports = { definitions, specsOf, brandLabelOf, categoryPaths, wordsOf, _resetCache };
