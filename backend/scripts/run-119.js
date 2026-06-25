'use strict';

/**
 * Apply migration 119 (section engine: 'business' scope + widen shelf_type
 * CHECK) to PRODUCTION. Loads ../.env.prod-backup explicitly. Idempotent
 * (drop-if-exists then re-add named CHECK constraints). Additive — no row
 * altered. Safe to re-run.
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

  const f = '119_section_engine_business_scope.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid = 'section_config'::regclass
       AND conname IN ('section_config_screen_check','section_config_shelf_type_check')
     ORDER BY conname`);
  console.log('\nsection_config CHECK constraints:'); console.table(rows);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
