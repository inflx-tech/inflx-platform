'use strict';

/**
 * Apply migration 110 (follower v2 home: verticals + per-vertical categories)
 * to PRODUCTION Supabase. Per the run-107.js precedent — loads
 * ../.env.prod-backup so it targets prod regardless of ../.env.
 *
 * Additive + idempotent: two new tables (IF NOT EXISTS) + seed rows
 * (ON CONFLICT DO NOTHING). Re-runnable.
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

  const f = '110_follower_verticals_home.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: verts } = await c.query(`SELECT key, name, sort_order FROM follower_verticals ORDER BY sort_order`);
  console.log('\nfollower_verticals:');
  console.table(verts);
  const { rows: cats } = await c.query(`SELECT vertical_key, key, name FROM follower_vertical_categories ORDER BY vertical_key, sort_order`);
  console.log('\nfollower_vertical_categories:');
  console.table(cats);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
