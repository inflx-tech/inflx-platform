'use strict';
/**
 * phase0-verify.js — READ-ONLY prod verification for Phase 0 of the
 * post/concept program (Docs/FASHION_REBUILD/POST_CONCEPT_BUILD_PLAN.md).
 *
 * Checks (no writes of any kind):
 *   1. fashion category_nodes: rows by depth, leaf count vs the reviewed CSV
 *   2. leaf-name diff: CSV leaves missing from DB / DB leaves not in CSV
 *   3. brand_products orphans: category_node_id IS NULL, grouped so we can
 *      see which are fashion-relevant vs other verticals
 *   4. facet_definitions count for fashion
 *
 *   ENV_FILE=.env.prod-backup node scripts/phase0-verify.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const DIR = path.join(__dirname, '../../features/listing-fashion-drilldown-upgrade');

function csvLeaves() {
  const lines = fs.readFileSync(path.join(DIR, 'fashion_listing_tree.draft.csv'), 'utf8')
    .trim().split(/\r?\n/).slice(1);
  return lines.map(l => {
    const c = l.split(',');
    return { segment: c[0].trim(), category: c[1].trim(), leaf: c[2].trim() };
  });
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[p0] connected via ${envFile} → ${(await c.query('SELECT current_database() d')).rows[0].d}\n`);

  // 1. tree shape
  const shape = await c.query(
    `SELECT depth, is_leaf, count(*)::int n FROM category_nodes
      WHERE vertical='fashion' GROUP BY depth, is_leaf ORDER BY depth, is_leaf`);
  console.log('[1] fashion category_nodes by depth/is_leaf:');
  console.table(shape.rows);
  const totals = await c.query(
    `SELECT count(*)::int total, count(*) FILTER (WHERE is_leaf)::int leaves
       FROM category_nodes WHERE vertical='fashion'`);
  console.log('[1] totals:', totals.rows[0]);

  // 2. leaf diff vs CSV (match on segment+category+name — sibling-unique)
  const dbLeaves = (await c.query(
    `SELECT segment, category, name FROM category_nodes
      WHERE vertical='fashion' AND is_leaf ORDER BY segment, category, name`)).rows;
  const key = r => `${r.segment}|${r.category}|${r.leaf || r.name}`;
  const csvSet = new Set(csvLeaves().map(key));
  const dbSet = new Set(dbLeaves.map(key));
  const missingInDb = [...csvSet].filter(k => !dbSet.has(k));
  const extraInDb = [...dbSet].filter(k => !csvSet.has(k));
  console.log(`\n[2] CSV leaves: ${csvSet.size} | DB leaves: ${dbSet.size}`);
  console.log(`[2] in CSV but NOT in DB (${missingInDb.length}):`);
  missingInDb.forEach(k => console.log('    -', k));
  console.log(`[2] in DB but NOT in CSV (${extraInDb.length}):`);
  extraInDb.forEach(k => console.log('    +', k));

  // 3. product orphans (no tree link), by category_key + brand business type
  const orphan = await c.query(
    `SELECT COALESCE(bp.category_key,'(null)') category_key,
            COALESCE(b.category,'(null)')      brand_type,
            count(*)::int n,
            count(*) FILTER (WHERE bp.is_active AND bp.pushed_to_store)::int live
       FROM brand_products bp JOIN brands b ON b.id = bp.brand_id
      WHERE bp.category_node_id IS NULL
      GROUP BY 1,2 ORDER BY n DESC`);
  console.log('\n[3] brand_products WITH NO category_node_id (by category_key × brand type):');
  console.table(orphan.rows);
  const linked = await c.query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE category_node_id IS NOT NULL)::int linked
       FROM brand_products`);
  console.log('[3] all products:', linked.rows[0]);

  // fashion-brand orphans in detail (the ones that matter for concepts)
  const fashionOrphans = await c.query(
    `SELECT b.id brand_id, u.name brand_name, count(*)::int n
       FROM brand_products bp
       JOIN brands b ON b.id = bp.brand_id
       JOIN users u ON u.id = b.user_id
      WHERE bp.category_node_id IS NULL AND b.category LIKE 'fashion%'
      GROUP BY 1,2 ORDER BY n DESC LIMIT 20`);
  console.log('\n[3b] fashion-brand orphan products by brand (top 20):');
  console.table(fashionOrphans.rows);

  // 4. facets
  const fac = await c.query(
    `SELECT count(*)::int n, count(DISTINCT scope)::int scopes
       FROM facet_definitions WHERE vertical='fashion'`);
  console.log('[4] fashion facet_definitions:', fac.rows[0]);

  await c.end();
})().catch(e => { console.error('[p0] ERROR', e.message); process.exit(1); });
