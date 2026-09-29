#!/usr/bin/env node
/**
 * Migration 197 — the shopper app: Welcome choices and city on followers, saved products remember
 * their post, comments and reports, the wider recording vocabulary, post performance, feed settings.
 * Usage: node scripts/run-197.js --dry | --apply   [--env=.env]
 * Contract: features/follower-app-v2 · Docs/OFFER_TERMS_POSTS_RULES.md v1.7 §4.7, §4.15, §5
 *
 * ADDITIVE, plus one clear: any exact location the old app stored on followers is emptied (rules
 * 5.3: used, never stored). Idempotent. Money is read before and after and must be identical.
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

const NEW_TABLES = ['post_comments', 'post_comment_reports', 'post_performance'];
const COLS = [['followers', 'city_id'], ['followers', 'shop_for'], ['followers', 'style_tag_ids'], ['followers', 'welcomed_at'],
  ['follower_wishlist_items', 'post_id'], ['follower_wishlist_items', 'collection_item_id']];
const CONSTRAINTS = ['followers_shop_for_known', 'post_comments_author', 'post_events_event_type_check', 'post_events_surface_check'];
const SETTINGS = ['feed_near_km', 'feed_new_share_pct', 'feed_new_hours', 'feed_repeat_days', 'feed_learning_on',
  'feed_w_does', 'feed_w_recent', 'feed_w_near', 'feed_w_performs'];

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const has = async (t, col) => !!(await one(`SELECT 1 AS v FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col]));
  const table = async (t) => !!(await one(`SELECT 1 AS v FROM information_schema.tables WHERE table_name=$1`, [t]));

  const money = async () => ({
    escrow_rows:        (await one(`SELECT count(*)::int n FROM escrow_entries`)).n,
    escrow_total:       (await one(`SELECT COALESCE(sum(amount),0)::text t FROM escrow_entries`)).t,
    contracts_locked:   (await one(`SELECT COALESCE(sum(locked_amount),0)::text t FROM contracts`)).t,
    contracts_released: (await one(`SELECT COALESCE(sum(released_amount),0)::text t FROM contracts`)).t,
    brand_wallets:      (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM brands`)).t,
    infl_wallets:       (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM influencers`)).t,
    infl_pending:       (await one(`SELECT COALESCE(sum(pending_balance),0)::text t FROM influencers`)).t,
    ledger_rows:        (await one(`SELECT count(*)::int n FROM influencer_ledger`)).n,
    wallet_tx_rows:     (await one(`SELECT count(*)::int n FROM wallet_transactions`)).n,
    follower_tx_rows:   (await one(`SELECT count(*)::int n FROM follower_transactions`)).n,
  });

  console.log('server version                  :', (await one(`SHOW server_version`)).server_version);
  const followers = (await one(`SELECT count(*)::int n FROM followers`)).n;
  const located = (await one(`SELECT count(*)::int n FROM followers WHERE last_lat IS NOT NULL OR last_lng IS NOT NULL OR area_name IS NOT NULL`)).n;
  const events = (await one(`SELECT count(*)::int n FROM post_events`)).n;
  const wish = (await one(`SELECT count(*)::int n FROM follower_wishlist_items`)).n;
  console.log(`followers                       : ${followers}`);
  console.log(`followers with a stored location: ${located}  (cleared by this migration)`);
  console.log(`post events recorded            : ${events}`);
  console.log(`saved products (old wishlist)   : ${wish}`);

  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);
  const already = {};
  for (const t of NEW_TABLES) already[t] = await table(t);
  for (const [t, col] of COLS) already[`${t}.${col}`] = await has(t, col);
  console.log('\nalready applied?                :', JSON.stringify(already));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '197_shopper_app.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  const checks = [];
  for (const t of NEW_TABLES) checks.push([`table ${t}`, await table(t)]);
  for (const [t, col] of COLS) checks.push([`${t}.${col}`, await has(t, col)]);
  for (const k of CONSTRAINTS) checks.push([`constraint ${k}`, !!(await one(`SELECT 1 AS v FROM pg_constraint WHERE conname = $1`, [k]))]);
  for (const k of SETTINGS) checks.push([`setting ${k}`, !!(await one(`SELECT 1 AS v FROM platform_settings WHERE key = $1`, [k]))]);
  checks.push(['learning feed is OFF', ((await one(`SELECT value FROM platform_settings WHERE key = 'feed_learning_on'`)) || {}).value == 0]);
  checks.push(['no stored location left', (await one(`SELECT count(*)::int n FROM followers WHERE last_lat IS NOT NULL OR last_lng IS NOT NULL OR area_name IS NOT NULL`)).n === 0]);
  checks.push(['followers unchanged in number', (await one(`SELECT count(*)::int n FROM followers`)).n === followers]);
  checks.push(['post events kept', (await one(`SELECT count(*)::int n FROM post_events`)).n === events]);

  console.log('');
  let bad = 0;
  for (const [label, ok] of checks) { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}`); }
  const after = await money();
  console.log('\n── money after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved++;
    console.log(`  ${k.padEnd(20)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nMONEY MOVED in ${moved} place(s) — investigate.` : '\nNo money moved.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
