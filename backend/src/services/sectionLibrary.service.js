'use strict';

/**
 * sectionLibrary.service.js — reusable, data-driven follower sections (Phase 3a).
 * Contract: features/merch-engine-p3a-section-library-engine.
 *
 * A "section" = { business_type, name, image_url, rule_json }. The rule_json is a
 * filter the engine evaluates over gated brand_products:
 *   { subcategory_node_id?, tags?: string[], price_min?, price_max?,
 *     sort?: 'newest'|'price_asc'|'price_desc' }
 * Category is implied by business_type (→ brand.category members via categoryTaxonomy).
 * Surface context (creator/brand/category/city) is stacked by the evaluator at render
 * time (sectionRules.library_products) — same section, different surface, different results.
 *
 * This module owns: CRUD + validation + getRuleJson (engine read) +
 * creatorAllocatedProductIds (the 2b allocation set for creator-surface stacking).
 * The SQL evaluator itself lives in sectionRules.library_products (it has the shared
 * gate/geo/mapper helpers).
 */

const db = require('../config/db');
const categoryTaxonomy = require('./categoryTaxonomy.service');
const { allocatedProductIds } = require('./follower.service');

const SORTS = new Set(['newest', 'price_asc', 'price_desc']);

// ── validation ───────────────────────────────────────────────────────────────
function validateRule(rule) {
  const r = (rule && typeof rule === 'object') ? rule : {};
  const out = {};
  if (r.subcategory_node_id != null) {
    if (typeof r.subcategory_node_id !== 'string' || !r.subcategory_node_id.trim()) {
      throw new Error('subcategory_node_id must be a node id string');
    }
    out.subcategory_node_id = r.subcategory_node_id.trim();
  }
  if (r.tags != null) {
    if (!Array.isArray(r.tags)) throw new Error('tags must be an array');
    const tags = r.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean);
    if (tags.length) out.tags = Array.from(new Set(tags));
  }
  for (const k of ['price_min', 'price_max']) {
    if (r[k] != null && r[k] !== '') {
      const n = Number(r[k]);
      if (!Number.isFinite(n) || n < 0) throw new Error(`${k} must be a non-negative number`);
      out[k] = n;
    }
  }
  if (out.price_min != null && out.price_max != null && out.price_min > out.price_max) {
    throw new Error('price_min must be ≤ price_max');
  }
  // Offer/discount filters (Phase 3d) — evaluated against live published-to-store offers.
  if (r.has_offer === true || r.has_offer === 'true') out.has_offer = true;
  if (r.min_discount_pct != null && r.min_discount_pct !== '') {
    const n = Number(r.min_discount_pct);
    if (!Number.isFinite(n) || n < 0) throw new Error('min_discount_pct must be a non-negative number');
    out.min_discount_pct = Math.min(100, n);
  }
  out.sort = SORTS.has(r.sort) ? r.sort : 'newest';
  return out;
}

async function validateBusinessType(bt) {
  const key = String(bt || '').trim();
  if (!key) throw new Error('business_type is required');
  if (key === 'ALL') return key;
  const maps = await categoryTaxonomy.getMaps();
  if (!maps.membersByKey[key]) throw new Error(`unknown business_type '${key}'`);
  return key;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
const COLS = `id, business_type, name, image_url, rule_json, status, created_at, updated_at`;

async function listSections({ business_type } = {}) {
  if (business_type) {
    const { rows } = await db.query(
      `SELECT ${COLS} FROM section_library WHERE business_type = $1 ORDER BY name ASC`,
      [business_type]
    );
    return rows;
  }
  const { rows } = await db.query(`SELECT ${COLS} FROM section_library ORDER BY business_type, name`);
  return rows;
}

async function getSection(id) {
  const { rows } = await db.query(`SELECT ${COLS} FROM section_library WHERE id = $1`, [id]);
  return rows[0] || null;
}

// Engine read: just the business + rule a placed section needs to render.
async function getRuleJson(id) {
  const { rows } = await db.query(
    `SELECT business_type, rule_json FROM section_library WHERE id = $1 AND status = 'active'`,
    [id]
  );
  if (!rows[0]) return null;
  return { business_type: rows[0].business_type, rule: rows[0].rule_json || {} };
}

async function createSection({ business_type, name, image_url, rule_json }) {
  const bt = await validateBusinessType(business_type);
  const nm = String(name || '').trim();
  if (!nm) throw new Error('name is required');
  const rule = validateRule(rule_json);
  const { rows } = await db.query(
    `INSERT INTO section_library (business_type, name, image_url, rule_json)
     VALUES ($1,$2,$3,$4) RETURNING ${COLS}`,
    [bt, nm, image_url ? String(image_url).trim() : null, JSON.stringify(rule)]
  );
  return rows[0];
}

async function updateSection(id, { business_type, name, image_url, rule_json, status }) {
  const sets = [];
  const params = [id];
  if (business_type !== undefined) { params.push(await validateBusinessType(business_type)); sets.push(`business_type = $${params.length}`); }
  if (name !== undefined) {
    const nm = String(name || '').trim();
    if (!nm) throw new Error('name cannot be empty');
    params.push(nm); sets.push(`name = $${params.length}`);
  }
  if (image_url !== undefined) { params.push(image_url ? String(image_url).trim() : null); sets.push(`image_url = $${params.length}`); }
  if (rule_json !== undefined) { params.push(JSON.stringify(validateRule(rule_json))); sets.push(`rule_json = $${params.length}`); }
  if (status !== undefined) {
    if (!['active', 'hidden'].includes(status)) throw new Error('bad status');
    params.push(status); sets.push(`status = $${params.length}`);
  }
  if (!sets.length) throw new Error('no fields to update');
  sets.push('updated_at = now()');
  const { rows } = await db.query(
    `UPDATE section_library SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLS}`,
    params
  );
  return rows[0] || null;
}

// ── creator allocation set (2b reuse) for creator-surface context stacking ─────
async function creatorAllocatedProductIds(influencerId) {
  if (!influencerId) return [];
  const { rows } = await db.query(
    `SELECT ci.offer_config_json AS ci_cfg, co.products_json AS products_json
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
       LEFT JOIN campaign_offers co ON co.set_id = cs.id AND co.is_active = true
      WHERE ci.influencer_id = $1
        AND ci.status IN ('contracted','active','completed')
        AND c.status  IN ('published','active','live')
        AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)`,
    [influencerId]
  );
  const ids = new Set();
  for (const r of rows) {
    for (const id of allocatedProductIds(r.ci_cfg || {}, r.products_json)) ids.add(id);
  }
  return Array.from(ids);
}

module.exports = {
  validateRule,
  validateBusinessType,
  listSections,
  getSection,
  getRuleJson,
  createSection,
  updateSection,
  creatorAllocatedProductIds,
  SORTS,
};
