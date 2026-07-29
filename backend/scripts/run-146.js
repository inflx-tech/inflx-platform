'use strict';

/** Apply migration 146 (creator state + search geography) to PRODUCTION.
 * Loads ../.env.prod-backup. Additive column + CREATE OR REPLACE VIEW;
 * idempotent. Contract: features/creator-geo-tagging/ */

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

  // Baseline the city gap BEFORE, so the (C) fix is provable rather than asserted.
  const before = await c.query(
    `SELECT COUNT(*) FILTER (WHERE city IS NOT NULL AND btrim(city) <> '')::int AS with_city
       FROM v_searchable_creators WHERE source = 'onboarded'`
  );

  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '146_creator_state_and_search_geo.sql'), 'utf8'));

  const { rows } = await c.query(`
    SELECT
      (SELECT count(*)::int FROM information_schema.columns
        WHERE table_name = 'creator_profiles' AND column_name = 'state')      AS cp_state_col,
      (SELECT count(*)::int FROM information_schema.columns
        WHERE table_name = 'v_searchable_creators' AND column_name = 'state') AS view_state_col,
      (SELECT count(*) FILTER (WHERE city IS NOT NULL AND btrim(city) <> '')::int
         FROM v_searchable_creators WHERE source = 'onboarded')               AS onboarded_with_city`);

  console.log('OK —', rows[0], '(expected cp_state_col: 1, view_state_col: 1)');
  console.log(`onboarded rows with a city: ${before.rows[0].with_city} -> ${rows[0].onboarded_with_city}`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
