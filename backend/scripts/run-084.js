'use strict';

/**
 * Apply migration 084 — offer_engine (Offer Engine foundation, Sub-contract A).
 * Per run-083.js precedent. Forward-only, idempotent, additive.
 * Contract: features/offer-engine/.
 *
 * Creates brand_offers + additive (dormant) columns on campaign_influencers
 * (brand_offer_id, allocation) and store columns on brand_offers. Safe to
 * re-run: CREATE TABLE/INDEX IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
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

  const f = '084_offer_engine.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity: brand_offers table exists with the expected columns.
  const { rows: cols } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'brand_offers'
      ORDER BY ordinal_position`
  );
  if (cols.length === 0) {
    console.error('\n⚠️  brand_offers table missing');
    process.exit(2);
  }
  console.log('brand_offers columns:', cols.map(r => r.column_name).join(', '));

  // Sanity: the additive dormant columns landed on campaign_influencers.
  const { rows: ci } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaign_influencers'
        AND column_name IN ('brand_offer_id','allocation')
      ORDER BY column_name`
  );
  const got = ci.map(r => r.column_name);
  const missing = ['allocation', 'brand_offer_id'].filter(x => !got.includes(x));
  if (missing.length) {
    console.error(`\n⚠️  campaign_influencers missing columns: ${missing.join(', ')}`);
    process.exit(2);
  }
  console.log('campaign_influencers added:', got.join(', '));

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
