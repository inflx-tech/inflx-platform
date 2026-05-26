'use strict';

/**
 * Apply migration 069 — Phase A14: brand_feature_overrides table.
 * Per run-068.js precedent. Idempotent, forward-only.
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

  const f = '069_brand_feature_overrides.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity probe: table exists with expected columns
  const { rows: cols } = await c.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_name = 'brand_feature_overrides'
      ORDER BY ordinal_position`
  );
  console.log('\nbrand_feature_overrides columns:');
  console.table(cols);
  if (cols.length === 0) {
    console.error('\nFAILED: brand_feature_overrides table not found');
    process.exit(2);
  }

  const expectCols = ['brand_id','feature_id','included','quota_value','config','notes','created_at','updated_at','updated_by'];
  const have = new Set(cols.map(r => r.column_name));
  const missing = expectCols.filter(c => !have.has(c));
  if (missing.length) {
    console.error(`\nFAILED: missing columns: ${missing.join(', ')}`);
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
