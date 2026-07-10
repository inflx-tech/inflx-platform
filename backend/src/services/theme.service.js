'use strict';

/**
 * theme.service.js — Theme Library (Creator Experience Engine Phase 2,
 * migrations 129-130). CRUD + publish-validation for experience_themes.
 *
 * A Theme is a business definition. Blueprints (is_blueprint=true) are seeded
 * starters; "create from blueprint" clones a blueprint's fields into a draft
 * with a fresh unique key. Publish enforces the theme's own required fields
 * server-side (so a theme can't go live under-specified).
 */

const db = require('../config/db');

const COLS = `id, world_key, key, name, subtitle, icon, description, purpose, audience,
  preset_key, supported_categories, min_products, max_products, media_rules_json,
  supported_offer_types, suggested_product_ids, default_title, default_subtitle,
  default_cta, applicable_worlds, is_blueprint, blueprint_source_key, status,
  created_at, updated_at`;

const EDITABLE = [
  'name', 'subtitle', 'icon', 'description', 'purpose', 'audience', 'preset_key',
  'supported_categories', 'min_products', 'max_products', 'media_rules_json',
  'supported_offer_types', 'suggested_product_ids', 'default_title',
  'default_subtitle', 'default_cta', 'applicable_worlds', 'status',
];

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'theme';
}

async function listThemes({ world_key, status } = {}) {
  const params = [];
  let where = `is_blueprint = false`;
  if (world_key) { params.push(String(world_key).toLowerCase()); where += ` AND world_key = $${params.length}`; }
  if (status) { params.push(String(status)); where += ` AND status = $${params.length}`; }
  const { rows } = await db.query(
    `SELECT ${COLS} FROM experience_themes WHERE ${where} ORDER BY updated_at DESC`, params);
  return rows;
}

async function listBlueprints({ world_key } = {}) {
  const params = [];
  let where = `is_blueprint = true`;
  if (world_key) { params.push(String(world_key).toLowerCase()); where += ` AND world_key = $${params.length}`; }
  const { rows } = await db.query(
    `SELECT ${COLS} FROM experience_themes WHERE ${where} ORDER BY purpose, name`, params);
  return rows;
}

async function getTheme(id) {
  const { rows } = await db.query(`SELECT ${COLS} FROM experience_themes WHERE id = $1`, [id]);
  return rows[0] || null;
}

// Ensure a key is unique among AUTHORED themes in a world (blueprints excluded).
async function uniqueAuthoredKey(worldKey, base) {
  let key = slug(base);
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? key : `${key}_${i}`;
    const { rows } = await db.query(
      `SELECT 1 FROM experience_themes WHERE world_key = $1 AND key = $2 AND is_blueprint = false LIMIT 1`,
      [worldKey, candidate]);
    if (!rows.length) return candidate;
  }
  return `${key}_${Date.now()}`;
}

async function createTheme(body = {}) {
  const worldKey = String(body.world_key || '').toLowerCase();
  if (!worldKey) { const e = new Error('world_key required'); e.field = 'world_key'; throw e; }

  let src = null;
  if (body.from_blueprint_key) {
    const { rows } = await db.query(
      `SELECT ${COLS} FROM experience_themes WHERE world_key = $1 AND key = $2 AND is_blueprint = true LIMIT 1`,
      [worldKey, String(body.from_blueprint_key)]);
    src = rows[0];
    if (!src) { const e = new Error(`unknown blueprint '${body.from_blueprint_key}'`); e.field = 'from_blueprint_key'; throw e; }
  }

  const base = { ...(src || {}), ...body };
  const name = base.name || (src && src.name) || 'New theme';
  const key = await uniqueAuthoredKey(worldKey, body.key || (src && src.key) || name);

  const { rows } = await db.query(
    `INSERT INTO experience_themes
       (world_key, key, name, subtitle, icon, description, purpose, audience, preset_key,
        supported_categories, min_products, max_products, media_rules_json, supported_offer_types,
        suggested_product_ids, default_title, default_subtitle, default_cta, applicable_worlds,
        is_blueprint, blueprint_source_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
             COALESCE($10::jsonb,'[]'::jsonb), COALESCE($11::int,4), COALESCE($12::int,20),
             COALESCE($13::jsonb,'{"featured":"required","video":"optional","orientation":"portrait"}'::jsonb),
             COALESCE($14::text[],'{}'::text[]), COALESCE($15::jsonb,'[]'::jsonb), $16, $17, $18,
             COALESCE($19::text[],'{}'::text[]),
             false, $20, 'draft')
     RETURNING ${COLS}`,
    [worldKey, key, name, base.subtitle, base.icon, base.description, base.purpose, base.audience,
     base.preset_key,
     JSON.stringify(base.supported_categories || []), base.min_products, base.max_products,
     base.media_rules_json ? JSON.stringify(base.media_rules_json) : null,
     base.supported_offer_types || null, JSON.stringify(base.suggested_product_ids || []),
     base.default_title || name, base.default_subtitle || base.subtitle, base.default_cta,
     base.applicable_worlds || [worldKey], body.from_blueprint_key || (src && src.key) || null]);
  return rows[0];
}

async function updateTheme(id, patch = {}) {
  const JSONB = ['supported_categories', 'media_rules_json', 'suggested_product_ids'];
  const ARR = ['supported_offer_types', 'applicable_worlds'];
  const sets = [];
  const params = [];
  for (const col of EDITABLE) {
    if (!(col in patch)) continue;
    if (JSONB.includes(col)) { params.push(JSON.stringify(patch[col])); sets.push(`${col} = $${params.length}::jsonb`); }
    else if (ARR.includes(col)) { params.push(patch[col]); sets.push(`${col} = $${params.length}::text[]`); }
    else { params.push(patch[col]); sets.push(`${col} = $${params.length}`); }
  }
  if (!sets.length) return getTheme(id);
  params.push(id);
  const { rows } = await db.query(
    `UPDATE experience_themes SET ${sets.join(', ')}, updated_at = now()
      WHERE id = $${params.length} AND is_blueprint = false RETURNING ${COLS}`, params);
  return rows[0] || null;
}

// Returns { field, message } on the first failure, else null.
function validateForPublish(t) {
  if (!t.name || !t.name.trim()) return { field: 'name', message: 'Theme needs a name.' };
  if (!t.preset_key) return { field: 'preset_key', message: 'Pick a visual preset.' };
  const cats = Array.isArray(t.supported_categories) ? t.supported_categories : [];
  if (cats.length < 1) return { field: 'supported_categories', message: 'Pick at least one supported category.' };
  if (Number(t.min_products) > Number(t.max_products)) return { field: 'max_products', message: 'Max products must be ≥ min products.' };
  if (!t.default_title && !t.name) return { field: 'default_title', message: 'Default title required.' };
  return null;
}

async function publishTheme(id) {
  const t = await getTheme(id);
  if (!t) return { notFound: true };
  if (t.is_blueprint) return { error: { field: 'id', message: 'Blueprints cannot be published.' } };
  const bad = validateForPublish(t);
  if (bad) return { error: bad };
  const { rows } = await db.query(
    `UPDATE experience_themes SET status = 'published', updated_at = now()
      WHERE id = $1 RETURNING ${COLS}`, [id]);
  return { theme: rows[0] };
}

module.exports = { listThemes, listBlueprints, getTheme, createTheme, updateTheme, publishTheme, validateForPublish };
