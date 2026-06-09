'use strict';
/**
 * Apply migration 095 (drill-down taxonomy engine: category_nodes +
 * facet_definitions + brand_products.category_node_id/facets + GIN).
 * Additive + idempotent. PRODUCTION-IMPACTING (DDL) — founder go.
 *   ENV_FILE=.env.prod-backup node scripts/run-095.js
 * Then seed: ENV_FILE=.env.prod-backup node scripts/seed-fashion-taxonomy.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-095] connected via ${envFile} → ${(await c.query('SELECT current_database() d')).rows[0].d}`);
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/095_drilldown_taxonomy_engine.sql'), 'utf8'));
  const { rows } = await c.query(
    `SELECT to_regclass('public.category_nodes') AS nodes,
            to_regclass('public.facet_definitions') AS facets,
            EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='brand_products' AND column_name='facets') AS bp_facets`
  );
  console.log('[run-095] verify:', rows[0]);
  await c.end();
})().catch(e => { console.error('[run-095] ERROR', e.message); process.exit(1); });
