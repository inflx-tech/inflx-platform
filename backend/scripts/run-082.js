'use strict';

/**
 * Apply migration 082 — meal_offer_rules.recommended flag.
 * Per run-058.js precedent. Forward-only, idempotent, additive.
 * Contract: features/meals-offer-multi-suggest-modify-chat/.
 *
 * Adds a single nullable-with-default boolean column the AI uses to mark
 * its best-pick offer(s). Safe to re-run: ADD COLUMN IF NOT EXISTS.
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

  const f = '082_meals_offer_recommended.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity: column exists, boolean, defaults false.
  const { rows } = await c.query(
    `SELECT data_type, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'meal_offer_rules'
        AND column_name = 'recommended'`
  );
  console.log('\nmeal_offer_rules.recommended:');
  console.table(rows);
  if (rows.length !== 1 || rows[0].data_type !== 'boolean') {
    console.error('\n⚠️  recommended column missing or not boolean');
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
