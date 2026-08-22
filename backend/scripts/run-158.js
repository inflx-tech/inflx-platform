'use strict';
/**
 * Apply migration 158 — DROP the duplicate influencers.avatar_url.
 * Contract: features/creator-photo-and-reach
 *
 * DESTRUCTIVE, and deliberately gated. Refuses to run unless BOTH are true:
 *   1. the column is still empty (it has never held a value)
 *   2. the replacement column exists (so nothing is left with nowhere to read from)
 *
 * Run only after the new backend is live and creator search has been confirmed
 * working — see 157 for why the add and the drop are separate.
 */
const { Client } = require('pg');
const fs = require('fs'); const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows: [g] } = await c.query(
    `SELECT count(*)::int total,
            count(avatar_url)::int populated,
            (SELECT count(*)::int FROM information_schema.columns
              WHERE table_name='influencers' AND column_name='profile_image_r2_key') AS replacement`
      + ` FROM influencers`);
  console.log('guard:', JSON.stringify(g));

  if (g.populated > 0) {
    console.error(`REFUSING: avatar_url holds ${g.populated} value(s). Migrate them before dropping.`);
    process.exit(1);
  }
  if (g.replacement === 0) {
    console.error('REFUSING: profile_image_r2_key does not exist. Run 157 first.');
    process.exit(1);
  }

  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/158_drop_duplicate_avatar_url.sql'), 'utf8'));

  const after = (await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='influencers' AND column_name LIKE '%image%' OR column_name='avatar_url'
      ORDER BY 1`)).rows.map(r => r.column_name);
  console.log('AFTER — photo columns on influencers:', after.join(', '));
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
