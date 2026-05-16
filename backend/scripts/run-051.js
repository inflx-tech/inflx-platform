'use strict';

/**
 * Apply migration 051 (restaurant Dineout refresh — Wave 1 hot brand fields).
 * Per the run-050.js precedent. Additive only.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const NEW_BRAND_COLUMNS = [
  'vibes', 'cost_for_two', 'locality', 'cover_image_url',
  'lat', 'lng', 'formatted_address',
  'outdoor_seating', 'kids_welcome', 'wheelchair_accessible', 'wifi',
  'accepts_table_booking', 'pay_at_store_supported',
  'online_order_supported', 'enquiry_enabled',
];

const NEW_INDEXES = [
  'idx_brands_category_geo',
  'idx_brands_cost_for_two',
  'idx_brands_vibes_gin',
  'idx_brands_locality_lower',
];

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const f = '051_restaurant_dining_fields.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity check — confirm every new column landed
  const { rows: cols } = await c.query(
    `SELECT column_name, data_type, column_default
     FROM   information_schema.columns
     WHERE  table_schema = 'public' AND table_name = 'brands'
       AND  column_name = ANY($1::text[])
     ORDER  BY column_name`,
    [NEW_BRAND_COLUMNS]
  );
  console.log('\nbrands new columns (' + cols.length + ' / ' + NEW_BRAND_COLUMNS.length + '):');
  console.table(cols);

  // Sanity check — confirm every new index landed
  const { rows: idx } = await c.query(
    `SELECT indexname FROM pg_indexes
     WHERE  schemaname = 'public' AND tablename = 'brands'
       AND  indexname = ANY($1::text[])
     ORDER  BY indexname`,
    [NEW_INDEXES]
  );
  console.log('\nNew indexes (' + idx.length + ' / ' + NEW_INDEXES.length + '):');
  for (const i of idx) console.log(`  ${i.indexname}`);

  // Soft-fail loud if any expected addition is missing
  const missingCols = NEW_BRAND_COLUMNS.filter(
    name => !cols.find(r => r.column_name === name)
  );
  const missingIdx = NEW_INDEXES.filter(
    name => !idx.find(r => r.indexname === name)
  );
  if (missingCols.length || missingIdx.length) {
    console.error('\n⚠️  Migration did not produce all expected additions:');
    if (missingCols.length) console.error('  Missing columns: ' + missingCols.join(', '));
    if (missingIdx.length)  console.error('  Missing indexes: ' + missingIdx.join(', '));
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
