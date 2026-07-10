'use strict';

/** Apply migration 138 (scoped proposals — Phase 8a) to PRODUCTION.
 * Loads ../.env.prod-backup. Additive columns + one loosened constraint; every
 * existing proposal row keeps NULLs. Contract: features/scoped-proposals/. */

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
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '138_scoped_proposals.sql'), 'utf8'));
  const { rows } = await c.query(`SELECT count(*)::int AS n FROM influencer_proposals WHERE scope_level IS NOT NULL`);
  console.log(`OK — scoped proposals: ${rows[0].n} (expected 0 — existing rows unaffected)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
