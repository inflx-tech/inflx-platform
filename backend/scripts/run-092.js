'use strict';

/**
 * Apply migration 092 (followers location columns). Additive ADD COLUMN IF NOT
 * EXISTS — idempotent, reversible. PRODUCTION-IMPACTING: founder go.
 * Usage:
 *   ENV_FILE=.env.prod-backup node scripts/run-092.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-092] connected via ${envFile}`);
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/092_follower_location.sql'), 'utf8');
  await c.query(sql);
  console.log('[run-092] applied.');
  const { rows } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='followers' AND column_name IN ('last_lat','last_lng','area_name','location_updated_at')
      ORDER BY column_name`
  );
  console.log(JSON.stringify(rows));
  await c.end();
})().catch((e) => { console.error('[run-092] FAILED:', e.message); process.exit(1); });
