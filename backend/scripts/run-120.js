'use strict';

/**
 * Apply migration 120 (payment_config.attribution_window_days) to PRODUCTION.
 * Loads ../.env.prod-backup explicitly. Additive (ADD COLUMN IF NOT EXISTS,
 * default 30) — no row altered. Safe to re-run.
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

  const f = '120_attribution_window_days.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT attribution_window_days FROM payment_config WHERE id = 1`
  );
  console.log('\npayment_config.attribution_window_days =', rows[0]?.attribution_window_days);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
