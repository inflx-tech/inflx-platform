'use strict';
/**
 * Apply migration 162 — offer_valid_from on campaign_influencers.
 * Contract: features/stage-2-offers-parity (P4)
 *
 * Founder, 2026-08-27: "keep that start date as well... set date is for all creators... say one
 * individual creator may be work from different time. offer start and end per creator is
 * necessary."
 *
 * One nullable column, no default, no backfill, no constraint that can reject a row. NULL means
 * "no start limit" — the same meaning NULL already carries on offer_valid_until at the other
 * end. Nothing in production carries an offer at all (0 of 6 rows), so there is nothing this
 * could reinterpret.
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS). Safe to re-run.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const SQL = path.join(__dirname, '../migrations/162_creator_offer_valid_from.sql');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const before = await c.query(
    `SELECT count(*)::int rows,
            count(offer_valid_until)::int with_end,
            count(brand_offer_id)::int with_library_offer,
            count(offer_type)::int with_inline_offer,
            (SELECT count(*)::int FROM information_schema.columns
              WHERE table_name = 'campaign_influencers'
                AND column_name = 'offer_valid_from') AS col_before
       FROM campaign_influencers`);
  console.log('BEFORE —', JSON.stringify(before.rows[0]));

  await c.query(fs.readFileSync(SQL, 'utf8'));

  const after = await c.query(
    `SELECT count(*)::int rows,
            count(offer_valid_until)::int with_end,
            count(offer_valid_from)::int with_start,
            count(brand_offer_id)::int with_library_offer,
            count(offer_type)::int with_inline_offer
       FROM campaign_influencers`);
  console.log('AFTER  —', JSON.stringify(after.rows[0]));

  const { rows: [meta] } = await c.query(
    `SELECT data_type, is_nullable,
            col_description('campaign_influencers'::regclass, ordinal_position) AS comment
       FROM information_schema.columns
      WHERE table_name = 'campaign_influencers' AND column_name = 'offer_valid_from'`);
  if (!meta) { console.error('FAILED: the column is not there after the migration.'); process.exit(1); }
  console.log(`        ${meta.data_type}, nullable=${meta.is_nullable}`);
  console.log(`        comment: ${String(meta.comment || '').slice(0, 90)}…`);

  if (meta.is_nullable !== 'YES') { console.error('FAILED: the column must be nullable.'); process.exit(1); }
  if (after.rows[0].with_start !== 0) { console.error('UNEXPECTED: a row already carries a start.'); process.exit(1); }

  // Additive. Nothing existing may move.
  for (const k of ['rows', 'with_end', 'with_library_offer', 'with_inline_offer']) {
    if (after.rows[0][k] !== before.rows[0][k]) {
      console.error(`FAILED: ${k} changed ${before.rows[0][k]} -> ${after.rows[0][k]}.`);
      process.exit(1);
    }
  }

  console.log('OK — column added, nullable, empty, no existing row touched.');
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
