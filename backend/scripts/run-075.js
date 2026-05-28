'use strict';

/**
 * Apply migration 075 — Wave 2 commit 2 (brand wallet withdrawal).
 *
 * Splits the .sql on the `-- @@SPLIT@@` marker and runs each part as a
 * separate query: the ALTER TYPE ... ADD VALUE runs standalone (it is
 * non-transactional on some PG versions), then the enum + table + index
 * DDL runs together. Idempotent, forward-only. Per run-071.js precedent.
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

  const f = '075_brand_withdrawals.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  const parts = sql.split(/^--\s*@@SPLIT@@\s*$/m).map(s => s.trim()).filter(Boolean);

  process.stdout.write(`Running ${f} (${parts.length} part(s)) ... `);
  for (const part of parts) {
    await c.query(part);
  }
  console.log('OK');

  // ── Verify ────────────────────────────────────────────────────────────────
  const { rows: enumRows } = await c.query(
    `SELECT e.enumlabel
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'wallet_tx_type'
      ORDER BY e.enumsortorder`
  );
  console.log('\nwallet_tx_type enum values:', enumRows.map(r => r.enumlabel).join(', '));
  if (!enumRows.some(r => r.enumlabel === 'withdrawal')) {
    console.error('\nFAILED: expected withdrawal in wallet_tx_type enum');
    process.exit(2);
  }

  const { rows: tblRows } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'brand_withdrawals' ORDER BY ordinal_position`
  );
  if (tblRows.length === 0) {
    console.error('\nFAILED: brand_withdrawals table not found');
    process.exit(2);
  }
  console.log('brand_withdrawals columns:', tblRows.map(r => r.column_name).join(', '));

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
