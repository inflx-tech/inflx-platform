'use strict';

/**
 * Apply migration 071 — Carved defect (backend-defect-pending-mandate-enum):
 * add 'pending_mandate' to subscription_status enum. Per run-070.js
 * precedent. Idempotent, forward-only.
 *
 * Note: ALTER TYPE ADD VALUE cannot run inside a transaction block on some
 * PG versions, so this migration uses a bare ALTER (no BEGIN/COMMIT).
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

  const f = '071_subscription_status_pending_mandate.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT e.enumlabel
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'subscription_status'
      ORDER BY e.enumsortorder`
  );
  console.log('\nsubscription_status enum values:');
  console.table(rows);
  if (!rows.some(r => r.enumlabel === 'pending_mandate')) {
    console.error('\nFAILED: expected pending_mandate in subscription_status enum');
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
