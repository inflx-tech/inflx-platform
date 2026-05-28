'use strict';

/**
 * Apply migration 073 — Wave 1 commit 1: per-actor override columns
 * (categories.return_window_days, influencers.tds_*, brands.commerce_commission_override_pct).
 * Idempotent, forward-only.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /\/\/[^@]*@(localhost|127\.0\.0\.1)[:\/]/.test(url);
  const sslMode =
    process.env.PGSSL === 'disable' ? false :
    process.env.PGSSL === 'require' ? { rejectUnauthorized: false } :
    isLocal                          ? false :
                                       { rejectUnauthorized: false };
  const c = new Client({ connectionString: url, ssl: sslMode });
  await c.connect();

  const f = '073_per_actor_overrides.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  console.log('\ncategories with return_window_days:');
  const cat = await c.query(
    `SELECT category_key, name, return_window_days FROM categories ORDER BY sort_order LIMIT 5`
  );
  console.table(cat.rows);

  console.log('\ninfluencers tds columns sample (count + a row):');
  const inf = await c.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE tds_exempt = true)::int AS exempt_count,
            COUNT(*) FILTER (WHERE tds_override_pct IS NOT NULL)::int AS override_count
       FROM influencers`
  );
  console.table(inf.rows);

  console.log('\nbrands commerce_commission_override_pct sample:');
  const br = await c.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE commerce_commission_override_pct IS NOT NULL)::int AS override_count
       FROM brands`
  );
  console.table(br.rows);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
