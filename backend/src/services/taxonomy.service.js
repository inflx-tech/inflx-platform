'use strict';

/**
 * taxonomy.service.js — drill-down listing engine (contract:
 * features/listing-drilldown-taxonomy-engine).
 *
 * Reads the variable-depth category tree (category_nodes) + per-leaf facet
 * schema (facet_definitions), and validates a product's facet values against
 * the leaf's required facets. Facet VALUES live on brand_products.facets jsonb.
 *
 * Scope resolution for a leaf: a facet applies when
 *   facet.scope ∈ { 'ALL', leaf.category, leaf.name }.
 */

const db = require('../config/db');

const FREE_SIZE_SYSTEMS = new Set(['free_size', 'one_size', 'unstitched']);

/** Nested tree for a vertical: [segment → categories → leaves]. */
async function getTree(vertical) {
  const { rows } = await db.query(
    `SELECT id, parent_id, segment, category, name, slug, depth, is_leaf,
            sort_order, size_system, variant_axis, unisex_default
       FROM category_nodes
      WHERE vertical = $1
      ORDER BY depth, sort_order`,
    [vertical]
  );
  const byId = new Map(rows.map(r => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const r of rows) {
    const node = byId.get(r.id);
    if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Fetch a single leaf node (or null). */
async function getNode(nodeId) {
  const { rows } = await db.query(`SELECT * FROM category_nodes WHERE id = $1`, [nodeId]);
  return rows[0] || null;
}

/**
 * Resolved facet definitions for a leaf, in render order (ALL → category → leaf).
 * Deduped by facet_key — the MOST SPECIFIC scope wins (leaf > category > ALL),
 * so e.g. a category's narrower "Occasion" overrides the shared one instead of
 * rendering twice. Output keeps each facet at its first-occurrence position.
 */
async function getNodeFacets(node) {
  if (!node) return [];
  const { rows } = await db.query(
    `SELECT scope, facet_key, label, facet_role, input_type, required, allowed_values, show_if, sort_order
       FROM facet_definitions
      WHERE vertical = $1 AND scope IN ('ALL', $2, $3)
      ORDER BY (scope <> 'ALL'), sort_order`,
    [node.vertical, node.category, node.name]
  );
  const rank = (s) => (s === node.name ? 2 : s === node.category ? 1 : 0);
  const order = [];
  const best = new Map();
  for (const r of rows) {
    if (!best.has(r.facet_key)) order.push(r.facet_key);
    const cur = best.get(r.facet_key);
    if (!cur || rank(r.scope) > rank(cur.scope)) best.set(r.facet_key, r);
  }
  return order.map((k) => best.get(k));
}

/** Is the Size facet required for this leaf? (conditional → true unless free-size). */
function sizeRequired(node) {
  return !FREE_SIZE_SYSTEMS.has(node.size_system || 'free_size');
}

/**
 * Validate one item's facet values against the leaf's facet schema.
 * Pure (defs + node + item in, errors out). Returns string[] of problems.
 */
function validateItem(node, facetDefs, item) {
  const errors = [];
  if (!item || typeof item !== 'object') return ['item must be an object'];
  if (!item.name || !String(item.name).trim()) errors.push('name is required');
  if (item.price == null || isNaN(Number(item.price)) || Number(item.price) < 0) errors.push('price is required (₹ ≥ 0)');
  const facets = item.facets && typeof item.facets === 'object' ? item.facets : {};

  for (const f of facetDefs) {
    if (f.facet_key === 'images' || f.facet_key === 'price') continue; // handled by columns
    const val = facets[f.facet_key];
    const isEmpty = val == null || val === '' || (Array.isArray(val) && val.length === 0);
    let required = f.required === 'required';
    if (f.facet_key === 'size') required = sizeRequired(node);
    if (required && isEmpty) errors.push(`${f.label} is required`);
    // locked-dropdown validation for select types with an enumerated list
    if (!isEmpty && (f.input_type === 'single_select' || f.input_type === 'multi_select')) {
      const allowed = Array.isArray(f.allowed_values) ? f.allowed_values : [];
      const enumerated = allowed.length > 1; // skip note-style single entries (e.g. "open vocab…")
      if (enumerated) {
        const vals = Array.isArray(val) ? val : [val];
        const bad = vals.filter(v => !allowed.includes(v));
        if (bad.length) errors.push(`${f.label}: invalid value(s) ${bad.join(', ')}`);
      }
    }
  }
  return errors;
}

module.exports = {
  getTree,
  getNode,
  getNodeFacets,
  validateItem,
  sizeRequired,
  FREE_SIZE_SYSTEMS,
};
