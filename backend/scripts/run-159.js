'use strict';
/**
 * Apply migration 159 — campaign_sets.channels_json.
 * Contract: features/stage-2-build-a-campaign-from-the-phone (slice 2)
 *
 * Purely additive: one nullable JSONB column, no default, no constraint, no backfill.
 * There is nothing this can reject and nothing it can lose, so the guard here is not a
 * safety gate — it is a BEFORE/AFTER record, so the run leaves evidence rather than a
 * silent success.
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS). Safe to re-run.
 */
const { Client } = require('pg');
const fs = require('fs'); const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const colQuery = `
  SELECT count(*)::int AS present
    FROM information_schema.columns
   WHERE table_name = 'campaign_sets' AND column_name = 'channels_json'`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const before = (await c.query(colQuery)).rows[0];
  const { rows: [counts] } = await c.query(
    `SELECT count(*)::int AS sets,
            count(*) FILTER (WHERE goal = 'conversion')::int AS sales_sets
       FROM campaign_sets`);
  console.log('BEFORE — channels_json present:', before.present, '| campaign_sets:', JSON.stringify(counts));

  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/159_campaign_set_channels.sql'), 'utf8'));

  const after = (await c.query(colQuery)).rows[0];
  const { rows: [g] } = await c.query(
    `SELECT count(*)::int AS total, count(channels_json)::int AS stated FROM campaign_sets`);
  console.log('AFTER  — channels_json present:', after.present, '| rows:', g.total, '| stated:', g.stated);

  if (after.present !== 1) { console.error('FAILED: column not present after migration.'); process.exit(1); }
  if (g.stated !== 0)      { console.error('UNEXPECTED: a row already carries channels_json.'); process.exit(1); }
  if (g.total !== counts.sets) {
    console.error('FAILED: campaign_sets row count changed. Additive DDL must not touch rows.');
    process.exit(1);
  }
  console.log('OK — additive, no row touched, nothing stated yet.');
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
