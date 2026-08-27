'use strict';
/**
 * Apply migration 161 — production_event_items, the contents of a parcel.
 * Contract: features/stage-4-the-shoot (slice 1)
 *
 * WHY 161 AND NOT 160
 * This was authored as 160 and collided: `160_influencer_youtube_stats.sql` was committed by
 * parallel work and is already applied in production. Renumbered before running. The file name
 * has no runtime effect — the collision would only have confused whoever ran them next.
 *
 * WHY THIS IS URGENT RATHER THAN ROUTINE
 * The Stage 4 backend is ALREADY LIVE. The commit was pushed by the other window before this
 * migration was applied, so `/v1/brands/me/shoots` and the parcel endpoints exist on Render
 * right now and reference a table that does not exist. They will 500 until this runs.
 *
 * WHAT IT DOES
 * Creates one table. No column dropped, no constraint that could reject a historical row,
 * nothing to backfill — no shipment that exists today has contents to describe.
 *
 * Idempotent (CREATE TABLE / INDEX IF NOT EXISTS). Safe to re-run. Already dry-run against this
 * exact database inside a rolled-back transaction on 2026-08-27.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const SQL = path.join(__dirname, '../migrations/161_production_event_items.sql');

const EXPECTED_COLS = [
  'id', 'production_event_id', 'product_id', 'name_at_dispatch', 'price_at_dispatch',
  'sku_at_dispatch', 'quantity', 'parcel_no', 'receipt_status', 'receipt_note',
  'answered_at', 'dropped_at', 'created_at', 'updated_at',
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // BEFORE — a record, not a gate. Additive DDL cannot lose a row, but the run should leave
  // evidence rather than a silent success.
  const before = await c.query(
    `SELECT (SELECT count(*)::int FROM production_events)                 AS events,
            (SELECT count(*)::int FROM production_events
              WHERE status = 'completed')                                 AS completed,
            (SELECT count(*)::int FROM production_event_log)              AS log_entries,
            to_regclass('public.production_event_items')                  AS table_before`);
  console.log('BEFORE —', JSON.stringify(before.rows[0]));

  await c.query(fs.readFileSync(SQL, 'utf8'));

  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'production_event_items' ORDER BY ordinal_position`);
  const got = cols.rows.map(r => r.column_name);

  const idx = await c.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'production_event_items' ORDER BY indexname`);

  const after = await c.query(
    `SELECT (SELECT count(*)::int FROM production_events)                 AS events,
            (SELECT count(*)::int FROM production_events
              WHERE status = 'completed')                                 AS completed,
            (SELECT count(*)::int FROM production_event_log)              AS log_entries,
            (SELECT count(*)::int FROM production_event_items)            AS items`);
  console.log('AFTER  —', JSON.stringify(after.rows[0]));
  console.log('        columns:', got.join(', '));
  console.log('        indexes:', idx.rows.map(r => r.indexname).join(', '));

  const missing = EXPECTED_COLS.filter(k => !got.includes(k));
  if (missing.length) { console.error('FAILED: missing columns —', missing.join(', ')); process.exit(1); }

  // The unique index is the rule that makes a resend a SECOND parcel rather than an edit of the
  // first. Without it a replacement collides with the original row and the record that anything
  // went missing is overwritten by the fix for it.
  if (!idx.rows.some(r => r.indexname === 'uq_pei_event_parcel_product')) {
    console.error('FAILED: the per-parcel unique index is missing. A resend would overwrite the original.');
    process.exit(1);
  }

  if (after.rows[0].items !== 0) { console.error('UNEXPECTED: the new table is not empty.'); process.exit(1); }

  // D-2 — additive. Nothing existing is touched.
  for (const k of ['events', 'completed', 'log_entries']) {
    if (after.rows[0][k] !== before.rows[0][k]) {
      console.error(`FAILED: ${k} changed ${before.rows[0][k]} -> ${after.rows[0][k]}. Additive DDL must not touch rows.`);
      process.exit(1);
    }
  }

  console.log('OK — table created, additive, no existing row touched.');
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
