#!/usr/bin/env node
/**
 * The return window becomes ONE platform number (founder, 4 Oct 2026: "this return window is fixed
 * by our platform INFLX.. this is same for all.. not decided by individual business or brand..
 * platform level.. we keep this as 7 days for now.. given to admin as a setting").
 * Contract: features/shopper-walk-fixes · 01-spec.md W11
 *
 * Usage: node scripts/set-return-window.js --days=7 --dry | --apply   [--env=.env]
 *
 * What it writes (one transaction):
 *   payment_config.return_window_days  → the number   (Admin › Money › Settings › "Return window")
 *   categories.return_window_days      → the same number on every category
 * Why both: today the category's number WINS over the platform's (pricing.getReturnWindowForCategory),
 * and both columns are NOT NULL — so until the code reads only the platform number, every category
 * must carry it too, or the platform setting would change nothing.
 *
 * What it must NOT move: a sale already made keeps the window stamped on it
 * (follower_transactions.return_window_ends_at); an agreement already sent keeps its terms; no wallet
 * changes. Those are read before and after and must be identical. Idempotent.
 */
const path = require('path');
const envArg = process.argv.find((a) => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? Number(daysArg.slice(7)) : NaN;
if (!apply && !dry) { console.error('Pass --dry or --apply.'); process.exit(2); }
if (!Number.isInteger(days) || days < 1 || days > 90) { console.error('Pass --days=N (1 to 90, the admin page\'s own limits).'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const all = async (sql, p) => (await c.query(sql, p)).rows;

  const settings = async () => ({
    platform: (await one(`SELECT return_window_days AS d FROM payment_config WHERE id = 1`)).d,
    categories: await all(`SELECT category_key, return_window_days AS d FROM categories ORDER BY category_key`),
  });
  // What must not move.
  const fixed = async () => ({
    sales_with_a_window: (await one(`SELECT count(*)::int n FROM follower_transactions WHERE return_window_ends_at IS NOT NULL`)).n,
    sales_window_sum: (await one(`SELECT COALESCE(sum(extract(epoch FROM return_window_ends_at)), 0)::text t FROM follower_transactions`)).t,
    agreements_sent: (await one(`SELECT count(*)::int n FROM contracts WHERE sent_at IS NOT NULL`)).n,
    agreements_terms: (await one(`SELECT md5(COALESCE(string_agg(md5(terms_json::text), '' ORDER BY id), '')) AS h FROM contracts WHERE sent_at IS NOT NULL`)).h,
    brand_wallets: (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM brands`)).t,
    infl_wallets: (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM influencers`)).t,
    infl_pending: (await one(`SELECT COALESCE(sum(pending_balance),0)::text t FROM influencers`)).t,
  });

  const s0 = await settings();
  const byDays = {};
  for (const r of s0.categories) byDays[r.d] = (byDays[r.d] || 0) + 1;
  console.log(`\nnow      : platform ${s0.platform} days · ${s0.categories.length} categories → ${Object.entries(byDays).map(([d, n]) => `${n} at ${d} days`).join(', ')}`);
  console.log(`wanted   : platform ${days} days · every category ${days} days`);
  const todo = (s0.platform !== days ? 1 : 0) + s0.categories.filter((r) => r.d !== days).length;
  console.log(`to change: ${todo} number${todo === 1 ? '' : 's'}`);

  const before = await fixed();
  console.log('\n── must not move ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }
  if (!todo) { console.log('\nAlready so. Nothing written.'); await c.end(); return; }

  await c.query('BEGIN');
  try {
    await c.query(`SET LOCAL lock_timeout = '5s'`);
    const p = await c.query(`UPDATE payment_config SET return_window_days = $1, updated_at = now() WHERE id = 1 AND return_window_days <> $1`, [days]);
    const k = await c.query(`UPDATE categories SET return_window_days = $1, updated_at = now() WHERE return_window_days <> $1`, [days]);
    await c.query('COMMIT');
    console.log(`\nAPPLIED: platform ${p.rowCount ? 'changed' : 'already so'}; ${k.rowCount} categor${k.rowCount === 1 ? 'y' : 'ies'} changed.`);
  } catch (e) { await c.query('ROLLBACK'); throw e; }

  const s1 = await settings();
  const after = await fixed();
  let bad = 0;
  const ok = (label, good) => { if (!good) bad += 1; console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${label}`); };
  console.log('');
  ok(`platform is ${days} days`, s1.platform === days);
  ok(`every category is ${days} days`, s1.categories.every((r) => r.d === days));
  let moved = 0;
  console.log('\n── after ──');
  for (const [k2, v] of Object.entries(after)) {
    const same = String(v) === String(before[k2]);
    if (!same) moved += 1;
    console.log(`  ${k2.padEnd(20)}: ${v}${same ? '' : `   ← was ${before[k2]}`}`);
  }
  console.log(moved ? `\nSOMETHING MOVED in ${moved} place(s) — investigate.` : '\nNothing else moved: no sale already made, no sent agreement, no wallet.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
