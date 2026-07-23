'use strict';

/**
 * concepts.service.js — Concept engine (Post/Concept program P1, mig 139).
 * Contract: features/concept-p1-engine/.
 *
 * A concept = (template × optional category leaf). ~47 templates × 195 leaves
 * ⇒ ~9,200 addressable concepts, none stored — a `concepts` row materializes
 * lazily only when something needs a stable id (P2: creator posts).
 *
 * The rule a concept resolves to is expressed as a section-library rule_json
 * and executed by the EXISTING library_products rule (single evaluator for
 * shelves, previews and — in P2 — the post composer's product picker):
 *   leaf              → subcategory_node_id (recursive subtree)
 *   required_tags     → tags (AND semantics)
 *   eff_price_min/max → effective price band (after best live discount)
 *   offer_type (+min_discount_pct) → live offer of that type applies
 */

const db = require('../config/db');
const sectionLibrary = require('./sectionLibrary.service');
const { runRule } = require('./sectionRules.service');

const KINDS = new Set(['category', 'price', 'offer']);
const OFFER_TYPES = new Set(['discount', 'volume', 'bogo', 'bundle', 'free_gift']);
const GROUPS = new Set(['seasonal', 'occasion', 'style', 'utility']);

const TPL_COLS = `id, kind, template_group, name_pattern, required_tags,
  eff_price_min, eff_price_max, offer_type, min_discount_pct, status, sort_order,
  created_at, updated_at`;

// ── validation ───────────────────────────────────────────────────────────────

function validateTemplate(input, { partial = false } = {}) {
  const r = (input && typeof input === 'object') ? input : {};
  const out = {};

  if (!partial || r.kind != null) {
    const kind = String(r.kind || '').trim();
    if (!KINDS.has(kind)) throw new Error(`kind must be one of: ${[...KINDS].join(', ')}`);
    out.kind = kind;
  }
  if (!partial || r.name_pattern != null) {
    const np = String(r.name_pattern || '').trim();
    if (!np) throw new Error('name_pattern is required');
    out.name_pattern = np;
  }
  if (r.template_group != null && String(r.template_group).trim()) {
    const g = String(r.template_group).trim().toLowerCase();
    if (!GROUPS.has(g)) throw new Error(`template_group must be one of: ${[...GROUPS].join(', ')}`);
    out.template_group = g;
  }
  if (r.required_tags != null) {
    if (!Array.isArray(r.required_tags)) throw new Error('required_tags must be an array');
    out.required_tags = Array.from(new Set(
      r.required_tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
    ));
  }
  for (const k of ['eff_price_min', 'eff_price_max', 'min_discount_pct']) {
    if (r[k] != null && r[k] !== '') {
      const n = Number(r[k]);
      if (!Number.isFinite(n) || n < 0) throw new Error(`${k} must be a non-negative number`);
      out[k] = n;
    } else if (r[k] === '' || r[k] === null) {
      out[k] = null;
    }
  }
  if (out.eff_price_min != null && out.eff_price_max != null && out.eff_price_min > out.eff_price_max) {
    throw new Error('eff_price_min must be ≤ eff_price_max');
  }
  if (r.offer_type !== undefined) {
    if (r.offer_type === null || r.offer_type === '') out.offer_type = null;
    else {
      const t = String(r.offer_type).trim().toLowerCase();
      if (!OFFER_TYPES.has(t)) throw new Error(`offer_type must be one of: ${[...OFFER_TYPES].join(', ')}`);
      out.offer_type = t;
    }
  }
  if (r.status != null) {
    if (!['active', 'hidden'].includes(r.status)) throw new Error("status must be 'active' or 'hidden'");
    out.status = r.status;
  }
  if (r.sort_order != null) {
    const n = Number(r.sort_order);
    if (!Number.isInteger(n)) throw new Error('sort_order must be an integer');
    out.sort_order = n;
  }

  // kind-shape coherence (full validation only — partial updates re-check below)
  if (!partial) {
    if (out.kind === 'category' && !out.name_pattern.includes('{Category}')) {
      throw new Error("category templates must contain '{Category}' in name_pattern");
    }
    if (out.kind !== 'category' && (out.name_pattern || '').includes('{Category}')) {
      throw new Error("only category templates may contain '{Category}'");
    }
    if (out.kind === 'offer' && !out.offer_type) {
      throw new Error('offer templates need an offer_type');
    }
    if (out.kind === 'price' && out.eff_price_min == null && out.eff_price_max == null) {
      throw new Error('price templates need eff_price_min and/or eff_price_max');
    }
  }
  return out;
}

// ── naming ───────────────────────────────────────────────────────────────────

/** Generated display name for (template × optional leaf). Never stored.
 * category kind: 'Winter {Category}' + Jeans → 'Winter Jeans'
 * price kind   + leaf → 'Jeans Under ₹499' (leaf first — founder's examples)
 * offer kind   + leaf → 'BOGO Jeans'       (offer first — founder's examples) */
function conceptName(template, leafName) {
  if (template.kind === 'category') {
    return template.name_pattern.replace('{Category}', leafName || '{Category}');
  }
  if (!leafName) return template.name_pattern;
  return template.kind === 'price'
    ? `${leafName} ${template.name_pattern}`
    : `${template.name_pattern} ${leafName}`;
}

/** Discovery family (1-5) for (template × leaf?) — display/bookkeeping only. */
function familyOf(kind, hasLeaf) {
  if (kind === 'category') return 1;
  if (kind === 'price') return hasLeaf ? 4 : 2;
  return hasLeaf ? 5 : 3;
}

// ── rule building + preview ──────────────────────────────────────────────────

