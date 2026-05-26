'use strict';

/**
 * Apply migration 070 — Phase A6.5 + A13: razorpay_plan_id column on
 * subscription_prices + invoice idempotency unique index. Per
 * run-069.js precedent. Idempotent, forward-only.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /\/\/[^@]*@(localhost|127\.0\.0\.1)[:\/]/.test(url);
  const sslMode =
    process.env.PGSSL === 'disable' ? false :
    process.env.PGSSL === 'require' ? { rejectUnauthorized: false } :
    isLocal                          ? false :
                                       { rejectUnauthorized: false };
  const c = new Client({ connectionString: url, ssl: sslMode });
  await c.connect();

  const f = '070_razorpay_plan_id.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity probe: column exists
  const { rows: cols } = await c.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_name = 'subscription_prices'
        AND column_name = 'razorpay_plan_id'`
  );
  console.log('\nsubscription_prices.razorpay_plan_id column:');
  console.table(cols);
  if (cols.length === 0) {
    console.error('\nFAILED: razorpay_plan_id column not found');
    process.exit(2);
  }

  // Sanity probe: idempotency index exists
  const { rows: idx } = await c.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE tablename IN ('subscription_invoices', 'subscription_prices')
        AND indexname IN ('idx_sub_prices_razorpay_plan', 'ux_sub_invoices_brand_payment')
      ORDER BY indexname`
  );
  console.log('\nA6.5 indexes:');
  console.table(idx);
  if (idx.length !== 2) {
    console.error(`\nFAILED: expected 2 indexes, found ${idx.length}`);
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
