'use strict';

/** Apply migration 142 (post eligibility cache — Post/Concept P4) to PRODUCTION.
 * Loads ../.env.prod-backup. Additive columns on creator_posts (all NULL on
 * existing rows = treated visible until first sweep); idempotent.
 * Contract: features/concept-p4-eligibility/. */

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
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '142_post_eligibility.sql'), 'utf8'));
  const { rows } = await c.query(`
    SELECT count(*) FILTER (WHERE column_name IN
      ('eligible_product_count','eligibility_checked_at','went_dark_at'))::int AS cols
      FROM information_schema.columns WHERE table_name = 'creator_posts'`);
  console.log('OK —', rows[0], '(expected cols: 3)');
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
