'use strict';

/**
 * Apply migration 087 (dish search + custom-name flywheel) to the DB the
 * active .env points at. Additive only — per the run-035.js precedent.
 *
 * PRODUCTION-IMPACTING: only run against prod after explicit founder go
 * (swap .env to the prod connection first, per project migration mechanism).
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

  const f = '087_dish_search_flywheel.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // ── Sanity checks ──────────────────────────────────────────────────────────
  const { rows: ext } = await c.query(
    `SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm','unaccent') ORDER BY extname`
  );
  console.log(`extensions: ${ext.map(r => r.extname).join(', ') || 'MISSING'}`);

  const { rows: col } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='master_dishes' AND column_name='popularity_rank'
  `);
  console.log(`master_dishes.popularity_rank: ${col[0]?.column_name || 'MISSING'}`);

  for (const t of ['dish_aliases', 'pending_dishes']) {
    const { rows } = await c.query(`SELECT to_regclass($1) AS t`, [`public.${t}`]);
    console.log(`${t} table: ${rows[0].t || 'MISSING'}`);
  }

  const { rows: idx } = await c.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public'
      AND indexname IN ('idx_master_dishes_name_trgm','idx_dish_aliases_text_trgm',
                        'idx_pending_dishes_status','uq_pending_dishes_brand_product')
    ORDER BY indexname
  `);
  console.log(`indexes: ${idx.map(r => r.indexname).join(', ')}`);

  // additive guard — existing dictionary untouched
  const { rows: total } = await c.query(`SELECT COUNT(*)::int AS n FROM master_dishes`);
  console.log(`master_dishes rows (unchanged): ${total[0].n}`);

  await c.end();
  console.log('\n✓ Done\n');
})().catch(e => { console.error('\n✗', e.message); process.exit(1); });
