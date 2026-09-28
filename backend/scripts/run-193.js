#!/usr/bin/env node
/**
 * Migration 193 — offer-builder-v2: offers on product pools, locked by the database.
 * Usage: node scripts/run-193.js --dry | --apply   [--env=.env]
 * Contract: features/offer-builder-v2 · Docs/OFFER_TERMS_POSTS_RULES.md §1
 *
 * ADDITIVE except for one deliberate change (rules 1.13, the clean break): every existing offer is
 * archived and taken off the store. The dry run prints each one first. Idempotent (applied twice to
 * the test database). Needs the btree_gist extension — the dry run checks it is available.
 *
 * Money is read before and after and must be identical. This migration moves none.
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

const NEW_TABLES = ['gift_items', 'offer_pool_sources', 'offer_pool_items', 'collab_offers'];
const NEW_COLS = ['engine', 'sub_type', 'starts_on', 'ends_on', 'auto_add', 'excluded_product_ids', 'published_at', 'ended_at'];
const NEW_CONSTRAINTS = ['offer_items_one_offer_per_product', 'offer_items_one_offer_per_gift_item',
  'brand_offers_v2_sub_type', 'brand_offers_v2_dates', 'brand_offers_v2_published_complete', 'brand_offers_v2_statuses'];

(async () => {
  const masked = url.replace(/:[^:@/]+@/, ':***@');
  console.log('Target:', masked);
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const all = async (sql, p) => (await c.query(sql, p)).rows;
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
  const ext = await one(`SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'btree_gist'`);
  console.log('btree_gist                      :', ext ? `available (default ${ext.default_version}, installed ${ext.installed_version || 'no'})` : 'NOT AVAILABLE — stop');
  if (!ext) { await c.end(); process.exit(1); }

  const offers = await all(`SELECT o.id, b.business_name AS brand, o.name, o.offer_type, o.status, o.published_to_store
                              FROM brand_offers o JOIN brands b ON b.id = o.brand_id ORDER BY b.business_name, o.created_at`);
  console.log(`\nexisting offers                 : ${offers.length}`);
  for (const o of offers) console.log(`  ${o.status.padEnd(8)} ${o.published_to_store ? 'store' : '     '}  ${o.offer_type.padEnd(9)} ${o.brand} · ${o.name}`);
  console.log('offers copied onto collabs      :', (await one(`SELECT count(*)::int n FROM campaign_influencers WHERE brand_offer_id IS NOT NULL`)).n, '(copies stay as they are)');

  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);

  const already = {};
  for (const t of NEW_TABLES) already[t] = await table(t);
  for (const col of NEW_COLS) already[`brand_offers.${col}`] = await has('brand_offers', col);
  console.log('\nalready applied?                :', JSON.stringify(already));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '193_offer_builder_v2.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  const checks = [];
  checks.push(['btree_gist installed', !!(await one(`SELECT 1 AS v FROM pg_extension WHERE extname = 'btree_gist'`))]);
  for (const t of NEW_TABLES) checks.push([`table ${t}`, await table(t)]);
  for (const col of NEW_COLS) checks.push([`brand_offers.${col}`, await has('brand_offers', col)]);
  for (const k of NEW_CONSTRAINTS) checks.push([`constraint ${k}`, !!(await one(`SELECT 1 AS v FROM pg_constraint WHERE conname = $1`, [k]))]);
  checks.push(['every old offer archived', (await one(`SELECT count(*)::int n FROM brand_offers WHERE engine = 1 AND status <> 'archived'`)).n === 0]);
  checks.push(['no old offer on the store', (await one(`SELECT count(*)::int n FROM brand_offers WHERE published_to_store`)).n === 0]);
  checks.push(['offer count unchanged', (await one(`SELECT count(*)::int n FROM brand_offers`)).n === offers.length]);
  checks.push(['no new-engine offers yet', (await one(`SELECT count(*)::int n FROM brand_offers WHERE engine = 2`)).n === 0]);
  checks.push(['offer_pool_items empty', (await one(`SELECT count(*)::int n FROM offer_pool_items`)).n === 0]);
  checks.push(['collab_offers empty', (await one(`SELECT count(*)::int n FROM collab_offers`)).n === 0]);
  checks.push(['status check widened', /published/.test((await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'brand_offers_status_check'`)).d)]);

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
