#!/usr/bin/env node
/**
 * Migration 205 — courier-ready addresses: brand_branches gains `landmark` and `phone`.
 * Usage: node scripts/run-205.js --dry | --apply   [--env=.env]
 * Contract: features/courier-ready-addresses · 05-impact.md
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). No value is written into any existing
 * row: both columns arrive NULL. Every branch, its address, and every wallet are read before and
 * after and must be identical.
 */
const fs = require('fs');
const path = require('path');
const envArg = process.argv.find((a) => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
if (!apply && !dry) { console.error('Pass --dry or --apply.'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const has = async (table, column) => !!(await one(
    `SELECT 1 AS x FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, column]));
  const hasCheck = async (name) => !!(await one(`SELECT 1 AS x FROM pg_constraint WHERE conname = $1`, [name]));

  const shape = async () => ({
    'brand_branches.landmark': await has('brand_branches', 'landmark'),
    'brand_branches.phone': await has('brand_branches', 'phone'),
    'check: landmark at most 45 characters': await hasCheck('brand_branches_landmark_len'),
    'check: phone is a 10-digit mobile': await hasCheck('brand_branches_phone_ten_digits'),
  });
  // What must not move.
  const fixed = async () => ({
    branches:          (await one(`SELECT count(*)::int n FROM brand_branches`)).n,
    branches_main:     (await one(`SELECT count(*)::int n FROM brand_branches WHERE is_main`)).n,
    address_print:     (await one(`SELECT COALESCE(md5(string_agg(id::text || '|' || COALESCE(name,'') || '|' || COALESCE(formatted_address,'') || '|' || COALESCE(pincode,'') || '|' || COALESCE(city_id::text,'') || '|' || COALESCE(state_id::text,''), ',' ORDER BY id)), '-') t FROM brand_branches`)).t,
    brands:            (await one(`SELECT count(*)::int n FROM brands`)).n,
    brand_wallets:     (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM brands`)).t,
    infl_wallets:      (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM influencers`)).t,
    parcels:           (await one(`SELECT count(*)::int n FROM shipments`)).n,
    store_codes:       (await one(`SELECT count(*)::int n FROM brand_branch_pickups`)).n,
  });

  console.log('server version   :', (await one(`SHOW server_version`)).server_version);
  const s0 = await shape();
  console.log('\nalready there?');
  for (const [k, v] of Object.entries(s0)) console.log(`  ${v ? 'yes' : 'no '}  ${k}`);
  const before = await fixed();
  console.log('\n── before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(16)}: ${v}`);

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '205_branch_landmark_phone.sql'), 'utf8'));
  console.log('\nAPPLIED 205_branch_landmark_phone.sql');

  const s1 = await shape();
  let bad = 0;
  const ok = (label, good) => { if (!good) bad += 1; console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${label}`); };
  console.log('');
  for (const [k, v] of Object.entries(s1)) ok(k, v === true);
  ok('no branch has a landmark or a store phone yet', (await one(`SELECT count(*)::int n FROM brand_branches WHERE landmark IS NOT NULL OR phone IS NOT NULL`)).n === 0 || s0['brand_branches.landmark']);

  const after = await fixed();
  console.log('\n── after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved += 1;
    console.log(`  ${k.padEnd(16)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nSOMETHING MOVED in ${moved} place(s) — investigate.` : '\nNothing moved: no branch, address, wallet or parcel changed.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
