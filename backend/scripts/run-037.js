'use strict';

/**
 * Apply migration 037 (L2 Campaign Protection Fee — tiered escrow) to the
 * target database. Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/run-037.js          → DATABASE_URL (prod / dev)
 *   node scripts/run-037.js --test   → TEST_DATABASE_URL
 *
 * Per the run-035.js precedent. Additive only — backfills nothing on existing
 * campaigns; in-flight campaigns continue using legacy 8% via the fallback in
 * escrow.service._resolveFeeRate.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const useTestDb = process.argv.includes('--test');
  const connectionString = useTestDb
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

  if (!connectionString) {
    console.error(`✗ ${useTestDb ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} is not set in .env`);
    process.exit(1);
  }

  console.log(`\nTarget: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  const requireSSL = connectionString.includes('supabase.com');
  const c = new Client({
    connectionString,
    ...(requireSSL && { ssl: { rejectUnauthorized: false } }),
  });
  await c.connect();

  const f = '037_l2_escrow_fee_tiers.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // ── Sanity checks ──────────────────────────────────────────────────────────

  const { rows: tableRows } = await c.query(`
    SELECT to_regclass('public.escrow_fee_tiers') AS t
  `);
  console.log(`\nescrow_fee_tiers table: ${tableRows[0].t}`);

  const { rows: tierRows } = await c.query(`
    SELECT tier_key, min_amount_inr, max_amount_inr, fee_pct
    FROM escrow_fee_tiers
    ORDER BY sort_order, min_amount_inr
  `);
  console.log('\nSeeded escrow fee tiers:');
  console.table(tierRows);

  const { rows: campaignCols } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='campaigns'
      AND column_name IN ('escrow_fee_pct_locked', 'escrow_fee_base_inr', 'escrow_fee_locked_at')
    ORDER BY column_name
  `);
  console.log(`\ncampaigns lock cols: ${campaignCols.map(r => r.column_name).join(', ') || 'MISSING'}`);

  const { rows: brandCol } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brands' AND column_name='escrow_fee_override_pct'
  `);
  console.log(`brands.escrow_fee_override_pct: ${brandCol[0]?.column_name || 'MISSING'}`);

  const { rows: renamedCol } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='escrow_entries'
      AND column_name IN ('escrow_fee_amount', 'platform_fee_amount')
    ORDER BY column_name
  `);
  console.log(`escrow_entries fee column: ${renamedCol.map(r => r.column_name).join(', ') || 'MISSING'}`);

  await c.end();
  console.log('\n✓ Done\n');
})().catch(e => { console.error('\n✗', e.message); process.exit(1); });
