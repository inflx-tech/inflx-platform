'use strict';
/**
 * seed-furniture-taxonomy.js — seeds the furniture drill-down tree + facets onto
 * the SAME engine as fashion (category_nodes + facet_definitions, vertical='furniture').
 * Furniture is 2-level: Family (depth 0) → Item-type (depth 1, leaf). Contract:
 * features/listing-furniture-vertical. Idempotent (wipes vertical='furniture' first;
 * 0 live furniture products → safe).
 *
 *   node scripts/seed-furniture-taxonomy.js                         # local (.env)
 *   ENV_FILE=.env.prod-backup node scripts/seed-furniture-taxonomy.js   # prod
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const useSSL = /supabase\.com/.test(process.env.DATABASE_URL || '');

const DIR = path.join(__dirname, '../../features/listing-furniture-vertical');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Family display order.
const FAMILY_ORDER = ['Seating', 'Tables & Storage', 'Beds & Bedroom', 'Dining & Bar',
  'Study & Office', 'Kids', 'Outdoor', 'Pooja & Decor', 'Accessories'];
const famOrder = (s) => { const i = FAMILY_ORDER.indexOf(s); return i >= 0 ? i : 99; };

const FURNITURE_BRANDS = [
  'Godrej Interio', 'Durian', 'Nilkamal', 'Royaloak', 'Urban Ladder', 'Pepperfry',
  'Wooden Street', 'HomeTown', 'Damro', 'Featherlite', 'IKEA', '@home by Nilkamal',
  'Sleepwell', 'Duroflex', 'Wakefit', 'Kurlon', 'Springwel', 'SleepyCat',
  'Solid Wood / Sheesham', 'Local / Own brand',
];

function parseCsv(file) {
  const lines = fs.readFileSync(path.join(DIR, file), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h.trim()] = (cells[i] || '').trim(); });
    return row;
  });
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: useSSL ? { rejectUnauthorized: false } : false });
  await c.connect();
  console.log(`[seed-furniture] ${envFile} → ${(await c.query('SELECT current_database() d')).rows[0].d}`);

  const tree = parseCsv('furniture_listing_tree.draft.csv');
  const facets = parseCsv('furniture_facets.draft.csv');

  await c.query('BEGIN');
  try {
    await c.query(`DELETE FROM facet_definitions WHERE vertical='furniture'`);
    await c.query(`DELETE FROM category_nodes   WHERE vertical='furniture'`);

    const famId = new Map();
    let famN = 0, leafN = 0;
    for (const r of tree) {
      if (!famId.has(r.family)) {
        const { rows } = await c.query(
          `INSERT INTO category_nodes (vertical,parent_id,segment,name,slug,depth,is_leaf,sort_order)
           VALUES ('furniture',NULL,$1,$1,$2,0,false,$3) RETURNING id`,
          [r.family, slug(r.family), famOrder(r.family)]);
        famId.set(r.family, rows[0].id); famN++;
      }
      await c.query(
        `INSERT INTO category_nodes
           (vertical,parent_id,segment,category,name,slug,depth,is_leaf,sort_order,size_system,variant_axis)
         VALUES ('furniture',$1,$2,$2,$3,$4,1,true,$5,NULL,$6)`,
        [famId.get(r.family), r.family, r.item_type, slug(r.item_type), leafN,
         (r.variant_axis && r.variant_axis !== '-') ? r.variant_axis : null]);
      leafN++;
    }

    let facetN = 0;
    for (const f of facets) {
      const allowed = (f.allowed_values || '').includes('|')
        ? f.allowed_values.split('|').map((s) => s.trim())
        : (f.allowed_values ? [f.allowed_values.trim()] : []);
      let showIf = null;
      if (f.show_if && f.show_if.includes('=')) {
        const [fac, val] = f.show_if.split('=');
        showIf = JSON.stringify({ facet: fac.trim(), value: val.trim() });
      }
      await c.query(
        `INSERT INTO facet_definitions
           (vertical,scope,facet_key,label,facet_role,input_type,required,allowed_values,show_if,sort_order)
         VALUES ('furniture',$1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)
         ON CONFLICT (vertical,scope,facet_key) DO UPDATE SET
           label=EXCLUDED.label, facet_role=EXCLUDED.facet_role, input_type=EXCLUDED.input_type,
           required=EXCLUDED.required, allowed_values=EXCLUDED.allowed_values, show_if=EXCLUDED.show_if`,
        [f.scope, slug(f.facet_name), f.facet_name, f.facet_role || null, f.input_type,
         f.required || 'optional', JSON.stringify(allowed), showIf, facetN]);
      facetN++;
    }

    let brandN = 0;
    for (const b of FURNITURE_BRANDS) {
      await c.query(
        `INSERT INTO listing_brands (vertical, name, source, status)
         VALUES ('furniture', $1, 'seed', 'active')
         ON CONFLICT (vertical, lower(name)) DO NOTHING`, [b]);
      brandN++;
    }

    await c.query('COMMIT');
    console.log(`[seed-furniture] families=${famN} item-types=${leafN} facets=${facetN} brands=${brandN}`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
  await c.end();
})().catch((e) => { console.error('[seed-furniture] ERROR', e.message); process.exit(1); });
