'use strict';

/**
 * Apply migration 083 — section_config (Section Engine foundation, Phase A).
 * Per run-082.js precedent. Forward-only, idempotent, additive.
 * Contract: features/follower-section-engine/.
 *
 * Creates the section_config table + indexes and seeds the LOCKED catalog
 * defaults at GLOBAL scope. Safe to re-run: CREATE TABLE/INDEX IF NOT EXISTS
 * and INSERT ... ON CONFLICT DO NOTHING (the uniq_section_instance index).
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
  console.log(`Target: ${url.replace(/:[^:@]+@/, ':***@')}`);

  const f = '083_section_config.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // Sanity: table exists + seed landed for every screen.
  const { rows: cols } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'section_config'
      ORDER BY ordinal_position`
  );
  if (cols.length === 0) {
    console.error('\n⚠️  section_config table missing');
    process.exit(2);
  }

  const { rows: counts } = await c.query(
    `SELECT screen, count(*)::int AS shelves,
            count(*) FILTER (WHERE enabled)::int AS enabled
       FROM section_config
      WHERE scope_type = 'global'
      GROUP BY screen ORDER BY screen`
  );
  console.log('\nseeded global shelves per screen:');
  console.table(counts);

  const screens = counts.map(r => r.screen).sort();
  const expected = ['category','creator_category','creator_store','home','offers'];
  const missing = expected.filter(s => !screens.includes(s));
  if (missing.length) {
    console.error(`\n⚠️  missing seed for screens: ${missing.join(', ')}`);
    process.exit(2);
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
