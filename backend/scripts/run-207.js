#!/usr/bin/env node
/**
 * Migration 207 — Place order happens once: checkouts gains `client_key`, unique per shopper.
 * Usage: node scripts/run-207.js --dry | --apply   [--env=.env]
 * Contract: features/listing-shop-safety · 05-impact.md (C)
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). No value is written into any existing
 * row: the column arrives NULL. Every checkout, order line, post and wallet is read before and
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
  const hasIndex = async (name) => !!(await one(`SELECT 1 AS x FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`, [name]));

  const shape = async () => ({
    'checkouts.client_key': await has('checkouts', 'client_key'),
    'check: a key is 8 to 64 characters': await hasCheck('checkouts_client_key_len'),
    'one key, one checkout per shopper (unique index)': await hasIndex('uq_checkouts_follower_client_key'),
  });
  // What must not move.
  const fixed = async () => ({
    checkouts:        (await one(`SELECT count(*)::int n FROM checkouts`)).n,
    checkouts_print:  (await one(`SELECT COALESCE(md5(string_agg(id::text || '|' || status || '|' || payment_method || '|' || total::text || '|' || COALESCE(razorpay_order_id,''), ',' ORDER BY id)), '-') t FROM checkouts`)).t,
    order_lines:      (await one(`SELECT count(*)::int n FROM order_lines`)).n,
    lines_print:      (await one(`SELECT COALESCE(md5(string_agg(id::text || '|' || status || '|' || paid_total::text || '|' || commission::text || '|' || brand_net::text, ',' ORDER BY id)), '-') t FROM order_lines`)).t,
    posts:            (await one(`SELECT count(*)::int n FROM creator_posts`)).n,
    posts_print:      (await one(`SELECT COALESCE(md5(string_agg(id::text || '|' || status, ',' ORDER BY id)), '-') t FROM creator_posts`)).t,
    post_products:    (await one(`SELECT count(*)::int n FROM post_products`)).n,
    brand_wallets:    (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM brands`)).t,
    infl_wallets:     (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM influencers`)).t,
    infl_pending:     (await one(`SELECT COALESCE(sum(pending_balance), 0)::text t FROM influencers`)).t,
  });

  console.log('server version   :', (await one(`SHOW server_version`)).server_version);
  const s0 = await shape();
  console.log('\nalready there?');
  for (const [k, v] of Object.entries(s0)) console.log(`  ${v ? 'yes' : 'no '}  ${k}`);
  const before = await fixed();
  console.log('\n── before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(16)}: ${v}`);

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '207_checkout_client_key.sql'), 'utf8'));
  console.log('\nAPPLIED 207_checkout_client_key.sql');

  const s1 = await shape();
  let bad = 0;
  const ok = (label, good) => { if (!good) bad += 1; console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${label}`); };
  console.log('');
  for (const [k, v] of Object.entries(s1)) ok(k, v === true);
  ok('no checkout carries a key yet', s0['checkouts.client_key'] || (await one(`SELECT count(*)::int n FROM checkouts WHERE client_key IS NOT NULL`)).n === 0);

  const after = await fixed();
  console.log('\n── after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved += 1;
    console.log(`  ${k.padEnd(16)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nSOMETHING MOVED in ${moved} place(s) — investigate.` : '\nNothing moved: no checkout, order line, post or wallet changed.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
