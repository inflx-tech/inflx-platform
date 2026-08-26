'use strict';
/**
 * Apply migration 160 — YouTube reach columns on influencers.
 * Contract: features/admin-creator-review-completeness
 *
 * Eight nullable columns, no default, no constraint, no backfill. Nothing here can
 * reject a row and nothing can be lost, so the guard below is not a safety gate — it
 * is a BEFORE/AFTER record, so the run leaves evidence rather than a silent success.
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS). Safe to re-run.
 */
const { Client } = require('pg');
const fs = require('fs'); const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const COLS = [
  'youtube_channel_id', 'youtube_title', 'youtube_subscribers', 'youtube_views',
  'youtube_videos', 'youtube_thumbnail_url', 'youtube_scrape_data', 'youtube_scrape_last_run',
];

const colQuery = `
  SELECT count(*)::int AS present
    FROM information_schema.columns
   WHERE table_name = 'influencers' AND column_name = ANY($1)`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const before = (await c.query(colQuery, [COLS])).rows[0];
  const { rows: [counts] } = await c.query(
    `SELECT count(*)::int AS influencers,
            count(youtube_handle)::int AS with_youtube_handle
       FROM influencers`);
  console.log('BEFORE — youtube cols present:', before.present, '/', COLS.length,
              '| influencers:', JSON.stringify(counts));

  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/160_influencer_youtube_stats.sql'), 'utf8'));

  const after = (await c.query(colQuery, [COLS])).rows[0];
  const { rows: [g] } = await c.query(
    `SELECT count(*)::int AS total,
            count(youtube_subscribers)::int AS measured,
            count(youtube_handle)::int AS with_youtube_handle
       FROM influencers`);
  console.log('AFTER  — youtube cols present:', after.present, '/', COLS.length,
              '| rows:', g.total, '| with handle:', g.with_youtube_handle, '| measured:', g.measured);

  if (after.present !== COLS.length) { console.error('FAILED: not every column present after migration.'); process.exit(1); }
  if (g.measured !== 0)              { console.error('UNEXPECTED: a row already carries youtube_subscribers.'); process.exit(1); }
  if (g.total !== counts.influencers) {
    console.error('FAILED: influencers row count changed. Additive DDL must not touch rows.');
    process.exit(1);
  }
  if (g.with_youtube_handle !== counts.with_youtube_handle) {
    console.error('FAILED: youtube_handle population changed. Additive DDL must not touch rows.');
    process.exit(1);
  }
  console.log('OK — additive, no row touched, nothing measured yet.');
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
