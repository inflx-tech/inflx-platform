#!/usr/bin/env node
/**
 * Migration 196 — post-links-codes: post codes, collection links, store handles, link visits.
 * Usage: node scripts/run-196.js --dry | --apply   [--env=.env]
 * Contract: features/post-links-codes · Docs/OFFER_TERMS_POSTS_RULES.md §4.14
 *
 * ADDITIVE. Approved new posts and existing collections get their codes; every creator's current
 * handle is recorded so her store link keeps working if it changes. Idempotent (applied twice to
 * the test database). Money is read before and after and must be identical. This migration moves none.
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

const NEW_TABLES = ['store_handles', 'link_visits'];
const COLS = [['creator_posts', 'post_code'], ['creator_posts', 'code_issued_at'], ['creator_collections', 'link_code'], ['follower_transactions', 'link_channel']];
const CONSTRAINTS = ['creator_posts_code_shape', 'creator_collections_code_shape', 'ft_link_channel_known'];

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
  const approvedV2 = (await one(`SELECT count(*)::int n FROM creator_posts WHERE v2 AND approved_at IS NOT NULL`)).n;
  const collections = (await one(`SELECT count(*)::int n FROM creator_collections`)).n;
  const handles = (await one(`SELECT count(*)::int n FROM influencers WHERE COALESCE(instagram_handle, '') <> ''`)).n;
  const dupHandles = (await one(`SELECT count(*)::int n FROM (SELECT lower(regexp_replace(instagram_handle, '^@', '')) h FROM influencers WHERE COALESCE(instagram_handle, '') <> '' GROUP BY 1 HAVING count(*) > 1) x`)).n;
  console.log(`new posts approved (get codes)  : ${approvedV2}`);
  console.log(`collections (get links)         : ${collections}`);
  console.log(`creators with a handle          : ${handles}  (shared handles: ${dupHandles} — the first keeps it)`);
  const postCount = (await one(`SELECT count(*)::int n FROM creator_posts`)).n;

  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);
  const already = {};
  for (const t of NEW_TABLES) already[t] = await table(t);
  for (const [t, col] of COLS) already[`${t}.${col}`] = await has(t, col);
  console.log('\nalready applied?                :', JSON.stringify(already));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '196_post_links_codes.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  const checks = [];
  for (const t of NEW_TABLES) checks.push([`table ${t}`, await table(t)]);
  for (const [t, col] of COLS) checks.push([`${t}.${col}`, await has(t, col)]);
  for (const k of CONSTRAINTS) checks.push([`constraint ${k}`, !!(await one(`SELECT 1 AS v FROM pg_constraint WHERE conname = $1`, [k]))]);
  checks.push(['function inflx_new_code', !!(await one(`SELECT 1 AS v FROM pg_proc WHERE proname = 'inflx_new_code'`))]);
  checks.push(['trigger trg_keep_store_handle', !!(await one(`SELECT 1 AS v FROM pg_trigger WHERE tgname = 'trg_keep_store_handle'`))]);
  checks.push(['every approved new post has a code', (await one(`SELECT count(*)::int n FROM creator_posts WHERE v2 AND approved_at IS NOT NULL AND post_code IS NULL`)).n === 0]);
  checks.push(['every collection has a link', (await one(`SELECT count(*)::int n FROM creator_collections WHERE link_code IS NULL`)).n === 0]);
  checks.push(['no draft or post in review has a code', (await one(`SELECT count(*)::int n FROM creator_posts WHERE status IN ('draft', 'submitted') AND post_code IS NOT NULL AND approved_at IS NULL`)).n === 0]);
  checks.push(['every current handle is kept', (await one(`SELECT count(*)::int n FROM influencers i WHERE COALESCE(i.instagram_handle, '') <> ''
      AND NOT EXISTS (SELECT 1 FROM store_handles s WHERE s.handle = lower(regexp_replace(i.instagram_handle, '^@', '')))`)).n === 0]);
  checks.push(['channel window setting (30 days)', ((await one(`SELECT value FROM platform_settings WHERE key = 'link_channel_window_days'`)) || {}).value === 30]);
  checks.push(['post count unchanged', (await one(`SELECT count(*)::int n FROM creator_posts`)).n === postCount]);

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
