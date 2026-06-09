'use strict';

/**
 * Apply migration 094 (influencer_store_inventory + follower_transactions
 * .via_store_influencer_id). Additive CREATE TABLE / ADD COLUMN IF NOT EXISTS —
 * idempotent, reversible. PRODUCTION-IMPACTING (DDL) but DORMANT: founder go.
 *   ENV_FILE=.env.prod-backup node scripts/run-094.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-094] connected via ${envFile} → ${(await c.query('SELECT current_database() d')).rows[0].d}`);
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/094_influencer_store.sql'), 'utf8');
  await c.query(sql);
  console.log('[run-094] applied.');
  const { rows } = await c.query(
    `SELECT to_regclass('public.influencer_store_inventory') AS tbl,
            EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='follower_transactions'
                       AND column_name='via_store_influencer_id') AS col`
  );
  console.log('[run-094] verify:', rows[0]);
  await c.end();
})().catch(e => { console.error('[run-094] ERROR', e.message); process.exit(1); });
