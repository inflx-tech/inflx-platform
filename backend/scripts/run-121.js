'use strict';

/**
 * Apply migration 121 (payment_config.delivery_ref_km + delivery_ref_days) to
 * PRODUCTION. Loads ../.env.prod-backup explicitly. Additive (ADD COLUMN IF NOT
 * EXISTS, defaults 100km / 2 days) — no row altered. Safe to re-run.
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

  const f = '121_delivery_eta_config.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT delivery_ref_km, delivery_ref_days FROM payment_config WHERE id = 1`
  );
  console.log('\npayment_config delivery rule:', rows[0]);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
