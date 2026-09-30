#!/usr/bin/env node
/**
 * Migration 198 — shopper ordering: the bag, checkouts, a parcel per brand, a money row per post,
 * a row per item with its three-way split, hand-entered addresses, cash-on-delivery dues.
 * Usage: node scripts/run-198.js --dry | --apply   [--env=.env]
 * Contract: features/shopper-ordering · Docs/OFFER_TERMS_POSTS_RULES.md v1.13 §6
 *
 * ADDITIVE. Idempotent. Money is read before and after and must be identical.
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

const NEW_TABLES = ['follower_bag_items', 'checkouts', 'order_lines'];
const COLS = [['follower_orders', 'checkout_id'], ['follower_orders', 'brand_id'], ['follower_orders', 'address_snapshot'],
  ['follower_orders', 'delivery_fee'], ['follower_transactions', 'order_id'], ['follower_transactions', 'checkout_id'], ['follower_transactions', 'platform_fee_reversed'],
  ['follower_addresses', 'house'], ['follower_addresses', 'area'], ['follower_addresses', 'state'],
  ['brand_dues', 'settled_by_transaction_id']];
const CONSTRAINTS = ['line_split_adds_up', 'line_has_thing', 'bag_item_has_thing'];

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const has = async (t, col) => !!(await one(`SELECT 1 AS v FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col]));
  const table = async (t) => !!(await one(`SELECT 1 AS v FROM information_schema.tables WHERE table_name=$1`, [t]));

  const money = async () => ({
    brand_wallets:      (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM brands`)).t,
    infl_wallets:       (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM influencers`)).t,
    infl_pending:       (await one(`SELECT COALESCE(sum(pending_balance),0)::text t FROM influencers`)).t,
    ledger_rows:        (await one(`SELECT count(*)::int n FROM influencer_ledger`)).n,
    wallet_tx_rows:     (await one(`SELECT count(*)::int n FROM wallet_transactions`)).n,
    follower_tx_rows:   (await one(`SELECT count(*)::int n FROM follower_transactions`)).n,
    follower_tx_net:    (await one(`SELECT COALESCE(sum(net_amount),0)::text t FROM follower_transactions`)).t,
    follower_orders:    (await one(`SELECT count(*)::int n FROM follower_orders`)).n,
    brand_dues_open:    (await one(`SELECT COALESCE(sum(amount),0)::text t FROM brand_dues WHERE settled_at IS NULL`)).t,
  });

  console.log('server version :', (await one(`SHOW server_version`)).server_version);
  console.log('addresses      :', (await one(`SELECT count(*)::int n FROM follower_addresses`)).n);
  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(18)}: ${v}`);
  const already = {};
  for (const t of NEW_TABLES) already[t] = await table(t);
  for (const [t, col] of COLS) already[`${t}.${col}`] = await has(t, col);
  console.log('\nalready applied?:', JSON.stringify(already));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '198_shopper_ordering.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  const checks = [];
  for (const t of NEW_TABLES) checks.push([`table ${t}`, await table(t)]);
  for (const [t, col] of COLS) checks.push([`${t}.${col}`, await has(t, col)]);
  for (const k of CONSTRAINTS) checks.push([`constraint ${k}`, !!(await one(`SELECT 1 AS v FROM pg_constraint WHERE conname = $1`, [k]))]);

  console.log('');
  let bad = 0;
  for (const [label, ok] of checks) { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}`); }
  const after = await money();
  console.log('\n── money after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved++;
    console.log(`  ${k.padEnd(18)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nMONEY MOVED in ${moved} place(s) — investigate.` : '\nNo money moved.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
