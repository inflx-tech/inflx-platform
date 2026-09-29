#!/usr/bin/env node
/**
 * Migration 195 — shoppable-posts-v2: a creator's shoppable posts for one collaboration, and collections.
 * Usage: node scripts/run-195.js --dry | --apply   [--env=.env]
 * Contract: features/shoppable-posts-v2 · Docs/OFFER_TERMS_POSTS_RULES.md §4
 *
 * ADDITIVE. Every existing post keeps every value it has (v2 = false) and is read as before; the
 * five price bands and the 27 theme tags are seeded. Idempotent (applied twice to the test database).
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

const POST_COLS = ['v2', 'campaign_influencer_id', 'brand_id', 'post_kind', 'offer_id', 'theme_tag_ids', 'media_layout',
  'category_node_ids', 'top_price', 'price_band_id', 'draft_step', 'draft_state', 'submitted_at', 'sent_back_count', 'removed_at', 'removed_reason'];
const MEDIA_COLS = ['mime', 'size_bytes', 'duration_s'];
const NEW_TABLES = ['price_bands', 'theme_tags', 'creator_collections', 'creator_collection_items'];
const CONSTRAINTS = ['creator_posts_post_kind_known', 'creator_posts_media_layout_known', 'creator_posts_removed_reason_known',
  'creator_posts_status_check', 'creator_posts_concept_or_collection', 'creator_posts_v2_shape', 'creator_posts_v2_price_no_offer',
  'creator_posts_removed_has_reason', 'cci_one_kind', 'cci_product_has_collab'];

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
  const byStatus = await all(`SELECT status, count(*)::int n FROM creator_posts GROUP BY status ORDER BY status`);
  const postCount = byStatus.reduce((n, r) => n + r.n, 0);
  console.log(`posts                           : ${postCount}  (${byStatus.map(r => `${r.status} ${r.n}`).join(' · ') || 'none'})`);
  console.log('  — all keep every value they have; none is changed');
  const checksNow = await all(`SELECT conname, pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid = 'creator_posts'::regclass AND contype = 'c' ORDER BY conname`);
  console.log('creator_posts checks now        :');
  for (const k of checksNow) console.log(`  ${k.conname}: ${k.d}`);
  const mediaCount = (await one(`SELECT count(*)::int n FROM post_media`)).n;

  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);

  const already = {};
  for (const t of NEW_TABLES) already[t] = await table(t);
  for (const col of POST_COLS) already[`creator_posts.${col}`] = await has('creator_posts', col);
  console.log('\nalready applied?                :', JSON.stringify(already));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '195_shoppable_posts_v2.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  const checks = [];
  for (const t of NEW_TABLES) checks.push([`table ${t}`, await table(t)]);
  for (const col of POST_COLS) checks.push([`creator_posts.${col}`, await has('creator_posts', col)]);
  for (const col of MEDIA_COLS) checks.push([`post_media.${col}`, await has('post_media', col)]);
  for (const k of CONSTRAINTS) checks.push([`constraint ${k}`, !!(await one(`SELECT 1 AS v FROM pg_constraint WHERE conname = $1`, [k]))]);
  // The old "concept XOR collection" rule must no longer apply to new posts, whatever its old name was.
  const conceptRules = await all(`SELECT conname, pg_get_constraintdef(oid) AS d FROM pg_constraint
    WHERE conrelid = 'creator_posts'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%concept_id%'`);
  checks.push(['every concept rule spares new posts', conceptRules.every(r => /v2/.test(r.d))]);
  checks.push(['five price bands', (await one(`SELECT count(*)::int n FROM price_bands`)).n === 5]);
  checks.push(['27 theme tags in 4 groups', (await one(`SELECT count(*)::int n FROM theme_tags`)).n === 27
    && (await one(`SELECT count(DISTINCT tag_group)::int n FROM theme_tags`)).n === 4]);
  checks.push(['post count unchanged', (await one(`SELECT count(*)::int n FROM creator_posts`)).n === postCount]);
  checks.push(['no post became a new post', (await one(`SELECT count(*)::int n FROM creator_posts WHERE v2`)).n === 0]);
  checks.push(['post media unchanged', (await one(`SELECT count(*)::int n FROM post_media`)).n === mediaCount]);

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
