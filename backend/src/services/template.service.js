'use strict';

/**
 * template.service.js — Experience Templates (Creator Experience Engine Phase 5,
 * migrations 133-134). CRUD + place/unplace.
 *
 * A template = Theme (P2) + Design layout (P3) + Section Style + placement/rules.
 * "Place" upserts ONE section_config row (rule='experience_template', template_id
 * set) for the world's follower home (screen='category', scope_type='vertical',
 * scope_value=world_key). The row renders empty until creator experiences exist
 * (Phase 6), so the live home is unchanged.
 */

const db = require('../config/db');

const TYPES = ['creator', 'automatic', 'mixed'];
const STYLES = ['carousel', 'grid', 'masonry', 'collage', 'story_rail', 'tabs', 'bento', 'split', 'hero', 'magazine'];
const STORE_RULES = ['always', 'if_products', 'manual'];
const CREATOR_STORE_RULES = ['always', 'if_creator_has_experience', 'hidden'];

const COLS = `id, world_key, key, name, template_type, theme_key, design_layout_key, section_style,
  placement_json, store_rule, creator_store_rule, location_priority, status, created_at, updated_at`;

const bad = (msg, field) => { const e = new Error(msg); e.field = field; throw e; };
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'template'; }

async function listTemplates({ world_key, status } = {}) {
  const params = []; let where = '1=1';
  if (world_key) { params.push(String(world_key).toLowerCase()); where += ` AND world_key = $${params.length}`; }
  if (status) { params.push(String(status)); where += ` AND status = $${params.length}`; }
  const { rows } = await db.query(`SELECT ${COLS} FROM experience_templates WHERE ${where} ORDER BY updated_at DESC`, params);
  return rows;
}

