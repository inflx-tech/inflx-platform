'use strict';

/**
 * Apply migration 093 (follower_addresses += lat/lng). Additive ADD COLUMN IF NOT
 * EXISTS — idempotent, reversible. PRODUCTION-IMPACTING: founder go.
 *   ENV_FILE=.env.prod-backup node scripts/run-093.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-093] connected via ${envFile}`);
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/093_follower_address_coords.sql'), 'utf8');
  await c.query(sql);
  console.log('[run-093] applied.');
  const { rows } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='follower_addresses' AND column_name IN ('lat','lng') ORDER BY column_name`
  );
  console.log(JSON.stringify(rows));
  await c.end();
})().catch((e) => { console.error('[run-093] FAILED:', e.message); process.exit(1); });
