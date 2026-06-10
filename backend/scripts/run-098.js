'use strict';
/**
 * Apply migration 098 (payment_pending_orders durable store).
 * Additive DDL, idempotent (IF NOT EXISTS). PRODUCTION-IMPACTING: founder go.
 * MUST be applied BEFORE the backend deploy that reads it (the new
 * transaction.service writes/claims this table on every follower payment).
 * Contract: features/backend-defect-pending-order-volatile-store
 *   ENV_FILE=.env.prod-backup node scripts/run-098.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-098] connected via ${envFile} → ${(await c.query('SELECT current_database() d')).rows[0].d}`);
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/098_payment_pending_orders.sql'), 'utf8'));
  const { rows } = await c.query(`SELECT to_regclass('public.payment_pending_orders') AS tbl`);
  console.log('[run-098] applied. verify:', rows[0]);
  await c.end();
})().catch((e) => { console.error('[run-098] ERROR', e.message); process.exit(1); });
