#!/usr/bin/env node
/**
 * Migrations 202 + 203 — shopper-walk-fixes.
 *   202: payment_config.return_window_hours (the return window in hours), post_media.cover_r2_key,
 *        content_files.cover_key (a picture taken from a video).
 *   203: follower_returns.order_line_id / request_id (a shopper returns an item of an order placed
 *        through a post); order_lines' two checks widened ('return', 'manual').
 * Usage: node scripts/run-202-203.js --dry | --apply   [--env=.env]
 * Contract: features/shopper-walk-fixes · 05-impact.md §3
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). The only value written is
 * return_window_hours = return_window_days × 24. No sale, agreement, order or wallet is touched:
 * those numbers are read before and after and must be identical.
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
  const check = async (name) => (await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = $1`, [name]) || {}).d || null;

  const shape = async () => ({
    'payment_config.return_window_hours': await has('payment_config', 'return_window_hours'),
    'post_media.cover_r2_key': await has('post_media', 'cover_r2_key'),
    'content_files.cover_key': await has('content_files', 'cover_key'),
    'follower_returns.order_line_id': await has('follower_returns', 'order_line_id'),
    'follower_returns.request_id': await has('follower_returns', 'request_id'),
    "order_lines.cancelled_by allows 'return'": /'return'/.test(String(await check('order_lines_cancelled_by_check'))),
    "order_lines.refund_status allows 'manual'": /'manual'/.test(String(await check('order_lines_refund_status_check'))),
  });
  // What must not move.
  const fixed = async () => ({
    return_window_days:  (await one(`SELECT return_window_days AS d FROM payment_config WHERE id = 1`)).d,
    sales_with_a_window: (await one(`SELECT count(*)::int n FROM follower_transactions WHERE return_window_ends_at IS NOT NULL`)).n,
    sales_window_sum:    (await one(`SELECT COALESCE(sum(extract(epoch FROM return_window_ends_at)), 0)::text t FROM follower_transactions`)).t,
    sales_settled:       (await one(`SELECT count(*)::int n FROM follower_transactions WHERE brand_settlement_status = 'settled'`)).n,
    commissions_added:   (await one(`SELECT count(*)::int n FROM follower_transactions WHERE commission_confirmed_at IS NOT NULL`)).n,
    order_lines:         (await one(`SELECT count(*)::int n FROM order_lines`)).n,
    order_lines_active:  (await one(`SELECT count(*)::int n FROM order_lines WHERE status = 'active'`)).n,
    returns:             (await one(`SELECT count(*)::int n FROM follower_returns`)).n,
    post_media:          (await one(`SELECT count(*)::int n FROM post_media`)).n,
    content_files:       (await one(`SELECT count(*)::int n FROM content_files`)).n,
    agreements_sent:     (await one(`SELECT count(*)::int n FROM contracts WHERE sent_at IS NOT NULL`)).n,
    brand_wallets:       (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM brands`)).t,
    infl_wallets:        (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM influencers`)).t,
    infl_pending:        (await one(`SELECT COALESCE(sum(pending_balance),0)::text t FROM influencers`)).t,
  });

  console.log('server version   :', (await one(`SHOW server_version`)).server_version);
  const s0 = await shape();
  console.log('\nalready there?');
  for (const [k, v] of Object.entries(s0)) console.log(`  ${v ? 'yes' : 'no '}  ${k}`);
  const before = await fixed();
  console.log('\n── before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);

  // Sales that the NEW rule holds until delivery (they are paid online, shipped or not, and not yet added).
  const waiting = await one(
    `SELECT count(*)::int AS n FROM follower_transactions ft JOIN follower_orders fo ON fo.id = ft.order_id
      WHERE ft.checkout_id IS NOT NULL AND ft.status = 'completed' AND ft.brand_settlement_status = 'pending'
        AND fo.payment_method <> 'cod' AND fo.order_status <> 'delivered'`);
  console.log(`\nonline sales not yet delivered, whose shares now wait for the delivery: ${waiting.n}`);

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  for (const f of ['202_return_window_hours_and_video_covers.sql', '203_returns_on_order_lines.sql']) {
    await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', f), 'utf8'));
    console.log(`\nAPPLIED ${f}`);
  }

  const s1 = await shape();
  const hours = await one(`SELECT return_window_hours AS h, return_window_days AS d FROM payment_config WHERE id = 1`);
  let bad = 0;
  const ok = (label, good) => { if (!good) bad += 1; console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${label}`); };
  console.log('');
  for (const [k, v] of Object.entries(s1)) ok(k, v === true);
  ok(`return_window_hours (${hours.h}) = return_window_days (${hours.d}) × 24`, Number(hours.h) === Number(hours.d) * 24 || s0['payment_config.return_window_hours']);
  ok('no video has a picture written by the migration', (await one(`SELECT count(*)::int n FROM post_media WHERE cover_r2_key IS NOT NULL`)).n === 0 || s0['post_media.cover_r2_key']);
  ok('no return was tied to an item by the migration', (await one(`SELECT count(*)::int n FROM follower_returns WHERE order_line_id IS NOT NULL`)).n === 0 || s0['follower_returns.order_line_id']);

  const after = await fixed();
  console.log('\n── after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved += 1;
    console.log(`  ${k.padEnd(20)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nSOMETHING MOVED in ${moved} place(s) — investigate.` : '\nNothing moved: no sale, order, return, agreement or wallet changed.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
