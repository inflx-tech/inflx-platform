'use strict';
/** Apply migrations 153 + 154 to the target in DATABASE_URL. Contract: features/stage-0-clear-the-decks */
const { Client } = require('pg');
const fs = require('fs'); const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  for (const f of ['153_one_number_many_roles.sql', '154_test_phone_allowlist.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
    process.stdout.write(`applying ${f} … `);
    await c.query(sql);
    console.log('ok');
  }
  const { rows } = await c.query(
    `SELECT conname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      WHERE t.relname='users' AND c.contype='u' ORDER BY 1`);
  console.log('users unique constraints now:', rows.map(r => r.conname).join(', '));
  const { rows: t } = await c.query(`SELECT to_regclass('public.test_phone_numbers') AS t`);
  console.log('test_phone_numbers:', t[0].t ? 'created' : 'MISSING');
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
