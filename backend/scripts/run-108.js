'use strict';

/**
 * Apply migration 108 (referral_applications) to PRODUCTION Supabase.
 * Loads ../.env.prod-backup explicitly (../.env is local dev on this machine).
 * Additive + idempotent: CREATE TABLE/INDEX IF NOT EXISTS, text+CHECK status.
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

  const f = '108_referral_applications.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: tbl } = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='referral_applications'
     ORDER BY ordinal_position
  `);
  console.log('\nreferral_applications columns:');
  console.table(tbl);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
