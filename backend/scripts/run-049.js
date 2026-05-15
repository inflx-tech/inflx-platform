'use strict';

/**
 * Apply migration 049 (creator_lookbooks + lookbook_products) to prod Supabase.
 * Additive. Per the run-029-030-031.js / run-035.js / run-046.js precedent.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const f = '049_creator_lookbooks.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: t1 } = await c.query(`SELECT to_regclass('public.creator_lookbooks') AS t`);
  console.log(`creator_lookbooks table: ${t1[0].t}`);
  const { rows: t2 } = await c.query(`SELECT to_regclass('public.lookbook_products') AS t`);
  console.log(`lookbook_products table: ${t2[0].t}`);

  const { rows: idx } = await c.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename IN ('creator_lookbooks', 'lookbook_products')
    ORDER BY tablename, indexname
  `);
  console.log('\nIndexes:');
  for (const i of idx) console.log(`  ${i.indexname}`);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
