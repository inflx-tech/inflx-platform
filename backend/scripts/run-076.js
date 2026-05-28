'use strict';

/**
 * Apply migration 076 — Wave 2 commit 3 (L2 GST on the Protection Fee).
 * Adds escrow_entries.fee_gst_amount. Idempotent, forward-only, additive.
 * Per run-074.js precedent.
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

  const f = '076_escrow_fee_gst.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT column_name, data_type, numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_name = 'escrow_entries' AND column_name = 'fee_gst_amount'`
  );
  if (rows.length === 0) {
    console.error('\nFAILED: escrow_entries.fee_gst_amount not found');
    process.exit(2);
  }
  console.log('escrow_entries.fee_gst_amount:', rows[0].data_type, `(${rows[0].numeric_precision},${rows[0].numeric_scale})`);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
