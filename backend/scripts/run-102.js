'use strict';

/**
 * Apply migration 102 (categories: one brain — 5 launch tiles + fashion merge +
 * section_config key reconcile). Per the run-101 precedent. Idempotent/reversible.
 * Targets DATABASE_URL (use .env for local, .env.prod-backup for prod).
 * Contract: features/merch-engine-p25a-categories-one-brain.
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

  const f = '102_categories_one_brain.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Verify: no fashion_walkin/online left; the 5 active tiles; reconciled keys.
  const { rows: cats } = await c.query(
    `SELECT category, count(*)::int AS n FROM brands GROUP BY category ORDER BY category`
  );
  console.log('brands by category:'); console.table(cats);

  const { rows: tiles } = await c.query(
    `SELECT key, label, status, sort_order FROM follower_categories ORDER BY sort_order, key`
  );
  console.log('follower_categories:'); console.table(tiles);

  const { rows: sc } = await c.query(
    `SELECT DISTINCT category_key FROM section_config WHERE category_key IS NOT NULL ORDER BY category_key`
  );
  console.log('section_config category_keys:', sc.map(r => r.category_key).join(', ') || '(none)');

  await c.end();
  console.log('Done.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
