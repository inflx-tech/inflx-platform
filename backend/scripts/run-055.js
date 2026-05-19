'use strict';

/**
 * Apply migration 055 (fix v_searchable_creators onboarded branch:
 * u.city + approval-aware is_inflx_verified). Per run-054.js.
 * Forward-only, idempotent CREATE OR REPLACE VIEW — same output column
 * set/order as migration 045; safe to re-run. No data migration.
 * Carves resolved: backend-defect-onboarded-creator-city-search,
 * backend-defect-search-includes-pending-influencers (working-as-intended).
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const f = '055_fix_v_searchable_creators_onboarded_city.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='v_searchable_creators'
      ORDER BY ordinal_position`
  );
  console.log(`\nv_searchable_creators columns (${cols.length}):`);
  console.table(cols);

  if (cols.length < 39) {
    console.error('\n⚠️  Expected 39 columns on v_searchable_creators — got', cols.length);
    process.exit(2);
  }

  // Smoke: the view must execute and the onboarded branch must expose the
  // corrected truth columns (city from users; approval-aware verified flag).
  const { rows: probe } = await c.query(
    `SELECT source,
            COUNT(*)                                              AS rows,
            COUNT(*) FILTER (WHERE source='onboarded' AND city IS NOT NULL) AS onboarded_with_city,
            COUNT(*) FILTER (WHERE source='onboarded' AND is_inflx_verified) AS onboarded_verified,
            COUNT(*) FILTER (WHERE source='onboarded' AND NOT is_inflx_verified) AS onboarded_pending
       FROM v_searchable_creators
      GROUP BY source
      ORDER BY source`
  );
  console.log('\nSmoke (per source):');
  console.table(probe);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
