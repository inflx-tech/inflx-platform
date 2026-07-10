'use strict';

/**
 * Apply migration 135 (creator_experiences + experience_products — Creator
 * Experience Engine Phase 6a) to PRODUCTION. Loads ../.env.prod-backup.
 * Additive + idempotent, ships EMPTY — the follower home is unchanged until a
 * creator publishes for a PLACED template. Contract: features/creator-experiences/.
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

  const f = '135_creator_experiences.sql';
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
  const { rows } = await c.query(`SELECT count(*)::int AS n FROM creator_experiences`);
  console.log(`OK — creator_experiences rows: ${rows[0].n} (expected 0 — home unchanged until first publish)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