/** rule_json the EXISTING library_products evaluator executes for a concept. */
function ruleJsonFor(template, categoryNodeId) {
  const rule = {};
  if (categoryNodeId) rule.subcategory_node_id = categoryNodeId;
  if ((template.required_tags || []).length) rule.tags = template.required_tags;
  if (template.eff_price_min != null) rule.eff_price_min = Number(template.eff_price_min);
  if (template.eff_price_max != null) rule.eff_price_max = Number(template.eff_price_max);
  if (template.offer_type) rule.offer_type = template.offer_type;
  if (template.min_discount_pct != null) rule.min_discount_pct = Number(template.min_discount_pct);
  // normalize through the canonical validator so preview === render semantics
  return sectionLibrary.validateRule(rule);
}

async function getTemplate(id) {
  const { rows } = await db.query(
    `SELECT ${TPL_COLS} FROM concept_templates WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** Live preview: what would this concept catch RIGHT NOW, platform-scoped. */
async function previewConcept({ template_id, category_node_id = null, limit = 200 }) {
  const template = await getTemplate(template_id);
  if (!template) throw new Error('template not found');

  let leaf = null;
  if (category_node_id) {
    const { rows } = await db.query(
      `SELECT id, name, is_leaf, vertical FROM category_nodes WHERE id = $1`, [category_node_id]);
    leaf = rows[0] || null;
    if (!leaf) throw new Error('category node not found');
  }
  if (template.kind === 'category' && !leaf) {
    throw new Error('category templates need a category node to preview');
  }

  const rule = ruleJsonFor(template, leaf ? leaf.id : null);
  const items = await runRule('library_products', { ruleDef: rule, limit });
  return {
    name: conceptName(template, leaf ? leaf.name : null),
    family: familyOf(template.kind, !!leaf),
    rule_json: rule,
    count: items.length,
    capped: items.length >= limit,
    sample: items.slice(0, 8),
  };
}

// ── template CRUD ────────────────────────────────────────────────────────────

async function listTemplates({ kind, includeHidden = false } = {}) {
  const params = [];
  const where = [];
  if (kind) { params.push(kind); where.push(`kind = $${params.length}`); }
  if (!includeHidden) where.push(`status = 'active'`);
  const { rows } = await db.query(
    `SELECT ${TPL_COLS} FROM concept_templates
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY kind, sort_order, name_pattern`, params);
  return rows;
}

async function createTemplate(input) {
  const t = validateTemplate(input);
  const { rows } = await db.query(
    `INSERT INTO concept_templates
       (kind, template_group, name_pattern, required_tags, eff_price_min,
        eff_price_max, offer_type, min_discount_pct, status, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'active'),COALESCE($10,0))
     RETURNING ${TPL_COLS}`,
    [t.kind, t.template_group || null, t.name_pattern, t.required_tags || [],
     t.eff_price_min ?? null, t.eff_price_max ?? null, t.offer_type || null,
     t.min_discount_pct ?? null, t.status || null, t.sort_order ?? null]);
  return rows[0];
}

async function updateTemplate(id, input) {
  const existing = await getTemplate(id);
  if (!existing) return null;
  const t = validateTemplate(input, { partial: true });
  // re-check kind-shape coherence against the merged row
  const merged = { ...existing, ...t };
  if (merged.kind === 'category' && !String(merged.name_pattern).includes('{Category}')) {
    throw new Error("category templates must contain '{Category}' in name_pattern");
  }
  if (merged.kind === 'offer' && !merged.offer_type) {
    throw new Error('offer templates need an offer_type');
  }

  const sets = [];
  const params = [id];
  for (const [col, val] of Object.entries(t)) {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  }
  if (!sets.length) return existing;
  sets.push('updated_at = now()');
  const { rows } = await db.query(
    `UPDATE concept_templates SET ${sets.join(', ')} WHERE id = $1 RETURNING ${TPL_COLS}`,
    params);
  return rows[0];
}

// ── collections vocabulary ───────────────────────────────────────────────────

function slugify(s) {
  return String(s).trim().toLowerCase().replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function listCollections({ includeHidden = false } = {}) {
  const { rows } = await db.query(
    `SELECT id, name, slug, status, sort_order, created_at, updated_at
       FROM collections ${includeHidden ? '' : `WHERE status = 'active'`}
      ORDER BY sort_order, name`);
  return rows;
}

async function createCollection({ name, sort_order }) {
  const nm = String(name || '').trim();
  if (!nm) throw new Error('name is required');
  const { rows } = await db.query(
    `INSERT INTO collections (name, slug, sort_order)
     VALUES ($1, $2, COALESCE($3, 0)) RETURNING *`,
    [nm, slugify(nm), Number.isInteger(Number(sort_order)) ? Number(sort_order) : null]);
  return rows[0];
}

async function updateCollection(id, { name, status, sort_order }) {
  const sets = [];
  const params = [id];
  if (name != null) {
    const nm = String(name).trim();
    if (!nm) throw new Error('name cannot be empty');
    params.push(nm); sets.push(`name = $${params.length}`);
    params.push(slugify(nm)); sets.push(`slug = $${params.length}`);
  }
  if (status != null) {
    if (!['active', 'hidden'].includes(status)) throw new Error("status must be 'active' or 'hidden'");
    params.push(status); sets.push(`status = $${params.length}`);
  }
  if (sort_order != null) {
    const n = Number(sort_order);
    if (!Number.isInteger(n)) throw new Error('sort_order must be an integer');
    params.push(n); sets.push(`sort_order = $${params.length}`);
  }
  if (!sets.length) throw new Error('nothing to update');
  sets.push('updated_at = now()');
  const { rows } = await db.query(
    `UPDATE collections SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  return rows[0] || null;
}

module.exports = {
  validateTemplate,
  conceptName,
  familyOf,
  ruleJsonFor,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  previewConcept,
  listCollections,
  createCollection,
  updateCollection,
};
