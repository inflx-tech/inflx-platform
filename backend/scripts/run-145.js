'use strict';

/** Apply migration 145 (discover_layouts — Stage B2) to PRODUCTION.
 * Loads ../.env.prod-backup. Purely additive (1 new table); idempotent.
 * Contract: features/concept-stageb-discover/. */

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
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '145_discover_layouts.sql'), 'utf8'));
  const { rows } = await c.query(`
    SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_name = 'discover_layouts'`);
  console.log('OK —', rows[0], '(expected tables: 1)');
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
