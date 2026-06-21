'use strict';

/** Apply migration 117 (reusable addon/variation templates) to PROD. */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs || !cs.includes('supabase')) { console.error('ABORT: not supabase'); process.exit(1); }
  console.log(`Target: ${cs.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();
  process.stdout.write('Running 117 ... ');
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/117_addon_templates.sql'), 'utf8'));
  console.log('OK');
  const { rows } = await c.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name='brand_addon_templates'`);
  console.table(rows);
  await c.end();
  console.log('Done.');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
