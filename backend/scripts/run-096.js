'use strict';
/**
 * Apply migration 096 (brands.store_code + product_seq + listing_brands).
 * Additive + idempotent. PRODUCTION-IMPACTING (DDL): founder go.
 *   ENV_FILE=.env.prod-backup node scripts/run-096.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[run-096] connected via ${envFile} → ${(await c.query('SELECT current_database() d')).rows[0].d}`);
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations/096_listing_sku_brands.sql'), 'utf8'));
  const { rows } = await c.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='brands' AND column_name='store_code') AS store_code,
            to_regclass('public.listing_brands') AS listing_brands`);
  console.log('[run-096] applied. verify:', rows[0]);
  await c.end();
})().catch((e) => { console.error('[run-096] ERROR', e.message); process.exit(1); });
