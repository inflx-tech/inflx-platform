'use strict';

/** Apply migration 054 (follower_wallet_ledger — Path C-2). Additive. */

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

  const f = '054_follower_wallet_ledger.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows: cols } = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='follower_wallet_ledger'
      ORDER BY ordinal_position`
  );
  console.log(`\nfollower_wallet_ledger columns (${cols.length}):`);
  console.table(cols);

  if (cols.length < 10) {
    console.error('\n⚠️  Expected 10 columns — got', cols.length);
    process.exit(2);
  }
  await c.end();
  console.log('\nDone.');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
