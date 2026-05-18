'use strict';

/**
 * Apply migration 053 (restaurant_reviews — Wave 5). Per run-052.js. Additive.
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

  const f = '053_restaurant_reviews.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='restaurant_reviews'
      ORDER BY ordinal_position`
  );
  console.log(`\nrestaurant_reviews columns (${cols.length}):`);
  console.table(cols);

  const { rows: idx } = await c.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename='restaurant_reviews'
      ORDER BY indexname`
  );
  console.log(`\nIndexes (${idx.length}):`);
  for (const i of idx) console.log(`  ${i.indexname}`);

  if (cols.length < 11) {
    console.error('\n⚠️  Expected 11 columns on restaurant_reviews — got', cols.length);
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
