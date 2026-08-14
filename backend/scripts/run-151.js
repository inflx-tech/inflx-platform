'use strict';

/** Apply migration 151 (follower address soft delete) to PRODUCTION.
 * Loads ../.env.prod-backup. Additive DDL only; idempotent.
 * Contract: features/follower-profile-repairs/ */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs || !cs.includes('supabase')) { console.error('ABORT: not prod (.env.prod-backup).'); process.exit(1); }
  console.log(`Target: ${cs.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();

  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '151_follower_address_soft_delete.sql'), 'utf8'));

  const { rows } = await c.query(`
    SELECT
      (SELECT count(*)::int FROM information_schema.columns
        WHERE table_name = 'follower_addresses' AND column_name = 'deleted_at')      AS deleted_at_col,
      (SELECT count(*)::int FROM follower_addresses WHERE deleted_at IS NOT NULL)    AS deleted_rows,
      (SELECT count(*)::int FROM follower_addresses)                                 AS total_rows,
      (SELECT count(*)::int FROM pg_indexes
        WHERE indexname = 'idx_follower_addresses_live')                             AS live_idx`);

  console.log('OK —', rows[0]);
  console.log('(expected: deleted_at_col 1 · deleted_rows 0 · live_idx 1; total_rows unchanged)');
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
