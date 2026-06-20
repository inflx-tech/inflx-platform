'use strict';

/**
 * Apply migration 109 (admin_profiles.capabilities + active + role backfill) to
 * PRODUCTION Supabase. Loads ../.env.prod-backup explicitly.
 * Additive + idempotent: ADD COLUMN IF NOT EXISTS; backfill guarded by capabilities='{}'.
 * Sanity-checks that superadmins receive a non-empty capability set (no lockout).
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

  const f = '109_admin_capabilities.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name='admin_profiles'
       AND column_name IN ('capabilities','active') ORDER BY column_name
  `);
  console.log('\nadmin_profiles new columns:');
  console.table(cols);

  const { rows: backfill } = await c.query(`
    SELECT admin_role,
           COUNT(*)::int AS admins,
           COUNT(*) FILTER (WHERE array_length(capabilities,1) > 0)::int AS with_caps,
           COUNT(*) FILTER (WHERE active)::int AS active_count
      FROM admin_profiles GROUP BY admin_role ORDER BY admin_role
  `);
  console.log('\nbackfill by role (every superadmin must have caps):');
  console.table(backfill);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
