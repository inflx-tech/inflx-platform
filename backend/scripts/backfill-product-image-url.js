'use strict';

/**
 * Backfill brand_products.image_url from the variant/facet images for rows where
 * the cover was never derived (contract: product-image-resolution).
 *
 * The read surfaces now resolve the cover at read time, so this is a
 * belt-and-braces data pass: it keeps image_url authoritative (used for sort/
 * perf and any raw reader) and repairs historical rows in one shot.
 *
 * SAFE BY DEFAULT — dry-run unless --commit is passed. Only ever writes rows
 * whose image_url IS NULL/'' and where a real image exists elsewhere; never
 * overwrites an existing image_url; touches nothing else.
 *
 * Usage:
 *   node scripts/backfill-product-image-url.js               # dry-run, prod
 *   node scripts/backfill-product-image-url.js --commit      # write, prod
 *   node scripts/backfill-product-image-url.js --staging --commit
 */

const path = require('path');
const { Client } = require('pg');

const COMMIT = process.argv.includes('--commit');
const STAGING = process.argv.includes('--staging');
const envFile = STAGING ? '.env.staging' : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { resolveProductImage } = require('../src/utils/productImage');

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs || !cs.includes('supabase')) {
    console.error(`ABORT: ${envFile} DATABASE_URL is not a supabase URL.`);
    process.exit(1);
  }
  console.log(`Target: ${cs.replace(/:[^:@]+@/, ':***@')}  (${COMMIT ? 'COMMIT' : 'DRY-RUN'})`);
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows } = await c.query(
    `SELECT id, name, image_url, variants_json, facets
       FROM brand_products
      WHERE image_url IS NULL OR image_url = ''`
  );
  let fixable = 0, noImage = 0;
  const updates = [];
  for (const r of rows) {
    const resolved = resolveProductImage(r);
    if (resolved) { fixable++; updates.push([resolved, r.id, r.name]); }
    else noImage++;
  }
  console.log(`image_url-empty rows: ${rows.length} — fixable: ${fixable}, genuinely image-less: ${noImage}`);
  updates.slice(0, 10).forEach(([u, , name]) => console.log(`  ${name} -> ${u}`));
  if (updates.length > 10) console.log(`  … and ${updates.length - 10} more`);

  if (!COMMIT) { console.log('\nDRY-RUN — pass --commit to write.'); await c.end(); return; }

  let done = 0;
  for (const [url, id] of updates) {
    await c.query(`UPDATE brand_products SET image_url = $1 WHERE id = $2 AND (image_url IS NULL OR image_url = '')`, [url, id]);
    done++;
  }
  console.log(`\nCOMMITTED — ${done} row(s) backfilled.`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
