#!/usr/bin/env node
/**
 * Migration 206 — a creator who owns a brand (item 20): the link table, the link codes, the places
 * table, `creator_posts.own_brand`; the post rule loosened to "a collaboration OR his own brand";
 * `order_lines.campaign_influencer_id` may be empty.
 * Usage: node scripts/run-206.js --dry | --apply   [--env=.env]
 * Contract: features/item20-own-brand · 05-impact.md
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). No existing row is written. Before it is
 * applied this checks that every existing post and order line already satisfies the loosened rules;
 * every post, order line, sale and wallet is read before and after and must be identical.
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
  const hasTable = async (t) => !!(await one(`SELECT 1 AS x FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [t]));
  const has = async (table, column) => !!(await one(
    `SELECT 1 AS x FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, column]));
  const checkText = async (name) => ((await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = $1`, [name])) || {}).d || '';
  const nullable = async (table, column) => ((await one(
    `SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, column])) || {}).is_nullable === 'YES';

  const shape = async () => ({
    'table creator_brand_links': await hasTable('creator_brand_links'),
    'table brand_link_codes': await hasTable('brand_link_codes'),
    'table post_share_places': await hasTable('post_share_places'),
    'creator_posts.own_brand': await has('creator_posts', 'own_brand'),
    'post rule says "a collaboration or own brand"': /own_brand/.test(await checkText('creator_posts_v2_shape')),
    'order_lines.campaign_influencer_id may be empty': await nullable('order_lines', 'campaign_influencer_id'),
  });
  // What must not move.
  const fixed = async () => ({
    posts:            (await one(`SELECT count(*)::int n FROM creator_posts`)).n,
    posts_v2:         (await one(`SELECT count(*)::int n FROM creator_posts WHERE v2`)).n,
    posts_print:      (await one(`SELECT COALESCE(md5(string_agg(id::text || '|' || status || '|' || COALESCE(campaign_influencer_id::text,'') || '|' || COALESCE(brand_id::text,'') || '|' || COALESCE(post_code,''), ',' ORDER BY id)), '-') t FROM creator_posts`)).t,
    order_lines:      (await one(`SELECT count(*)::int n FROM order_lines`)).n,
    lines_print:      (await one(`SELECT COALESCE(md5(string_agg(id::text || '|' || COALESCE(campaign_influencer_id::text,'') || '|' || paid_total::text || '|' || commission::text || '|' || platform_fee::text || '|' || brand_net::text, ',' ORDER BY id)), '-') t FROM order_lines`)).t,
    sales:            (await one(`SELECT count(*)::int n FROM follower_transactions`)).n,
    brands:           (await one(`SELECT count(*)::int n FROM brands`)).n,
    creators:         (await one(`SELECT count(*)::int n FROM influencers`)).n,
    brand_wallets:    (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM brands`)).t,
    infl_wallets:     (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM influencers`)).t,
    infl_pending:     (await one(`SELECT COALESCE(sum(pending_balance), 0)::text t FROM influencers`)).t,
    signin_codes:     (await one(`SELECT count(*)::int n FROM otp_codes`)).n,
  });

  console.log('server version   :', (await one(`SHOW server_version`)).server_version);
  const s0 = await shape();
  console.log('\nalready there?');
  for (const [k, v] of Object.entries(s0)) console.log(`  ${v ? 'yes' : 'no '}  ${k}`);

  // Every existing row must already satisfy the loosened rules, or the new CHECK would refuse to be added.
  const pre = {
    'new posts with no collaboration (must be 0)': (await one(`SELECT count(*)::int n FROM creator_posts WHERE v2 AND campaign_influencer_id IS NULL`)).n,
    'new posts with no brand (must be 0)': (await one(`SELECT count(*)::int n FROM creator_posts WHERE v2 AND brand_id IS NULL`)).n,
    'order lines with no collaboration (must be 0)': (await one(`SELECT count(*)::int n FROM order_lines WHERE campaign_influencer_id IS NULL`)).n,
    'numbers holding both a brand and a creator account': (await one(
      `SELECT count(*)::int n FROM users b JOIN users c ON c.phone = b.phone AND c.role = 'influencer' JOIN brands br ON br.user_id = b.id JOIN influencers i ON i.user_id = c.id WHERE b.role = 'brand'`)).n,
  };
  console.log('\n── before applying ──');
  for (const [k, v] of Object.entries(pre)) console.log(`  ${String(v).padStart(4)}  ${k}`);
  const alreadyOwn = s0['creator_posts.own_brand'];
  const blocked = !alreadyOwn && (pre['new posts with no collaboration (must be 0)'] || pre['new posts with no brand (must be 0)'] || pre['order lines with no collaboration (must be 0)']);
  if (blocked) { console.error('\nSTOP — an existing row would break the loosened rule. Nothing written.'); await c.end(); process.exit(1); }

  const before = await fixed();
  console.log('\n── before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(16)}: ${v}`);

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '206_own_brand.sql'), 'utf8'));
  console.log('\nAPPLIED 206_own_brand.sql');

  const s1 = await shape();
  let bad = 0;
  const ok = (label, good) => { if (!good) bad += 1; console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${label}`); };
  console.log('');
  for (const [k, v] of Object.entries(s1)) ok(k, v === true);
  ok('no post is an own-brand post yet', alreadyOwn || (await one(`SELECT count(*)::int n FROM creator_posts WHERE own_brand`)).n === 0);
  ok('no link, no link code and no place exists yet', alreadyOwn || (await one(
    `SELECT (SELECT count(*) FROM creator_brand_links)::int + (SELECT count(*) FROM brand_link_codes)::int + (SELECT count(*) FROM post_share_places)::int AS n`)).n === 0);

  const after = await fixed();
  console.log('\n── after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved += 1;
    console.log(`  ${k.padEnd(16)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nSOMETHING MOVED in ${moved} place(s) — investigate.` : '\nNothing moved: no post, order line, sale, wallet or sign-in code changed.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
