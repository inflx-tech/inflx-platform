'use strict';

/**
 * Apply migration 061 — Phase A10 features catalog + tier_features + subscription_prices.
 * Per run-060.js precedent. Additive, idempotent, forward-only.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /\/\/[^@]*@(localhost|127\.0\.0\.1)[:\/]/.test(url);
  const sslMode =
    process.env.PGSSL === 'disable' ? false :
    process.env.PGSSL === 'require' ? { rejectUnauthorized: false } :
    isLocal                          ? false :
                                       { rejectUnauthorized: false };
  const c = new Client({ connectionString: url, ssl: sslMode });
  await c.connect();

  const f = '061_features_and_prices.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // ── Sanity probes ─────────────────────────────────────────────────────────

  // 3 new tables present
  const { rows: tbls } = await c.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('features','tier_features','subscription_prices')
      ORDER BY table_name`
  );
  console.log(`\nTables (${tbls.length}/3):`); console.table(tbls);
  if (tbls.length !== 3) { console.error('Expected 3 tables'); process.exit(2); }

  // 3 new enums
  const { rows: enums } = await c.query(
    `SELECT typname FROM pg_type WHERE typname IN ('feature_type','feature_category','billing_period') AND typtype='e' ORDER BY typname`
  );
  console.log(`\nEnums (${enums.length}/3):`); console.table(enums);
  if (enums.length !== 3) { console.error('Expected 3 enums'); process.exit(2); }

  // 13 catalog rows
  const { rows: feats } = await c.query(
    `SELECT feature_key, category, feature_type, default_quota FROM features ORDER BY sort_order`
  );
  console.log(`\nfeatures seed (${feats.length}/13):`); console.table(feats);
  if (feats.length !== 13) { console.error('Expected 13 feature rows'); process.exit(2); }

  // tier_features: each tier × each feature should have a row (4 × 13 = 52)
  const { rows: tfCount } = await c.query(
    `SELECT t.tier_key, COUNT(*) AS rows, COUNT(*) FILTER (WHERE included) AS included
       FROM subscription_tiers t
       LEFT JOIN tier_features tf ON tf.tier_id = t.id
      WHERE t.tier_key IN ('free','growth','pro','enterprise')
      GROUP BY t.tier_key
      ORDER BY t.tier_key`
  );
  console.log(`\ntier_features by tier:`); console.table(tfCount);

  // subscription_prices: one monthly per tier (4 rows)
  const { rows: prices } = await c.query(
    `SELECT t.tier_key, sp.billing_period, sp.price_inr, sp.active
       FROM subscription_prices sp
       JOIN subscription_tiers t ON t.id = sp.tier_id
      ORDER BY t.sort_order, sp.billing_period`
  );
  console.log(`\nsubscription_prices seed (${prices.length}/4):`); console.table(prices);
  if (prices.length < 4) { console.error('Expected at least 4 price rows (one monthly per tier)'); process.exit(2); }

  // brand_subscriptions backfill check
  const { rows: bsBackfill } = await c.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE subscription_price_id IS NOT NULL)::int AS with_price,
            COUNT(*) FILTER (WHERE subscription_price_id IS NULL)::int AS without_price
       FROM brand_subscriptions WHERE status='active'`
  );
  console.log(`\nactive brand_subscriptions backfill:`); console.table(bsBackfill);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
