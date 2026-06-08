'use strict';

/**
 * Apply migration 089 (Home → listing-driven shelves). UPDATE-only on
 * section_config — idempotent, reversible. PRODUCTION-IMPACTING: founder go.
 * Usage:
 *   ENV_FILE=.env.prod-backup node scripts/run-089.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-089] connected via ${envFile}`);
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/089_home_listing_discovery.sql'), 'utf8');
  await c.query(sql);
  console.log('[run-089] applied.');
  const { rows } = await c.query(
    `SELECT position, title, rule, item_type, category_key, enabled
       FROM section_config WHERE screen='home' AND position IN (5,6,8) ORDER BY position`
  );
  console.log(JSON.stringify(rows, null, 1));
  await c.end();
})().catch((e) => { console.error('[run-089] FAILED:', e.message); process.exit(1); });
