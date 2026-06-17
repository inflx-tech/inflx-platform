'use strict';

/**
 * Apply migration 105 (order fulfillment: status lifecycle + courier/tracking).
 * Per the run-104 precedent. Additive + idempotent. ALTER TYPE ADD VALUE is
 * non-transactional, so each statement is executed individually (not batched in
 * one implicit transaction). Targets DATABASE_URL (.env local / .env.prod-backup prod).
 * Contract: features/order-fulfillment-engine.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const f = '105_order_fulfillment.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  // Strip full-line `--` comments FIRST, then split on ';' and run each statement on
  // its own — ALTER TYPE ADD VALUE cannot share a transaction batch with statements
  // that use the new value. (Stripping comments first avoids a leading comment block
  // gluing to — and masking — the first statement.)
  const stmts = sql
    .replace(/^\s*--.*$/gm, '')
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(Boolean);
  process.stdout.write(`Running ${f} (${stmts.length} statements) ... `);
  for (const stmt of stmts) {
    await c.query(stmt);
  }
  console.log('OK');

  const { rows } = await c.query(
    `SELECT
       (SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
          FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'order_status') AS statuses,
       (SELECT count(*)::int FROM information_schema.columns
         WHERE table_name = 'follower_orders'
           AND column_name IN ('courier_name','tracking_number','packed_at','out_for_delivery_at','cancelled_at')) AS new_cols`
  );
  console.log('order_status values:', rows[0].statuses);
  console.log('new follower_orders cols present (of 5):', rows[0].new_cols);

  await c.end();
  console.log('Done.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
