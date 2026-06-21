'use strict';

/**
 * Apply migration 115 (dish groups) to PRODUCTION. Loads ../.env.prod-backup.
 * Additive + idempotent (CREATE TABLE IF NOT EXISTS).
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

  const f = '115_dish_groups.sql';
  process.stdout.write(`Running ${f} ... `);
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
  console.log('OK');

  const { rows } = await c.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('dish_groups','dish_group_dishes')
      ORDER BY table_name`);
  console.table(rows);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
