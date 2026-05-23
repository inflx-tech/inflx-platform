'use strict';

/**
 * Apply migration 059 — rename follower_transactions.platform_fee
 *   → marketplace_fee_amount. Phase A2 of the revenue model rollout.
 * Per run-058.js precedent. Idempotent, metadata-only, forward-only.
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

  const f = '059_rename_marketplace_fee_amount.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity probe: new column exists, old column does not.
  const { rows } = await c.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_name = 'follower_transactions'
        AND column_name IN ('platform_fee', 'marketplace_fee_amount')`
  );
  console.log('\nfollower_transactions fee column:');
  console.table(rows);

  const has_new = rows.some(r => r.column_name === 'marketplace_fee_amount');
  const has_old = rows.some(r => r.column_name === 'platform_fee');
  if (!has_new || has_old) {
    console.error(`\n⚠️  Expected only marketplace_fee_amount present — got ${rows.map(r => r.column_name).join(', ')}`);
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
