'use strict';

/**
 * Apply migration 127 (design_tokens + design_presets — Design System, Creator
 * Experience Engine Phase 1) to PRODUCTION. Loads ../.env.prod-backup explicitly.
 * Additive + idempotent (CREATE TABLE IF NOT EXISTS), ships EMPTY (seed is 128) —
 * deploy-inert until seeded. Safe to re-run.
 * Contract: features/design-system-tokens/.
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

  const f = '127_design_system.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(`SELECT count(*)::int AS n FROM design_tokens`);
  console.log(`design_tokens rows: ${rows[0].n} (expected 0 on first run — seed is migration 128)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
