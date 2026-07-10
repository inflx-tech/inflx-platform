'use strict';

/**
 * Apply migration 130 (Theme Blueprints seed — ~21 Fashion starters) to
 * PRODUCTION. Loads ../.env.prod-backup explicitly. Idempotent (ON CONFLICT
 * DO UPDATE) — safe to re-run. Run AFTER run-129.js.
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

  const f = '130_theme_blueprints_seed.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(`SELECT count(*)::int AS n FROM experience_themes WHERE is_blueprint = true`);
  console.log(`blueprint rows: ${rows[0].n} (expected 21)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
