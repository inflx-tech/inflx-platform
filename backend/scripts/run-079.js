'use strict';

/**
 * Apply migration 079 — referral-admin-controls (Contract 2).
 * Additive single-row referral_settings table + seed. Idempotent, forward-only.
 * Per run-078.js precedent (migrate.js is broken past 013).
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

  const f = '079_referral_settings.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT id, default_pct FROM referral_settings WHERE id = 1`
  );
  if (rows.length !== 1) {
    console.error(`\nFAILED: expected the singleton referral_settings row, got ${rows.length}`);
    process.exit(2);
  }
  console.log(`referral_settings seeded: id=${rows[0].id} default_pct=${rows[0].default_pct}`);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
