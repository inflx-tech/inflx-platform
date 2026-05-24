'use strict';

/**
 * Apply migration 060 — Phase A9 features list per tier.
 * Idempotent, additive, display-only. Per run-059.js precedent.
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

  const f = '060_tier_features.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity: features_json column exists and each of 4 tier rows has >= 4 bullets.
  const { rows: cols } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='subscription_tiers' AND column_name='features_json'`
  );
  if (cols.length !== 1) {
    console.error('\nFAILED: features_json column missing');
    process.exit(2);
  }

  const { rows: tiers } = await c.query(
    `SELECT tier_key, jsonb_array_length(features_json) AS bullets
       FROM subscription_tiers ORDER BY sort_order`
  );
  console.log('\nfeatures per tier:');
  console.table(tiers);
  for (const t of tiers) {
    if (Number(t.bullets) < 4) {
      console.warn(`WARN: tier ${t.tier_key} has only ${t.bullets} bullets — admin should add more.`);
    }
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
