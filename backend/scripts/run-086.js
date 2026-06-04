'use strict';

/**
 * Apply migration 086 — campaign_influencers.promoted_brand_offer_ids (uuid[]).
 * Engagement promoted-offers multi-select. Per run-085.js precedent. Additive,
 * idempotent. Contract: features/offer-engine-engagement-multi/.
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

  const f = '086_ci_promoted_offers.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT data_type, udt_name FROM information_schema.columns
      WHERE table_name = 'campaign_influencers' AND column_name = 'promoted_brand_offer_ids'`
  );
  if (!rows[0]) { console.error('\n⚠️  promoted_brand_offer_ids missing'); process.exit(2); }
  console.log('promoted_brand_offer_ids:', rows[0].data_type, rows[0].udt_name);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
