'use strict';

/**
 * Apply migration 080 — agency role + wallet + withdrawals (Contract 3a).
 * Splits on `-- @@SPLIT@@`: part 1 = ALTER TYPE user_role ADD VALUE 'agency'
 * (must commit before use / non-transactional on some PG), part 2 = tables +
 * payment_config column. Idempotent, forward-only. Per run-075.js precedent.
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

  const f = '080_agency_role.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  const parts = sql.split(/^--\s*@@SPLIT@@\s*$/m).map(s => s.trim()).filter(Boolean);

  process.stdout.write(`Running ${f} (${parts.length} part(s)) ... `);
  for (const part of parts) {
    await c.query(part);
  }
  console.log('OK');

  // ── Verify ────────────────────────────────────────────────────────────────
  const { rows: enumRows } = await c.query(
    `SELECT e.enumlabel FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role' ORDER BY e.enumsortorder`
  );
  console.log('user_role enum:', enumRows.map(r => r.enumlabel).join(', '));
  if (!enumRows.some(r => r.enumlabel === 'agency')) {
    console.error('\nFAILED: expected agency in user_role enum'); process.exit(2);
  }

  const { rows: tbls } = await c.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('agencies','agency_withdrawals')`
  );
  const { rows: cfgCol } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='payment_config' AND column_name='agency_tds_pct'`
  );
  if (tbls.length !== 2 || cfgCol.length !== 1) {
    console.error(`\nFAILED: expected 2 tables + agency_tds_pct, got tables=${tbls.length} cfg=${cfgCol.length}`);
    process.exit(2);
  }
  console.log('tables +', tbls.map(r => r.table_name).join(', '));
  console.log('payment_config + agency_tds_pct');

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
