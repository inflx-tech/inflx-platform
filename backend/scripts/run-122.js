'use strict';

/**
 * Apply migration 122 (follower_pages table + section_config.screen CHECK += 'page')
 * to PRODUCTION. Loads ../.env.prod-backup explicitly. Additive + idempotent
 * (CREATE TABLE IF NOT EXISTS, drop/re-add named CHECK) — no row altered. Safe to re-run.
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

  const f = '122_follower_pages.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'follower_pages' ORDER BY ordinal_position`
  );
  console.log('\nfollower_pages columns:', cols.map(r => r.column_name).join(', '));

  const { rows: chk } = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'section_config_screen_check'`
  );
  console.log('screen CHECK:', chk[0]?.def);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
