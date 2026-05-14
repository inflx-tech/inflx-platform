'use strict';

/**
 * Backfill profile pictures from Instagram CDN to our R2 bucket.
 *
 * Iterates every creator_profiles + brand_profiles row that has a
 * `profile_pic_url` but no `profile_pic_r2_key`, downloads the image,
 * uploads it to R2, and persists the key. After this runs, the admin
 * verification queue / invitations queue / campaign wizard all show
 * stable avatars even after the original IG URL expires.
 *
 * Safe to re-run: skips rows that already have profile_pic_r2_key.
 * Use --force to re-cache everything (e.g. after a fresh re-scrape
 * rotated the IG URLs).
 *
 * Usage:
 *   node scripts/backfill-profile-pics.js
 *   node scripts/backfill-profile-pics.js --force
 *   node scripts/backfill-profile-pics.js --limit 5     (dry-ish trial)
 *   node scripts/backfill-profile-pics.js --type brand  (only brands)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../src/config/db');
const { cacheProfilePic } = require('../src/services/imageProxy.service');

(async () => {
  const force = process.argv.includes('--force');
  const limitArgIdx = process.argv.indexOf('--limit');
  const limit = limitArgIdx >= 0 ? parseInt(process.argv[limitArgIdx + 1], 10) : null;
  const typeArgIdx = process.argv.indexOf('--type');
  const typeFilter = typeArgIdx >= 0 ? process.argv[typeArgIdx + 1] : 'all'; // all | creator | brand

  const ranges = [];
  if (typeFilter === 'all' || typeFilter === 'creator') {
    ranges.push({
      type: 'creator',
      table: 'creator_profiles',
      handleCol: 'ig_handle',
    });
  }
  if (typeFilter === 'all' || typeFilter === 'brand') {
    ranges.push({
      type: 'brand',
      table: 'brand_profiles',
      handleCol: 'instagram_handle',
    });
  }

  const summary = { ok: 0, skipped: 0, failed: 0 };
  for (const r of ranges) {
    const whereForce = force ? '' : 'AND profile_pic_r2_key IS NULL';
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const { rows } = await db.query(
      `SELECT ${r.handleCol} AS handle, profile_pic_url
         FROM ${r.table}
        WHERE profile_pic_url IS NOT NULL
          AND profile_pic_url <> ''
          ${whereForce}
        ORDER BY ${r.handleCol}
        ${limitClause}`
    );
    console.log(`\n[${r.type}] ${rows.length} row(s) to process`);

    for (const row of rows) {
      process.stdout.write(`  @${row.handle.padEnd(30)}`);
      const res = await cacheProfilePic({
        targetType: r.type,
        handle: row.handle,
        igUrl: row.profile_pic_url,
      });
      if (res.ok) {
        process.stdout.write(` ✓ → ${res.key}\n`);
        summary.ok++;
      } else if (res.skipped) {
        process.stdout.write(` — skipped (${res.error})\n`);
        summary.skipped++;
      } else {
        process.stdout.write(` ✗ ${res.error}\n`);
        summary.failed++;
      }
    }
  }

  console.log('\nDone:', summary);
  await db.pool.end();
})().catch(e => { console.error('\n✗', e.message, e.stack); process.exit(1); });
