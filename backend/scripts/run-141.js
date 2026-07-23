'use strict';

/** Apply migration 141 (post globals — app config + likes/saves) to PRODUCTION.
 * Loads ../.env.prod-backup. New tables + one seeded config row; idempotent.
 * Contract: features/concept-p3-post-globals/. */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs || !cs.includes('supabase')) { console.error('ABORT: not prod (.env.prod-backup).'); process.exit(1); }
  console.log(`Target: ${cs.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '141_post_globals.sql'), 'utf8'));
  const { rows } = await c.query(`
    SELECT (SELECT config FROM follower_app_config WHERE id = 1) AS config,
           to_regclass('public.post_likes') AS likes,
           to_regclass('public.post_saves') AS saves`);
  console.log('OK —', rows[0]);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
