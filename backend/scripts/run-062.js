'use strict';

/**
 * Apply migration 062 — Phase A12.1 flip is_enforced=true on 4 quota features.
 * Per run-061.js precedent. Idempotent, forward-only.
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

  const f = '062_enforce_quota_features.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT feature_key, is_enforced
       FROM features
      WHERE feature_key IN ('active_campaigns','sets_per_campaign','products_in_store','invitations_per_cycle')
      ORDER BY feature_key`
  );
  console.log('\nis_enforced status (expect all true):');
  console.table(rows);
  const allTrue = rows.length === 4 && rows.every(r => r.is_enforced === true);
  if (!allTrue) {
    console.error('\nFAILED: expected all 4 quota features is_enforced=true');
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
