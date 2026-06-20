'use strict';

/**
 * Apply migration 107 (follower address receiver + landmark fields) to
 * PRODUCTION Supabase.
 *
 * Per the run-106.js precedent: loads ../.env.prod-backup so it targets prod
 * regardless of what ../.env points to (../.env = local dev DB on this machine).
 *
 * Additive + idempotent: three nullable columns on follower_addresses
 * (receiver_name, receiver_phone, landmark) via ADD COLUMN IF NOT EXISTS.
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

  const f = '107_follower_address_receiver_landmark.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(`
    SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='follower_addresses'
       AND column_name IN ('receiver_name','receiver_phone','landmark')
     ORDER BY column_name
  `);
  console.log('\nfollower_addresses new columns:');
  console.table(cols);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
