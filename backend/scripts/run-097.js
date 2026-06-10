'use strict';
/**
 * Apply migration 097 (backfill: arm stuck Tranche-3 escrow entries).
 * Data backfill only — no DDL. Idempotent (guarded by status='locked' AND
 * triggered_at IS NULL). PRODUCTION-IMPACTING: founder go.
 * Contract: features/backend-defect-tranche3-never-queued
 *   ENV_FILE=.env.prod-backup node scripts/run-097.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-097] connected via ${envFile} → ${(await c.query('SELECT current_database() d')).rows[0].d}`);
  const before = await c.query(
    `SELECT count(*)::int n FROM escrow_entries
     WHERE tranche_number=3 AND trigger_event='day_30_post_live' AND status='locked' AND triggered_at IS NULL`);
  console.log(`[run-097] stuck T3 entries before: ${before.rows[0].n}`);
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/097_backfill_t3_queue.sql'), 'utf8'));
  const after = await c.query(
    `SELECT count(*)::int queued FROM escrow_entries WHERE tranche_number=3 AND status='queued'`);
  console.log(`[run-097] applied. T3 entries now queued: ${after.rows[0].queued} (clocks run from each T2's release date; >30d-old ones release on the next hourly cron tick)`);
  await c.end();
})().catch((e) => { console.error('[run-097] ERROR', e.message); process.exit(1); });
