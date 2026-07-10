'use strict';

/**
 * Apply migration 133 (experience_templates — Creator Experience Engine Phase 5)
 * to PRODUCTION. Loads ../.env.prod-backup. Additive + idempotent, ships EMPTY.
 * Contract: features/experience-templates/.
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

  const f = '133_experience_templates.sql';
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
  const { rows } = await c.query(`SELECT count(*)::int AS n FROM experience_templates`);
  console.log(`OK — experience_templates rows: ${rows[0].n} (expected 0)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
