#!/usr/bin/env node
/**
 * Migration 204 — shopper-deal-orders, part B: one item of a deal is replaced, or its share refunded.
 *   follower_returns: kind (return · replace · refund_item), from/to colour and size, replacement_status
 *   (to_send · sent · delivered) with its two times, sold_out; return_status gains 'replaced'.
 *   follower_transactions: return_window_restart_at (the window runs again after a replacement is delivered).
 * Usage: node scripts/run-204.js --dry | --apply   [--env=.env]
 * Contract: features/shopper-deal-orders · 05-impact.md (part B)
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). No value is written into any existing row:
 * every request that exists becomes kind 'return' by the column's default, and nothing else. No sale,
 * order, return, wallet or stock number is touched: they are read before and after and must be identical.
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
  const states = async () => (await c.query(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'return_status' ORDER BY e.enumsortorder`)).rows.map((r) => r.enumlabel);

  const COLS = ['kind', 'from_colour', 'from_size', 'to_colour', 'to_size', 'replacement_status', 'replacement_sent_at', 'replacement_delivered_at', 'sold_out'];
  const shape = async () => {
    const out = {};
    for (const col of COLS) out[`follower_returns.${col}`] = await has('follower_returns', col);
    out['follower_transactions.return_window_restart_at'] = await has('follower_transactions', 'return_window_restart_at');
    out["return_status has 'replaced'"] = (await states()).includes('replaced');
    return out;
  };
  // What must not move.
  const fixed = async () => ({
    returns:            (await one(`SELECT count(*)::int n FROM follower_returns`)).n,
    returns_by_state:   (await one(`SELECT COALESCE(string_agg(s || ':' || n, ' ' ORDER BY s), '-') t FROM (SELECT return_status::text s, count(*) n FROM follower_returns GROUP BY 1) x`)).t,
    returns_refund_sum: (await one(`SELECT COALESCE(sum(refund_amount), 0)::text t FROM follower_returns`)).t,
    sales:              (await one(`SELECT count(*)::int n FROM follower_transactions`)).n,
    sales_window_sum:   (await one(`SELECT COALESCE(sum(extract(epoch FROM return_window_ends_at)), 0)::text t FROM follower_transactions`)).t,
    sales_settled:      (await one(`SELECT count(*)::int n FROM follower_transactions WHERE brand_settlement_status = 'settled'`)).n,
    commissions_added:  (await one(`SELECT count(*)::int n FROM follower_transactions WHERE commission_confirmed_at IS NOT NULL`)).n,
    order_lines:        (await one(`SELECT count(*)::int n FROM order_lines`)).n,
    order_lines_active: (await one(`SELECT count(*)::int n FROM order_lines WHERE status = 'active'`)).n,
    order_lines_paid:   (await one(`SELECT COALESCE(sum(paid_total), 0)::text t FROM order_lines`)).t,
    brand_wallets:      (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM brands`)).t,
    infl_wallets:       (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM influencers`)).t,
    infl_pending:       (await one(`SELECT COALESCE(sum(pending_balance), 0)::text t FROM influencers`)).t,
    product_stock_sum:  (await one(`SELECT COALESCE(sum(stock), 0)::text t FROM brand_products`)).t,
  });

  console.log('server version   :', (await one(`SHOW server_version`)).server_version);
  const s0 = await shape();
  console.log('\nalready there?');
  for (const [k, v] of Object.entries(s0)) console.log(`  ${v ? 'yes' : 'no '}  ${k}`);
  console.log('  states of a request today:', (await states()).join(', '));
  const before = await fixed();
  console.log('\n── before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '204_return_kinds_and_replacements.sql'), 'utf8'));
  console.log('\nAPPLIED 204_return_kinds_and_replacements.sql');

  const s1 = await shape();
  let bad = 0;
  const ok = (label, good) => { if (!good) bad += 1; console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${label}`); };
  console.log('');
  for (const [k, v] of Object.entries(s1)) ok(k, v === true);
  ok('every request that exists is a return', (await one(`SELECT count(*)::int n FROM follower_returns WHERE kind <> 'return'`)).n === 0 || s0['follower_returns.kind']);
  ok('no request is marked sold out or has a replacement', (await one(`SELECT count(*)::int n FROM follower_returns WHERE sold_out OR replacement_status IS NOT NULL OR to_size IS NOT NULL`)).n === 0 || s0['follower_returns.replacement_status']);
  ok('no sale has a restarted window', (await one(`SELECT count(*)::int n FROM follower_transactions WHERE return_window_restart_at IS NOT NULL`)).n === 0 || s0['follower_transactions.return_window_restart_at']);

  const after = await fixed();
  console.log('\n── after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved += 1;
    console.log(`  ${k.padEnd(20)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nSOMETHING MOVED in ${moved} place(s) — investigate.` : '\nNothing moved: no sale, order, return, wallet or stock number changed.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
