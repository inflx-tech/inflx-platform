'use strict';

/**
 * Apply migration 101 (brand_products.pushed_to_store). Per the run-100
 * precedent. Additive + idempotent. Targets DATABASE_URL.
 * Contract: features/merch-engine-p2a-product-push-store.
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

  const f = '101_product_push_to_store.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(`
    SELECT column_name, data_type, column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brand_products' AND column_name='pushed_to_store'
  `);
  console.table(rows);
  const { rows: cnt } = await c.query(
    `SELECT count(*) FILTER (WHERE pushed_to_store) AS pushed, count(*) AS total FROM brand_products`
  );
  console.log('pushed/total:', cnt[0]);

  await c.end();
  console.log('Done.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
