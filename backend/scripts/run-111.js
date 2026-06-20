'use strict';

/**
 * Apply migration 111 (add image_url to follower_categories — taxonomy
 * convergence) to PRODUCTION Supabase. Loads ../.env.prod-backup. Additive +
 * idempotent (ADD COLUMN IF NOT EXISTS). Re-runnable.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !connectionString.includes('supabase')) {
    console.error('ABORT: .env.prod-backup DATABASE_URL is not a supabase (prod) URL.');
    process.exit(1);
  }
  console.log(`Target: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const f = '111_follower_categories_image.sql';
  process.stdout.write(`Running ${f} ... `);
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
  console.log('OK');

  const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='follower_categories' AND column_name='image_url'`);
  console.log('image_url present:', cols.rows.length === 1);
  await c.end();
  console.log('Done.');
})().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
