'use strict';

/**
 * Apply migration 126 (world_rule_settings — per-world section-engine
 * behaviour) to PRODUCTION. Loads ../.env.prod-backup explicitly.
 * Additive + idempotent (CREATE TABLE IF NOT EXISTS), ships EMPTY —
 * deploy-inert until the admin saves a row. Safe to re-run.
 * Contract: features/phase3-world-rules/.
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

  const f = '126_world_rule_settings.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(`SELECT count(*)::int AS n FROM world_rule_settings`);
  console.log(`world_rule_settings rows: ${rows[0].n} (expected 0 on first run — table ships empty)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
