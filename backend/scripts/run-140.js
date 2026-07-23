'use strict';

/** Apply migration 140 (creator posts — Post/Concept P2) to PRODUCTION.
 * Loads ../.env.prod-backup. New tables only (creator_posts, post_media,
 * post_products), all ship empty; idempotent. Contract: features/concept-p2-posts/. */

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
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '140_creator_posts.sql'), 'utf8'));
  const { rows } = await c.query(`
    SELECT to_regclass('public.creator_posts') AS posts,
           to_regclass('public.post_media')    AS media,
           to_regclass('public.post_products') AS products,
           (SELECT count(*)::int FROM creator_posts) AS n`);
  console.log('OK —', rows[0], '(all tables present, 0 rows expected)');
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
