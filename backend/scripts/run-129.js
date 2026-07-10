'use strict';

/**
 * Apply migration 129 (experience_themes — Theme Library, Creator Experience
 * Engine Phase 2) to PRODUCTION. Loads ../.env.prod-backup explicitly.
 * Additive + idempotent, ships EMPTY (blueprints seed in 130) — deploy-inert
 * until an admin authors/publishes. Safe to re-run.
 * Contract: features/theme-library/.
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

  const f = '129_experience_themes.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(`SELECT count(*)::int AS n FROM experience_themes`);
  console.log(`experience_themes rows: ${rows[0].n} (expected 0 on first run — blueprints seed in 130)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
