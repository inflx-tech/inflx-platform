'use strict';

/**
 * Apply migration 091 (Home 'header' shelf — admin-editable greeting/tagline).
 * INSERT ... ON CONFLICT DO NOTHING — idempotent, reversible. PROD: founder go.
 * Usage:
 *   ENV_FILE=.env.prod-backup node scripts/run-091.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-091] connected via ${envFile}`);
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/091_home_header_greeting.sql'), 'utf8');
  await c.query(sql);
  console.log('[run-091] applied.');
  const { rows } = await c.query(
    `SELECT position, shelf_key, shelf_type, config_json->>'greeting' AS greeting, config_json->>'tagline' AS tagline
       FROM section_config WHERE screen='home' AND shelf_key='header'`
  );
  console.log(JSON.stringify(rows, null, 1));
  await c.end();
})().catch((e) => { console.error('[run-091] FAILED:', e.message); process.exit(1); });
