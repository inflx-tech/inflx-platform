'use strict';

/**
 * Apply migration 045 — profile_pic_r2_key on creator_profiles + brand_profiles.
 * Idempotent.
 *
 * Usage:
 *   node scripts/run-045.js          → DATABASE_URL
 *   node scripts/run-045.js --test   → TEST_DATABASE_URL
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const useTestDb = process.argv.includes('--test');
  const connectionString = useTestDb
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

  if (!connectionString) {
    console.error(`✗ ${useTestDb ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} not set`);
    process.exit(1);
  }

  console.log(`\nTarget: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  const requireSSL = connectionString.includes('supabase.com');
  const c = new Client({
    connectionString,
    ...(requireSSL && { ssl: { rejectUnauthorized: false } }),
  });
  await c.connect();

  const sql = fs.readFileSync(
    path.join(__dirname, '../migrations/045_profile_pic_r2_cache.sql'),
    'utf8'
  );
  process.stdout.write('Running 045_profile_pic_r2_cache.sql ... ');
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(`
    SELECT table_name, column_name, data_type
      FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name IN ('creator_profiles','brand_profiles')
       AND column_name IN ('profile_pic_r2_key','profile_pic_cached_at')
     ORDER BY table_name, column_name
  `);
  console.log('\nNew columns:');
  console.table(rows);

  if (rows.length !== 4) {
    console.error(`✗ Expected 4 new columns, got ${rows.length}`);
    process.exit(1);
  }

  await c.end();
  console.log('\n✓ Done\n');
})().catch(e => { console.error('\n✗', e.message); process.exit(1); });
