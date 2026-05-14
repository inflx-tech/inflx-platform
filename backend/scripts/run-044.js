'use strict';

/**
 * Apply migration 044 — add outreach_status (+ reengagement_date) to
 * brand_profiles. Hotfix for the missing column that breaks admin
 * intake. Idempotent.
 *
 * Usage:
 *   node scripts/run-044.js          → DATABASE_URL
 *   node scripts/run-044.js --test   → TEST_DATABASE_URL
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
    path.join(__dirname, '../migrations/044_brand_profiles_outreach_status.sql'),
    'utf8'
  );
  process.stdout.write('Running 044_brand_profiles_outreach_status.sql ... ');
  await c.query(sql);
  console.log('OK');

  // Sanity check
  const { rows } = await c.query(`
    SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='brand_profiles'
       AND column_name IN ('outreach_status','reengagement_date')
     ORDER BY column_name
  `);
  console.log('\nbrand_profiles new columns:');
  console.table(rows);

  if (rows.length !== 2) {
    console.error('✗ Expected 2 new columns, got', rows.length);
    process.exit(1);
  }

  await c.end();
  console.log('\n✓ Done\n');
})().catch(e => { console.error('\n✗', e.message); process.exit(1); });
