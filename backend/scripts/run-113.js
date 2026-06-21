'use strict';

/**
 * Apply migration 113 (Food World Phase 1 — dish customisation data model) to
 * PRODUCTION. Loads ../.env.prod-backup explicitly. Additive + idempotent
 * (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS). Safe to re-run.
 *
 * Adds: product_addon_groups, product_addon_items, and brand_products
 * badge/is_featured/featured_sort. No existing table/column altered or dropped.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !connectionString.includes('supabase')) {
    console.error('ABORT: .env.prod-backup DATABASE_URL is not a supabase (prod) URL.');
    process.exit(1);
  }
  console.log(`Target: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const f = '113_food_customisation.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: tbls } = await c.query(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public'
       AND table_name IN ('product_addon_groups','product_addon_items')
     ORDER BY table_name`);
  console.log('\nnew tables:'); console.table(tbls);

  const { rows: cols } = await c.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='brand_products'
       AND column_name IN ('badge','is_featured','featured_sort')
     ORDER BY column_name`);
  console.log('\nbrand_products new columns:'); console.table(cols);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
