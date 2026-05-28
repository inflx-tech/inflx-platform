'use strict';

/**
 * Apply migration 077 — Wave 3 commit 1 (commerce settlement foundation).
 * Additive brand payout-account fields + per-transaction settlement columns.
 * Idempotent, forward-only. Per run-074.js precedent.
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

  const f = '077_commerce_settlement_foundation.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: b } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'brands'
        AND column_name IN ('razorpay_linked_account_id','linked_account_status','tcs_applicable')`
  );
  const { rows: ft } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'follower_transactions'
        AND column_name IN ('tcs_amount','commission_gst_amount','razorpay_transfer_id')`
  );
  if (b.length !== 3 || ft.length !== 3) {
    console.error(`\nFAILED: expected 3+3 new columns, got brands=${b.length}, follower_transactions=${ft.length}`);
    process.exit(2);
  }
  console.log('brands +', b.map(r => r.column_name).join(', '));
  console.log('follower_transactions +', ft.map(r => r.column_name).join(', '));

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
