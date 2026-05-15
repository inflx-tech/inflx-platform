'use strict';

/**
 * Apply migration 050 (conversion-flow attribution columns).
 * Per the run-029-030-031.js / run-035.js / run-049.js precedent.
 * Additive only.
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

  const f = '050_conversion_attribution.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity checks
  const { rows: ftCols } = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='follower_transactions'
      AND column_name IN ('variant_id', 'offer_type', 'prebook_booking_id')
    ORDER BY column_name
  `);
  console.log('\nfollower_transactions new columns:');
  console.table(ftCols);

  const { rows: fbCols } = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='follower_bookings'
      AND column_name = 'at_venue_discount_pct'
  `);
  console.log('\nfollower_bookings new column:');
  console.table(fbCols);

  const { rows: idx } = await c.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='follower_transactions'
      AND indexname IN ('idx_ft_variant', 'idx_ft_offer_type', 'idx_ft_prebook_link')
    ORDER BY indexname
  `);
  console.log('\nNew indexes:');
  for (const i of idx) console.log(`  ${i.indexname}`);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
