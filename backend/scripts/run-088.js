'use strict';

/**
 * Apply migration 088 (Category screen → listing-driven discovery) to the DB the
 * active env points at. UPDATE-only on section_config — idempotent, reversible.
 *
 * PRODUCTION-IMPACTING: run against prod only after explicit founder go.
 * Usage:
 *   node scripts/run-088.js                                   # local (.env)
 *   ENV_FILE=.env.prod-backup node scripts/run-088.js         # prod
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-088] connected via ${envFile}`);

  const sql = fs.readFileSync(path.join(__dirname, '../migrations/088_section_config_listing_discovery.sql'), 'utf8');
  await c.query(sql);
  console.log('[run-088] applied.');

  // Sanity — show the category shelves now in effect.
  const { rows } = await c.query(
    `SELECT shelf_key, rule, item_type, enabled, position
       FROM section_config WHERE screen='category' ORDER BY position`
  );
  console.log('[run-088] category shelves now:');
  console.log(JSON.stringify(rows, null, 1));
  await c.end();
})().catch((e) => { console.error('[run-088] FAILED:', e.message); process.exit(1); });
