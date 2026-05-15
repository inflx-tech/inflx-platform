'use strict';

/**
 * Apply migration 046 (follower_transactions.product_id + partial index) to
 * production Supabase.
 *
 * Per the run-029-030-031.js / run-035.js precedent — one-off script, not
 * routed through the broken migrate.js (which stops working past 013).
 *
 * Additive only. Column is nullable; existing rows remain null. New writes
 * populate product_id when (a) mobile sends it explicitly, or (b) the
 * offer's products_json has exactly one product. See migration SQL comment
 * for the resolution model.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const f = '046_follower_tx_product_attribution.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity checks
  const { rows: col } = await c.query(`
    SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='follower_transactions'
       AND column_name='product_id'
  `);
  console.log('\nfollower_transactions.product_id:');
  console.table(col);

  const { rows: idx } = await c.query(`
    SELECT indexname, indexdef
      FROM pg_indexes
     WHERE schemaname='public'
       AND tablename='follower_transactions'
       AND indexname='idx_ft_product_attributed'
  `);
  console.log('\nidx_ft_product_attributed:');
  console.table(idx);

  // Row counts — should all be null right after migration
  const { rows: counts } = await c.query(`
    SELECT
      COUNT(*)::int AS total_rows,
      COUNT(product_id)::int AS product_attributed,
      COUNT(*) FILTER (WHERE campaign_influencer_id IS NOT NULL)::int AS creator_attributed
    FROM follower_transactions
  `);
  console.log('\nfollower_transactions row counts:');
  console.table(counts);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
