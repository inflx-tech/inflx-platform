'use strict';

/**
 * Apply migration 103 (section_library). Per the run-102 precedent. Additive +
 * idempotent. Targets DATABASE_URL (.env local / .env.prod-backup prod).
 * Contract: features/merch-engine-p3a-section-library-engine.
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

  const f = '103_section_library.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  const { rows } = await c.query(
    `SELECT to_regclass('public.section_library') AS tbl,
            (SELECT count(*)::int FROM section_library) AS rows`
  );
  console.log('section_library:', rows[0]);

  await c.end();
  console.log('Done.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
