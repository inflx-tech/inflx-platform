'use strict';

/** Apply migration 137 (brand_products.display_image_source_influencer_id —
 * Phase 7a) to PRODUCTION. Loads ../.env.prod-backup. Additive column, all
 * existing rows keep NULL. Run AFTER run-136.js. Contract: features/creator-imagery/. */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs || !cs.includes('supabase')) { console.error('ABORT: not prod (.env.prod-backup).'); process.exit(1); }
  console.log(`Target: ${cs.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '137_brand_products_display_source.sql'), 'utf8'));
  const { rows } = await c.query(`SELECT count(*)::int AS n FROM brand_products WHERE display_image_source_influencer_id IS NOT NULL`);
  console.log(`OK — products with a creator display source: ${rows[0].n} (expected 0 — every row keeps its own image)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
