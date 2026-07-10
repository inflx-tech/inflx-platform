'use strict';

/**
 * Apply migration 128 (Design System seed — Fashion starter catalog) to
 * PRODUCTION. Loads ../.env.prod-backup explicitly. Idempotent (ON CONFLICT
 * DO UPDATE) — safe to re-run; re-seeds token/preset values.
 * Contract: features/design-system-tokens/. Run AFTER run-127.js.
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

  const f = '128_design_system_seed.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const t = await c.query(`SELECT kind, count(*)::int AS n FROM design_tokens GROUP BY kind ORDER BY kind`);
  const p = await c.query(`SELECT count(*)::int AS n FROM design_presets`);
  console.log('design_tokens by kind:', t.rows.map(r => `${r.kind}=${r.n}`).join(' '));
  console.log(`design_presets rows: ${p.rows[0].n} (expected 8)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
