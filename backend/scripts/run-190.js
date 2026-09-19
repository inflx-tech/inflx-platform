#!/usr/bin/env node
/**
 * Migration 190 — creator-distance-and-visit-preference: one coordinate per offered city.
 * Usage: node scripts/run-190.js --dry | --apply   [--env=.env]
 */
const fs = require('fs');
const path = require('path');
const envArg = process.argv.find(a => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
if (!apply && !dry) { console.error('Pass --dry or --apply.'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }
if (apply && /localhost|127\.0\.0\.1/.test(url)) { console.error('--apply refuses a localhost DATABASE_URL.'); process.exit(2); }
console.log('Target:', url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:****@'));

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const has = !!(await one(`SELECT 1 AS v FROM information_schema.columns WHERE table_name='ref_cities' AND column_name='lat'`));
  console.log('offered cities:', (await one(`SELECT count(*)::int n FROM ref_cities WHERE is_offered`)).n, '· lat column exists:', has);
  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }
  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '190_city_coordinates.sql'), 'utf8'));
  console.log('\nAPPLIED.');
  const after = {
    offered_with_coords: (await one(`SELECT count(*)::int n FROM ref_cities WHERE is_offered AND lat IS NOT NULL AND lng IS NOT NULL`)).n,
    offered_without: (await one(`SELECT count(*)::int n FROM ref_cities WHERE is_offered AND (lat IS NULL OR lng IS NULL)`)).n,
    sample_vijayawada_guntur_km: (await one(`SELECT round((6371 * acos(least(1, cos(radians(a.lat))*cos(radians(b.lat))*cos(radians(b.lng)-radians(a.lng)) + sin(radians(a.lat))*sin(radians(b.lat)))))::numeric, 1) AS km FROM ref_cities a, ref_cities b WHERE a.name='Vijayawada' AND b.name='Guntur'`)).km,
  };
  console.log('after:', JSON.stringify(after));
  if (after.offered_with_coords !== 146 || after.offered_without !== 0) { console.error('CHECKS FAILED'); process.exit(1); }
  console.log('All checks OK.');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
