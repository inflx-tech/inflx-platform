'use strict';

/** Apply migration 143 (follower wishlist + collections — Stage C2) to
 * PRODUCTION. Loads ../.env.prod-backup. Purely additive (3 new tables);
 * idempotent. Contract: features/concept-stagec2-bag-wishlist/. */

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
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '143_follower_wishlist.sql'), 'utf8'));
  const { rows } = await c.query(`
    SELECT count(*)::int AS tables FROM information_schema.tables
     WHERE table_name IN ('follower_wishlist_items','follower_wishlist_collections','follower_wishlist_collection_items')`);
  console.log('OK —', rows[0], '(expected tables: 3)');
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
