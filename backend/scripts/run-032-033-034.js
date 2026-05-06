'use strict';

/**
 * Apply migrations 032 (brand contact columns) + 033 (follower_bookings
 * booking_type + date_range fields) + 034 (follower_bookings stylist_id +
 * notes) to production Supabase.
 *
 * All three are additive (new columns + relax 2 NOT NULLs in 033) and
 * idempotent. Safe to re-run.
 *
 * Order matters: 032 first (brands), 033 next (follower_bookings type +
 * date_range), 034 last (follower_bookings stylist + notes).
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

  for (const f of [
    '032_brand_contact_columns.sql',
    '033_follower_bookings_type_and_daterange.sql',
    '034_follower_bookings_stylist_and_notes.sql',
  ]) {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
    process.stdout.write(`Running ${f} ... `);
    await c.query(sql);
    console.log('OK');
  }

  // Sanity checks
  const { rows: brandCols } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brands'
      AND column_name IN ('phone','whatsapp_phone')
    ORDER BY column_name
  `);
  console.log('\nbrands new columns:', brandCols.map(r => r.column_name).join(', '));

  const { rows: bookingCols } = await c.query(`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='follower_bookings'
      AND column_name IN ('booking_type','pickup_date','return_date','duration_days','pickup_type','stylist_id','notes','booking_date','booking_time')
    ORDER BY column_name
  `);
  console.log('\nfollower_bookings columns:');
  console.table(bookingCols);

  const { rows: idx } = await c.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='follower_bookings'
      AND indexname IN ('idx_follower_bookings_pickup_date','idx_follower_bookings_stylist')
    ORDER BY indexname
  `);
  console.log('\nfollower_bookings new indexes:', idx.map(r => r.indexname).join(', '));

  await c.end();
  console.log('\n✓ Done\n');
})().catch(e => { console.error('\n✗', e.message); process.exit(1); });
