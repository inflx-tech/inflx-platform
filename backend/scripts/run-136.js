'use strict';

/** Apply migration 136 (creator_assets + creator_product_images — Phase 7a) to
 * PRODUCTION. Loads ../.env.prod-backup. Additive, ships EMPTY, flag-gated dark.
 * Contract: features/creator-imagery/. */

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
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '136_creator_assets.sql'), 'utf8'));
  const { rows } = await c.query(`SELECT count(*)::int AS n FROM creator_assets`);
  console.log(`OK — creator_assets rows: ${rows[0].n} (expected 0 — flag-gated dark)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
