'use strict';

/**
 * Apply migration 052 (brand booking review workflow — Wave 2).
 * Per the run-051.js precedent. Additive only.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const NEW_COLUMNS = [
  'brand_status', 'brand_confirmed_at', 'brand_rejected_at', 'brand_review_note',
];

const NEW_INDEXES = [
  'idx_follower_bookings_brand_status',
];

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const f = '052_brand_booking_review.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(
    `SELECT column_name, data_type, column_default
     FROM   information_schema.columns
     WHERE  table_schema = 'public' AND table_name = 'follower_bookings'
       AND  column_name = ANY($1::text[])
     ORDER  BY column_name`,
    [NEW_COLUMNS]
  );
  console.log('\nfollower_bookings new columns (' + cols.length + ' / ' + NEW_COLUMNS.length + '):');
  console.table(cols);

  const { rows: idx } = await c.query(
    `SELECT indexname FROM pg_indexes
     WHERE  schemaname = 'public' AND tablename = 'follower_bookings'
       AND  indexname = ANY($1::text[])
     ORDER  BY indexname`,
    [NEW_INDEXES]
  );
  console.log('\nNew indexes (' + idx.length + ' / ' + NEW_INDEXES.length + '):');
  for (const i of idx) console.log(`  ${i.indexname}`);

  const missingCols = NEW_COLUMNS.filter(name => !cols.find(r => r.column_name === name));
  const missingIdx  = NEW_INDEXES.filter(name => !idx.find(r => r.indexname === name));
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
