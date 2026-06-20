'use strict';

/**
 * Apply migration 106 (per-creator date window + date_change_requests) to
 * PRODUCTION Supabase.
 *
 * Per the run-046.js precedent (migrate.js stops at 013), BUT explicitly loads
 * ../.env.prod-backup so it targets prod regardless of what ../.env points to
 * (../.env is the local dev DB on this machine).
 *
 * Additive + idempotent only: two nullable columns on campaign_influencers
 * (no default → existing rows stay NULL → fall back to set window), one enum
 * (DO-block guarded), one new table date_change_requests (IF NOT EXISTS).
 * Re-runnable.
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

  const f = '106_per_creator_date_window.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(`
    SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='campaign_influencers'
       AND column_name IN ('window_start','window_end')
     ORDER BY column_name
  `);
  console.log('\ncampaign_influencers new columns:');
  console.table(cols);

  const { rows: tbl } = await c.query(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name='date_change_requests'
  `);
  console.log('\ndate_change_requests table:');
  console.table(tbl);

  const { rows: enm } = await c.query(`
    SELECT t.typname, e.enumlabel
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname = 'date_change_status' ORDER BY e.enumsortorder
  `);
  console.log('\ndate_change_status enum values:');
  console.table(enm);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
