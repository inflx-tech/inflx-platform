'use strict';

/** Apply migration 144 (COD checkout columns — Stage C3) to PRODUCTION.
 * Loads ../.env.prod-backup. Additive columns with defaults; idempotent.
 * Contract: features/concept-stagec3-checkout/. */

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
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '144_cod_checkout.sql'), 'utf8'));
  const { rows } = await c.query(`
    SELECT count(*) FILTER (WHERE column_name IN ('payment_method','cod_fee'))::int AS cols
      FROM information_schema.columns WHERE table_name = 'follower_orders'`);
  console.log('OK —', rows[0], '(expected cols: 2)');
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
