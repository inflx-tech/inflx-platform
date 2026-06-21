'use strict';

/** Apply migration 116 (addon-group dedupe + unique index) to PROD. */

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
  const before = (await c.query('SELECT COUNT(*)::int n FROM product_addon_groups')).rows[0].n;
  process.stdout.write(`Running 116 (groups before=${before}) ... `);
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/116_addon_groups_dedupe.sql'), 'utf8'));
  console.log('OK');
  const after = (await c.query('SELECT COUNT(*)::int n FROM product_addon_groups')).rows[0].n;
  const dup = (await c.query(`SELECT product_id, name, COUNT(*) FROM product_addon_groups GROUP BY 1,2 HAVING COUNT(*)>1`)).rows;
  console.log(`groups: ${before} -> ${after}; remaining duplicate (product,name) sets: ${dup.length}`);
  await c.end();
  console.log('Done.');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
