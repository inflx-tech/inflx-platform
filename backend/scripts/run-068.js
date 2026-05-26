'use strict';

/**
 * Apply migration 068 — Phase A12.7 flip is_enforced=true on
 * dedicated_onboarding_call + phone_support_24x7 (informational
 * support-tier features; no runtime gate exists). Per run-067.js
 * precedent. Idempotent, forward-only.
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

  const f = '068_enforce_support_tier_flags.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT feature_key, is_enforced, feature_type
       FROM features
      WHERE feature_key IN ('dedicated_onboarding_call', 'phone_support_24x7')
      ORDER BY feature_key`
  );
  console.log('\nsupport-tier feature status:');
  console.table(rows);
  if (rows.length !== 2 || rows.some(r => r.is_enforced !== true)) {
    console.error('\nFAILED: expected both support-tier features is_enforced=true');
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
