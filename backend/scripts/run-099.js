'use strict';

/**
 * Apply migration 099 (product tags + tag_vocabulary).
 * Per the run-049 / run-050 precedent. Additive + idempotent (IF NOT EXISTS).
 * Targets the DB in DATABASE_URL — point .env at the intended environment
 * (local by default; prod via .env.prod-backup credentials).
 * Contract: features/merch-engine-p1a-product-tags.
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

  const f = '099_product_tags.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: col } = await c.query(`
    SELECT column_name, data_type, udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brand_products' AND column_name='tags'
  `);
  console.log('\nbrand_products.tags:');
  console.table(col);

  const { rows: tv } = await c.query(`SELECT to_regclass('public.tag_vocabulary') AS tag_vocabulary`);
  console.table(tv);

  const { rows: idx } = await c.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public'
      AND indexname IN ('idx_brand_products_tags_gin', 'idx_tag_vocabulary_scope')
    ORDER BY indexname
  `);
  console.log('New indexes:');
  for (const i of idx) console.log(`  ${i.indexname}`);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
