'use strict';

/**
 * Apply migration 125 (section_events — per-section tap capture) to PRODUCTION.
 * Loads ../.env.prod-backup explicitly. Additive + idempotent (CREATE TABLE /
 * INDEX IF NOT EXISTS) — no row altered. Safe to re-run.
 * Contract: features/section-analytics-city/.
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

  const f = '125_section_events.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'section_events' ORDER BY ordinal_position`
  );
  console.log('\nsection_events columns:', cols.map(r => r.column_name).join(', '));
  const { rows: n } = await c.query('SELECT count(*)::int AS total FROM section_events');
  console.log('Rows:', n[0].total, '(0 expected on first run — counts start honest)');

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
