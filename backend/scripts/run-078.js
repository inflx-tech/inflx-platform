'use strict';

/**
 * Apply migration 078 — referral-engine (Contract 1).
 * Additive: referral_codes, referral_edges, referral_ledger + partial unique
 * index + influencers.referral_earned_total. Idempotent, forward-only.
 * Per run-077.js precedent (migrate.js is broken past 013).
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

  const f = '078_referral_engine.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity: the three new tables exist
  const { rows: t } = await c.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('referral_codes','referral_edges','referral_ledger')`
  );
  // Sanity: the dedup index + idempotency index exist
  const { rows: ix } = await c.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('uniq_referral_active_referred','uniq_referral_ledger_source_ref')`
  );
  // Sanity: the reporting column exists
  const { rows: col } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'influencers' AND column_name = 'referral_earned_total'`
  );

  if (t.length !== 3 || ix.length !== 2 || col.length !== 1) {
    console.error(
      `\nFAILED: expected 3 tables / 2 indexes / 1 column, got ` +
      `tables=${t.length} indexes=${ix.length} column=${col.length}`
    );
    process.exit(2);
  }
  console.log('tables  +', t.map(r => r.table_name).join(', '));
  console.log('indexes +', ix.map(r => r.indexname).join(', '));
  console.log('influencers +', col.map(r => r.column_name).join(', '));

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