async function getTemplate(id) {
  const { rows } = await db.query(`SELECT ${COLS} FROM experience_templates WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function uniqueKey(worldKey, base) {
  const k = slug(base);
  for (let i = 1; i < 50; i++) {
    const cand = i === 1 ? k : `${k}_${i}`;
    const { rows } = await db.query(`SELECT 1 FROM experience_templates WHERE world_key=$1 AND key=$2 LIMIT 1`, [worldKey, cand]);
    if (!rows.length) return cand;
  }
  return `${k}_${Date.now()}`;
}

async function createTemplate(body = {}) {
  const worldKey = String(body.world_key || '').toLowerCase();
  if (!worldKey) bad('world_key required', 'world_key');
  const type = body.template_type || 'creator';
  if (!TYPES.includes(type)) bad(`template_type must be one of ${TYPES.join('|')}`, 'template_type');
  const style = body.section_style || 'carousel';
  if (!STYLES.includes(style)) bad(`section_style must be one of ${STYLES.join('|')}`, 'section_style');

  // design layout is required (the visual grammar); validate it exists
  if (!body.design_layout_key) bad('design_layout_key required', 'design_layout_key');
  const layout = (await db.query(`SELECT key FROM design_layouts WHERE key=$1 AND status='active' LIMIT 1`, [body.design_layout_key])).rows[0];
  if (!layout) bad(`unknown design layout '${body.design_layout_key}'`, 'design_layout_key');

  // theme required for creator/mixed; validate if provided
  let themeName = null;
  if (type !== 'automatic' && !body.theme_key) bad('theme_key required for creator/mixed templates', 'theme_key');
  if (body.theme_key) {
    const th = (await db.query(`SELECT name FROM experience_themes WHERE world_key=$1 AND key=$2 ORDER BY is_blueprint ASC LIMIT 1`, [worldKey, body.theme_key])).rows[0];
    if (!th) bad(`unknown theme '${body.theme_key}' in ${worldKey}`, 'theme_key');
    themeName = th.name;
  }

  const styleLabel = style.charAt(0).toUpperCase() + style.slice(1);
  const name = body.name || (themeName ? `${themeName} ${styleLabel}` : `New ${styleLabel} Template`);
  const key = await uniqueKey(worldKey, body.key || name);

  const { rows } = await db.query(
    `INSERT INTO experience_templates
       (world_key, key, name, template_type, theme_key, design_layout_key, section_style,
        placement_json, store_rule, creator_store_rule, location_priority, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,
             COALESCE($8::jsonb,'{"screens":["home"],"audiences":["all"]}'::jsonb),
             COALESCE($9,'if_products'), COALESCE($10,'if_creator_has_experience'),
             COALESCE($11::text[],'{city,state,country,global}'), 'draft')
     RETURNING ${COLS}`,
    [worldKey, key, name, type, body.theme_key || null, body.design_layout_key, style,
     body.placement_json ? JSON.stringify(body.placement_json) : null,
     STORE_RULES.includes(body.store_rule) ? body.store_rule : null,
     CREATOR_STORE_RULES.includes(body.creator_store_rule) ? body.creator_store_rule : null,
     Array.isArray(body.location_priority) ? body.location_priority : null]);
  return rows[0];
}

const EDITABLE = ['name', 'template_type', 'theme_key', 'design_layout_key', 'section_style', 'placement_json', 'store_rule', 'creator_store_rule', 'location_priority'];
async function updateTemplate(id, patch = {}) {
  const sets = []; const params = [];
  for (const col of EDITABLE) {
    if (!(col in patch)) continue;
    if (col === 'placement_json') { params.push(JSON.stringify(patch[col])); sets.push(`${col} = $${params.length}::jsonb`); }
    else if (col === 'location_priority') { params.push(patch[col]); sets.push(`${col} = $${params.length}::text[]`); }
    else { params.push(patch[col]); sets.push(`${col} = $${params.length}`); }
  }
  if (!sets.length) return getTemplate(id);
  params.push(id);
  const { rows } = await db.query(`UPDATE experience_templates SET ${sets.join(', ')}, updated_at=now() WHERE id=$${params.length} RETURNING ${COLS}`, params);
  return rows[0] || null;
}

// Place: upsert the world-home section_config row for this template.
async function placeTemplate(id) {
  const t = await getTemplate(id);
  if (!t) return { notFound: true };

  const th = t.theme_key
    ? (await db.query(`SELECT default_title, name FROM experience_themes WHERE world_key=$1 AND key=$2 ORDER BY is_blueprint ASC LIMIT 1`, [t.world_key, t.theme_key])).rows[0]
    : null;
  const title = (th && (th.default_title || th.name)) || t.name;

  const screen = 'category';           // per-world follower home
  const scopeType = 'vertical';
  const scopeValue = t.world_key;
  const shelfKey = `tpl_${t.key}`;
  const config = { template_id: t.id, section_style: t.section_style, design_layout_key: t.design_layout_key, template_type: t.template_type };

  const existing = (await db.query(
    `SELECT id FROM section_config WHERE screen=$1 AND scope_type=$2 AND scope_value=$3 AND shelf_key=$4 LIMIT 1`,
    [screen, scopeType, scopeValue, shelfKey])).rows[0];

  let section;
  if (existing) {
    section = (await db.query(
      `UPDATE section_config SET title=$1, shelf_type='mixed', rule='experience_template', item_type=NULL,
              config_json=$2::jsonb, template_id=$3, enabled=true, updated_at=now()
        WHERE id=$4 RETURNING id, screen, scope_type, scope_value, shelf_key, title, shelf_type, rule, template_id, enabled, position`,
      [title, JSON.stringify(config), t.id, existing.id])).rows[0];
  } else {
    const pos = (await db.query(
      `SELECT COALESCE(MAX(position),0)+1 AS p FROM section_config WHERE screen=$1 AND scope_type=$2 AND scope_value=$3`,
      [screen, scopeType, scopeValue])).rows[0].p;
    section = (await db.query(
      `INSERT INTO section_config (screen, scope_type, scope_value, shelf_key, title, shelf_type, rule, item_type, item_limit, position, enabled, config_json, template_id)
       VALUES ($1,$2,$3,$4,$5,'mixed','experience_template',NULL,8,$6,true,$7::jsonb,$8)
       RETURNING id, screen, scope_type, scope_value, shelf_key, title, shelf_type, rule, template_id, enabled, position`,
      [screen, scopeType, scopeValue, shelfKey, title, pos, JSON.stringify(config), t.id])).rows[0];
  }

  await db.query(`UPDATE experience_templates SET status='placed', updated_at=now() WHERE id=$1`, [id]);
  return { section };
}

// Unplace: remove the template's section row + back to draft.
async function unplaceTemplate(id) {
  const t = await getTemplate(id);
  if (!t) return { notFound: true };
  await db.query(`DELETE FROM section_config WHERE template_id=$1`, [id]);
  await db.query(`UPDATE experience_templates SET status='draft', updated_at=now() WHERE id=$1`, [id]);
  return { unplaced: true };
}

module.exports = { listTemplates, getTemplate, createTemplate, updateTemplate, placeTemplate, unplaceTemplate };
