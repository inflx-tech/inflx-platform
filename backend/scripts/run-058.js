'use strict';

/**
 * Apply migration 058 — INFLX Revenue Model schema (Phase A1).
 * Per run-055.js precedent. Forward-only, idempotent, additive.
 * Contract: features/billing-subscriptions-schema/.
 *
 * Creates 5 tables (subscription_tiers, brand_subscriptions,
 * subscription_invoices, categories, attribution_clicks), 4 enums
 * (subscription_status, mandate_status, invoice_status,
 * attribution_path), 7 indexes (incl. partial unique
 * uniq_brand_subs_active), 4 updated_at triggers, 20 seed rows
 * (4 subscription_tiers + 16 categories).
 *
 * Safe to re-run: every CREATE uses IF NOT EXISTS / DO $$ EXCEPTION
 * WHEN duplicate_object / ON CONFLICT DO NOTHING.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const url = process.env.DATABASE_URL || '';
  // Auto-detect: local Postgres (Docker on localhost) does not speak SSL;
  // Supabase/prod requires it. Override with PGSSL=disable / PGSSL=require.
  const isLocal = /\/\/[^@]*@(localhost|127\.0\.0\.1)[:\/]/.test(url);
  const sslMode =
    process.env.PGSSL === 'disable' ? false :
    process.env.PGSSL === 'require' ? { rejectUnauthorized: false } :
    isLocal                          ? false :
                                       { rejectUnauthorized: false };
  const c = new Client({ connectionString: url, ssl: sslMode });
  await c.connect();

  const f = '058_billing_subscriptions.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // ── Sanity probes ─────────────────────────────────────────────────────────

  // 5 new tables present
  const { rows: tbls } = await c.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('subscription_tiers','brand_subscriptions',
                           'subscription_invoices','categories','attribution_clicks')
      ORDER BY table_name`
  );
  console.log(`\nTables created (${tbls.length}/5):`);
  console.table(tbls);
  if (tbls.length !== 5) {
    console.error(`\n⚠️  Expected 5 tables — got ${tbls.length}`);
    process.exit(2);
  }

  // 4 new enums present
  const { rows: enums } = await c.query(
    `SELECT typname
       FROM pg_type
      WHERE typname IN ('subscription_status','mandate_status','invoice_status','attribution_path')
        AND typtype = 'e'
      ORDER BY typname`
  );
  console.log(`\nEnums created (${enums.length}/4):`);
  console.table(enums);
  if (enums.length !== 4) {
    console.error(`\n⚠️  Expected 4 enums — got ${enums.length}`);
    process.exit(2);
  }

  // subscription_tiers seed (4 rows)
  const { rows: tiers } = await c.query(
    `SELECT tier_key, monthly_price_inr, max_campaigns, max_products
       FROM subscription_tiers ORDER BY sort_order`
  );
  console.log(`\nsubscription_tiers seed (${tiers.length}/4):`);
  console.table(tiers);
  if (tiers.length !== 4) {
    console.error(`\n⚠️  Expected 4 tier rows — got ${tiers.length}`);
    process.exit(2);
  }

  // categories seed (16 rows)
  const { rows: cats } = await c.query(
    `SELECT category_key, label, path_a_pct, path_b_pct, path_c_pct
       FROM categories ORDER BY sort_order`
  );
  console.log(`\ncategories seed (${cats.length}/16):`);
  console.table(cats);
  if (cats.length !== 16) {
    console.error(`\n⚠️  Expected 16 category rows — got ${cats.length}`);
    process.exit(2);
  }

  // Partial unique index for active subscription
  const { rows: uniq } = await c.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'uniq_brand_subs_active'`
  );
  console.log(`\nuniq_brand_subs_active (${uniq.length}/1):`);
  console.table(uniq);
  // Postgres echoes the predicate with the enum type cast: WHERE (status = 'active'::subscription_status)
  if (uniq.length !== 1 || !/WHERE \(status = 'active'(?:::subscription_status)?\)/i.test(uniq[0].indexdef)) {
    console.error('\n⚠️  uniq_brand_subs_active partial unique index missing or wrong predicate');
    process.exit(2);
  }

  // Empty tables (no backfill)
  const { rows: counts } = await c.query(
    `SELECT
       (SELECT COUNT(*) FROM brand_subscriptions)    AS brand_subscriptions,
       (SELECT COUNT(*) FROM subscription_invoices)  AS subscription_invoices,
       (SELECT COUNT(*) FROM attribution_clicks)     AS attribution_clicks`
  );
  console.log('\nRuntime tables (expected 0/0/0):');
  console.table(counts);
  if (Number(counts[0].brand_subscriptions)   !== 0 ||
      Number(counts[0].subscription_invoices) !== 0 ||
      Number(counts[0].attribution_clicks)    !== 0) {
    console.error('\n⚠️  Expected runtime tables empty (no backfill in A1)');
    process.exit(2);
  }

  // Sanity: PathA >= PathB AND PathA >= PathC for every seeded category
  // (direct path should always be priced highest; warn if not, do not fail).
  const { rows: bad } = await c.query(
    `SELECT category_key, path_a_pct, path_b_pct, path_c_pct
       FROM categories
      WHERE path_a_pct < path_b_pct OR path_a_pct < path_c_pct`
  );
  if (bad.length) {
    console.warn(`\n⚠️  WARN: ${bad.length} categories have Path A < B or A < C — confirm intentional:`);
    console.table(bad);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
