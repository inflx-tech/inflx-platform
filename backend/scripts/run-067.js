'use strict';

/**
 * Apply migration 067 — Phase A12.6 flip is_enforced=true on
 * multi_branch_support. Per run-066.js precedent. Idempotent,
 * forward-only.
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

  const f = '067_enforce_multi_branch_support.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT feature_key, is_enforced, feature_type
       FROM features
      WHERE feature_key = 'multi_branch_support'`
  );
  console.log('\nmulti_branch_support status:');
  console.table(rows);
  if (!rows[0] || rows[0].is_enforced !== true) {
    console.error('\nFAILED: expected multi_branch_support is_enforced=true');
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
