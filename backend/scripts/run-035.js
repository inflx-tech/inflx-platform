'use strict';

/**
 * Apply migration 035 (master_dishes table + brand_products.master_dish_id +
 * phase-1 seed of 129 dishes across 8 cuisines) to production Supabase.
 *
 * Additive only. Per the run-029-030-031.js precedent.
 *
 * The seed is a phase-1 starter set. Admin owns master_dishes content forever
 * via the admin-web CRUD UI landing in the next phase.
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

  const f = '035_master_dishes.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity checks
  const { rows: tableExists } = await c.query(`
    SELECT to_regclass('public.master_dishes') AS t
  `);
  console.log(`\nmaster_dishes table: ${tableExists[0].t}`);

  const { rows: brandCol } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brand_products' AND column_name='master_dish_id'
  `);
  console.log(`brand_products.master_dish_id: ${brandCol[0]?.column_name || 'MISSING'}`);

  const { rows: counts } = await c.query(`
    SELECT cuisine, COUNT(*)::int AS dish_count
    FROM master_dishes
    GROUP BY cuisine
    ORDER BY dish_count DESC, cuisine
  `);
  console.log('\nSeeded dishes per cuisine:');
  console.table(counts);

  const { rows: total } = await c.query(`SELECT COUNT(*)::int AS total FROM master_dishes`);
  console.log(`\nTotal master_dishes rows: ${total[0].total}`);

  const { rows: idx } = await c.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public'
      AND indexname IN ('idx_brand_products_master_dish_id', 'idx_master_dishes_cuisine_section')
    ORDER BY indexname
  `);
  console.log(`\nNew indexes: ${idx.map(r => r.indexname).join(', ')}`);

  await c.end();
  console.log('\n✓ Done\n');
})().catch(e => { console.error('\n✗', e.message); process.exit(1); });
