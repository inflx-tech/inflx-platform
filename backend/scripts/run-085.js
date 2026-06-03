'use strict';

/**
 * Apply migration 085 — offer store-direct provenance (Sub-contract D, Phase 1).
 * Per run-084.js precedent. Forward-only, idempotent, additive.
 * Contract: features/offer-engine-store-publish/.
 *
 * Adds follower_transactions.brand_offer_id + offer_source (DORMANT until the
 * store-direct purchase path in D2 writes them).
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
  console.log(`Target: ${url.replace(/:[^:@]+@/, ':***@')}`);

  const f = '085_offer_store_direct.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'follower_transactions'
        AND column_name IN ('brand_offer_id','offer_source')
      ORDER BY column_name`
  );
  const got = rows.map(r => r.column_name);
  const missing = ['brand_offer_id', 'offer_source'].filter(x => !got.includes(x));
  if (missing.length) {
    console.error(`\n⚠️  follower_transactions missing columns: ${missing.join(', ')}`);
    process.exit(2);
  }
  console.log('follower_transactions added:', got.join(', '));

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
