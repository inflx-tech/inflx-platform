'use strict';

/**
 * Apply migration 057 — INFLX Meals admin-set platform radius.
 * Per run-058.js precedent. Forward-only, idempotent, additive.
 * Contract: features/meals-admin-radius/.
 *
 * BACKFILL NOTE: see run-056.js — 056 + 057 were skipped on prod. This
 * runner must be applied immediately AFTER run-056.js.
 *
 * Creates platform_meals_settings (single-row, id=1) seeded with one row
 * (5 km, ±500 m, 120 min lead) + adds optional lat/lng columns to
 * follower_addresses.
 *
 * Safe to re-run: IF NOT EXISTS table, ADD COLUMN IF NOT EXISTS, seed
 * INSERT ... ON CONFLICT (id) DO NOTHING.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /\/\/[^@]*@(localhost|127\.0\.0\.1)[:\/]/.test(url);
  const sslMode =
    process.env.PGSSL === 'disable' ? false :
    process.env.PGSSL === 'require' ? { rejectUnauthorized: false } :
    isLocal                          ? false :
                                       { rejectUnauthorized: false };
  const c = new Client({ connectionString: url, ssl: sslMode });
  await c.connect();
  console.log(`Target: ${url.replace(/:[^:@]+@/, ':***@')}`);

  const f = '057_meals_admin_radius.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // ── Sanity probes ─────────────────────────────────────────────────────────

  // platform_meals_settings exists with exactly one seeded row (id = 1)
  const { rows: settings } = await c.query(
    `SELECT id, radius_km, radius_tolerance_m, min_order_lead_minutes
       FROM platform_meals_settings ORDER BY id`
  );
  console.log(`\nplatform_meals_settings (${settings.length}/1):`);
  console.table(settings);
  if (settings.length !== 1 || settings[0].id !== 1) {
    console.error('\n⚠️  Expected exactly one platform_meals_settings row with id = 1');
    process.exit(2);
  }

  // follower_addresses gained lat/lng columns
  const { rows: cols } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'follower_addresses'
        AND column_name IN ('lat','lng') ORDER BY column_name`
  );
  console.log(`\nfollower_addresses lat/lng columns (${cols.length}/2):`);
  console.table(cols);
  if (cols.length !== 2) {
    console.error(`\n⚠️  Expected lat + lng on follower_addresses — got ${cols.length}`);
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
