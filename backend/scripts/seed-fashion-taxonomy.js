'use strict';
/**
 * seed-fashion-taxonomy.js — seeds the fashion drill-down tree + facets from the
 * reviewed CSVs into category_nodes + facet_definitions (vertical='fashion').
 * Contract: features/listing-fashion-drilldown-upgrade. Idempotent: wipes the
 * fashion vertical first (safe — 0 live fashion products), then re-inserts.
 *
 *   node scripts/seed-fashion-taxonomy.js                 # local (.env)
 *   ENV_FILE=.env.prod-backup node scripts/seed-fashion-taxonomy.js   # prod
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const useSSL = /supabase\.com/.test(process.env.DATABASE_URL || '');

const DIR = path.join(__dirname, '../../features/listing-fashion-drilldown-upgrade');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Segment display order (Men first, per founder). Segments not listed sort last.
const SEGMENT_ORDER = ['Men', 'Women', 'Unisex', 'Kids'];
const segOrder = (s) => { const i = SEGMENT_ORDER.indexOf(s); return i >= 0 ? i : 99; };

// Popular fashion brands seed (directory; custom brands captured at listing time).
const POPULAR_BRANDS = [
  'Levi\'s', 'Zara', 'H&M', 'Allen Solly', 'Peter England', 'US Polo Assn', 'Van Heusen',
  'Louis Philippe', 'Raymond', 'Wrangler', 'Lee', 'Pepe Jeans', 'Jack & Jones', 'Roadster',
  'Biba', 'W for Woman', 'Fabindia', 'Global Desi', 'Aurelia', 'Libas', 'Vero Moda', 'Only',
  'Nike', 'Adidas', 'Puma', 'Reebok', 'Bata', 'Woodland', 'Sparx', 'Campus',
  'Jockey', 'Rupa', 'Lux', 'Titan', 'Fastrack', 'Fossil', 'Ray-Ban', 'Fila', 'Decathlon',
];

function parseCsv(file) {
  const lines = fs.readFileSync(path.join(DIR, file), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');           // CSVs are comma-free within fields (validated)
    const row = {};
    header.forEach((h, i) => { row[h.trim()] = (cells[i] || '').trim(); });
    return row;
  });
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: useSSL ? { rejectUnauthorized: false } : false });
  await c.connect();
  console.log(`[seed-fashion] ${envFile} → ${(await c.query('SELECT current_database() d')).rows[0].d}`);

  const tree = parseCsv('fashion_listing_tree.draft.csv');
  const facets = parseCsv('fashion_facets.draft.csv');

  // FACETS_ONLY=1 → re-seed facet_definitions only and leave the tree untouched.
  // REQUIRED once real products reference category_nodes (the tree wipe would
  // violate brand_products.category_node_id). Facets carry no FK → always safe.
  const facetsOnly = process.env.FACETS_ONLY === '1';

  await c.query('BEGIN');
  try {
    await c.query(`DELETE FROM facet_definitions WHERE vertical='fashion'`);
    if (!facetsOnly) await c.query(`DELETE FROM category_nodes WHERE vertical='fashion'`);

    const segId = new Map();   // segment -> id
    const catId = new Map();   // segment||category -> id
    let segN = 0, catN = 0, leafN = 0;

    for (const r of facetsOnly ? [] : tree) {
      // segment (depth 0)
      if (!segId.has(r.segment)) {
        const { rows } = await c.query(
          `INSERT INTO category_nodes (vertical,parent_id,segment,name,slug,depth,is_leaf,sort_order)
           VALUES ('fashion',NULL,$1,$1,$2,0,false,$3) RETURNING id`,
          [r.segment, slug(r.segment), segOrder(r.segment)]);
        segId.set(r.segment, rows[0].id); segN++;
      }
      // category (depth 1)
      const ck = r.segment + '||' + r.category;
      if (!catId.has(ck)) {
        const { rows } = await c.query(
          `INSERT INTO category_nodes (vertical,parent_id,segment,name,slug,depth,is_leaf,sort_order)
           VALUES ('fashion',$1,$2,$3,$4,1,false,$5) RETURNING id`,
          [segId.get(r.segment), r.segment, r.category, slug(r.category), catId.size]);
        catId.set(ck, rows[0].id); catN++;
      }
      // leaf (depth 2)
      await c.query(
        `INSERT INTO category_nodes
           (vertical,parent_id,segment,category,name,slug,depth,is_leaf,sort_order,size_system,variant_axis,unisex_default)
         VALUES ('fashion',$1,$2,$3,$4,$5,2,true,$6,$7,$8,$9)`,
        [catId.get(ck), r.segment, r.category, r.leaf, slug(r.leaf), leafN,
         r.size_system || null,
         (r.variant_axis && r.variant_axis !== '-') ? r.variant_axis : null,
         /^y/i.test(r.unisex_default || '')]);
      leafN++;
    }

    let facetN = 0;
    for (const f of facets) {
      const allowed = (f.allowed_values || '').includes('|')
        ? f.allowed_values.split('|').map((s) => s.trim())
        : (f.allowed_values ? [f.allowed_values.trim()] : []);
      const showIf = f.show_if ? f.show_if : null;
      await c.query(
        `INSERT INTO facet_definitions
           (vertical,scope,facet_key,label,facet_role,input_type,required,allowed_values,show_if,sort_order)
         VALUES ('fashion',$1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
         ON CONFLICT (vertical,scope,facet_key) DO UPDATE SET
           label=EXCLUDED.label, facet_role=EXCLUDED.facet_role, input_type=EXCLUDED.input_type,
           required=EXCLUDED.required, allowed_values=EXCLUDED.allowed_values, show_if=EXCLUDED.show_if`,
        [f.scope, slug(f.facet_name), f.facet_name, f.facet_role || null, f.input_type,
         f.required || 'optional', JSON.stringify(allowed), showIf, facetN]);
      facetN++;
    }

    // popular brands directory (idempotent; never downgrade a 'custom' that got promoted)
    let brandN = 0;
    for (const b of POPULAR_BRANDS) {
      await c.query(
        `INSERT INTO listing_brands (vertical, name, source, status)
         VALUES ('fashion', $1, 'seed', 'active')
         ON CONFLICT (vertical, lower(name)) DO NOTHING`,
        [b]);
      brandN++;
    }

    await c.query('COMMIT');
    console.log(`[seed-fashion] segments=${segN} categories=${catN} leaves=${leafN} facets=${facetN} brands=${brandN}`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
  await c.end();
})().catch((e) => { console.error('[seed-fashion] ERROR', e.message); process.exit(1); });
