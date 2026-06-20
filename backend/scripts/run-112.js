'use strict';

/**
 * Apply migration 112 (commerce settlement hold + influencer ledger) to PRODUCTION.
 * Loads ../.env.prod-backup explicitly. Additive + idempotent. The backfill marks
 * legacy already-paid rows (tcs_amount NOT NULL) as 'settled' so the new
 * commerce-settlement job never re-pays historical orders.
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

  const f = '112_commerce_settlement_hold_and_ledger.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: ftCols } = await c.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='follower_transactions'
       AND column_name IN ('brand_settlement_status','brand_settled_at','commission_reversed','brand_net_reversed')
     ORDER BY column_name`);
  console.log('\nfollower_transactions new columns:'); console.table(ftCols);

  const { rows: frCols } = await c.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='follower_returns'
       AND column_name IN ('reversed_commission','reversed_at') ORDER BY column_name`);
  console.log('\nfollower_returns new columns:'); console.table(frCols);

  const { rows: led } = await c.query(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name='influencer_ledger'`);
  console.log('\ninfluencer_ledger table:'); console.table(led);

  const { rows: bf } = await c.query(`
    SELECT brand_settlement_status, COUNT(*)::int AS n
      FROM follower_transactions GROUP BY brand_settlement_status ORDER BY brand_settlement_status`);
  console.log('\nbrand_settlement_status distribution (legacy paid rows must be settled):');
  console.table(bf);

  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
