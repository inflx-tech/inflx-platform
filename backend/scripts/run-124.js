'use strict';

/**
 * Apply migration 124 (section_config.starts_at + ends_at — section scheduling)
 * to PRODUCTION. Loads ../.env.prod-backup explicitly. Additive + idempotent
 * (ADD COLUMN IF NOT EXISTS) — no row altered. Safe to re-run.
 * Contract: features/section-scheduling/.
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

  const f = '124_section_scheduling.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'section_config' AND column_name IN ('starts_at','ends_at')
      ORDER BY column_name`
  );
  console.log('\nNew columns:', JSON.stringify(cols));

  const { rows: nulls } = await c.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE starts_at IS NULL AND ends_at IS NULL)::int AS both_null
       FROM section_config`
  );
  console.log('Rows:', JSON.stringify(nulls[0]), '(both_null must equal total on first run)');

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
