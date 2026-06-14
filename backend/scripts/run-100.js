'use strict';

/**
 * Apply migration 100 (follower_categories + seed of the 7 current tiles).
 * Per the run-099 precedent. Additive + idempotent.
 * Targets DATABASE_URL — point .env at the intended environment.
 * Contract: features/merch-engine-p1b-category-admin.
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

  const f = '100_follower_categories.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(`
    SELECT key, label, icon, sort_order, status, array_length(member_categories, 1) AS members
      FROM follower_categories ORDER BY sort_order
  `);
  console.log('\nfollower_categories seed:');
  console.table(rows);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
