'use strict';

/**
 * Apply migration 123 (influencer_groups + influencer_group_members) to PRODUCTION.
 * Loads ../.env.prod-backup explicitly. Additive + idempotent (CREATE ... IF NOT EXISTS).
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

  const f = '123_influencer_groups.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: tbls } = await c.query(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name IN ('influencer_groups','influencer_group_members')
     ORDER BY table_name`);
  console.log('\ntables:'); console.table(tbls);

  const { rows: idx } = await c.query(`
    SELECT indexname FROM pg_indexes
     WHERE schemaname='public' AND tablename='influencer_groups'`);
  console.log('\ninfluencer_groups indexes:'); console.table(idx);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
