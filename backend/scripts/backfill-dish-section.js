'use strict';

/**
 * One-time backfill — restaurant dishes whose `section` is NULL/empty get it
 * from the linked master dish (`master_dishes.section` via `master_dish_id`).
 *
 * WHY: restaurant.json storage_format previously mapped the dish section into
 * an ignored `category` payload key (fixed in 2b7837f), so dishes created
 * before the fix saved with section=NULL and showed "Uncategorized".
 *
 * SAFE: read-first (prints how many rows WOULD change), only touches rows with
 * a master_dish_id and a missing section. Idempotent — re-running is a no-op.
 *
 * PRODUCTION-IMPACTING: run against prod only after explicit founder go.
 * Usage:
 *   node scripts/backfill-dish-section.js            # uses .env (local)
 *   ENV_FILE=.env.prod-backup node scripts/backfill-dish-section.js  # prod
 */

const { Client } = require('pg');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  console.log(`[backfill-dish-section] connected via ${envFile}`);

  const PREVIEW = `
    SELECT COUNT(*)::int AS n
      FROM brand_products bp
      JOIN master_dishes md ON md.id = bp.master_dish_id
     WHERE bp.master_dish_id IS NOT NULL
       AND (bp.section IS NULL OR bp.section = '')
       AND md.section IS NOT NULL AND md.section <> ''`;
  const { rows: [{ n }] } = await c.query(PREVIEW);
  console.log(`[backfill-dish-section] rows that WILL be updated: ${n}`);

  if (n === 0) {
    console.log('[backfill-dish-section] nothing to do — exiting.');
    await c.end();
    return;
  }

  const UPDATE = `
    UPDATE brand_products bp
       SET section = md.section, updated_at = now()
      FROM master_dishes md
     WHERE md.id = bp.master_dish_id
       AND bp.master_dish_id IS NOT NULL
       AND (bp.section IS NULL OR bp.section = '')
       AND md.section IS NOT NULL AND md.section <> ''`;
  const res = await c.query(UPDATE);
  console.log(`[backfill-dish-section] updated ${res.rowCount} dish row(s).`);

  // Show the remaining still-uncategorised (custom dishes w/o master link) for transparency.
  const { rows: [{ n: leftover }] } = await c.query(
    `SELECT COUNT(*)::int AS n FROM brand_products
      WHERE (section IS NULL OR section = '') AND master_dish_id IS NULL`
  );
  console.log(`[backfill-dish-section] still uncategorised (custom dishes, no master link): ${leftover}`);

  await c.end();
  console.log('[backfill-dish-section] done.');
})().catch((e) => { console.error('[backfill-dish-section] FAILED:', e.message); process.exit(1); });
