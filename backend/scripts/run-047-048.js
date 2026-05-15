'use strict';

/**
 * Apply migrations 047 + 048 (Fashion-1 foundation) to production Supabase.
 *
 * 047: product_variants table + brand_products.return_policy_days column
 * 048: follower_returns table + return_status/return_reason enums + indexes
 *
 * Per the run-029-030-031.js / run-035.js precedent. Both additive.
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

  for (const f of ['047_product_variants.sql', '048_follower_returns.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
    process.stdout.write(`Running ${f} ... `);
    await c.query(sql);
    console.log('OK');
  }

  // Sanity checks
  const { rows: variantsTable } = await c.query(`SELECT to_regclass('public.product_variants') AS t`);
  console.log(`\nproduct_variants table:  ${variantsTable[0].t}`);

  const { rows: returnsTable } = await c.query(`SELECT to_regclass('public.follower_returns') AS t`);
  console.log(`follower_returns table:  ${returnsTable[0].t}`);

  const { rows: retCol } = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brand_products' AND column_name='return_policy_days'
  `);
  console.log(`brand_products.return_policy_days: ${retCol[0]?.column_name || 'MISSING'} (${retCol[0]?.data_type || ''})`);

  const { rows: enums } = await c.query(`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
      FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname IN ('return_status', 'return_reason')
     GROUP BY t.typname
  `);
  console.log('\nEnums:');
  for (const r of enums) console.log(`  ${r.typname}: [${r.values.join(', ')}]`);

  const { rows: indexes } = await c.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public'
      AND tablename IN ('product_variants', 'follower_returns')
    ORDER BY tablename, indexname
  `);
  console.log('\nIndexes:');
  for (const i of indexes) console.log(`  ${i.indexname}`);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
