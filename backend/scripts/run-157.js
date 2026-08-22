'use strict';
/**
 * Apply migration 157 — add influencers.profile_image_r2_key.
 * Contract: features/creator-photo-and-reach
 *
 * ADD ONLY. The matching DROP of the duplicate avatar_url is 158, and must not run until
 * the new backend is live — otherwise creator search breaks for whichever version of the
 * code is running against the column that no longer exists.
 */
const { Client } = require('pg');
const fs = require('fs'); const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const cols = async () => (await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='influencers' AND column_name IN ('avatar_url','profile_image_url','profile_image_r2_key')
      ORDER BY 1`)).rows.map(r => r.column_name);

  console.log('BEFORE — photo columns on influencers:', (await cols()).join(', ') || '(none)');

  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/157_creator_photo_consolidate.sql'), 'utf8'));

  console.log('AFTER  — photo columns on influencers:', (await cols()).join(', '));

  // Both columns must exist right now. That overlap is the point: it is what lets the
  // running code and the code about to deploy both work while Render catches up.
  const counts = await c.query(
    `SELECT count(*)::int total, count(avatar_url)::int old_populated,
            count(profile_image_url)::int url_populated,
            count(profile_image_r2_key)::int new_populated FROM influencers`);
  console.log('row counts:', JSON.stringify(counts.rows[0]));
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
