'use strict';

/**
 * Apply migration 114 (food dictionary expansion) to PRODUCTION.
 * Loads ../.env.prod-backup. Additive + idempotent: moves Continental
 * Pizza/Pasta/Garlic Bread -> Italian, re-sections renamed sections, and
 * insert-if-missing the full ~360-dish dictionary (existing 129 skipped).
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

  const before = (await c.query('SELECT COUNT(*)::int n FROM master_dishes')).rows[0].n;
  const f = '114_food_dictionary_expand.sql';
  process.stdout.write(`Running ${f} (before=${before}) ... `);
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
  console.log('OK');

  const after = (await c.query('SELECT COUNT(*)::int n FROM master_dishes')).rows[0].n;
  const dup = (await c.query('SELECT cuisine,section,name FROM master_dishes GROUP BY 1,2,3 HAVING COUNT(*)>1')).rows;
  const byc = (await c.query('SELECT cuisine, COUNT(*)::int n FROM master_dishes GROUP BY 1 ORDER BY 1')).rows;
  console.log(`\nmaster_dishes: ${before} -> ${after}  (duplicates: ${dup.length})`);
  console.table(byc);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
