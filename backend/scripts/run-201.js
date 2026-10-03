#!/usr/bin/env node
/**
 * Migration 201 — offer-delete: brand_offers.deleted_at, so a brand can delete an ENDED offer by
 * hiding it from its own lists (creators, posts, orders, the wallet and INFLX keep reading the row).
 * Usage: node scripts/run-201.js --dry | --apply   [--env=.env]
 * Contract: features/offer-delete · Docs/OFFER_TERMS_POSTS_RULES.md v1.17 §1.9
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). NO BACKFILL: every offer stays shown.
 * The migration deletes, hides and moves nothing: the offer, link, pool, post, order and money
 * numbers are read before and after and must be identical.
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

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const all = async (sql, p) => (await c.query(sql, p)).rows;
  const column = async () => one(
    `SELECT data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'brand_offers' AND column_name = 'deleted_at'`);

  // What must not move: the offers themselves, everything that points at them, and the money.
  const counts = async () => ({
    offers_v2:          (await one(`SELECT count(*)::int n FROM brand_offers WHERE engine = 2`)).n,
    offers_v2_draft:    (await one(`SELECT count(*)::int n FROM brand_offers WHERE engine = 2 AND status = 'draft'`)).n,
    offers_v2_published:(await one(`SELECT count(*)::int n FROM brand_offers WHERE engine = 2 AND status = 'published'`)).n,
    offers_v2_ended:    (await one(`SELECT count(*)::int n FROM brand_offers WHERE engine = 2 AND status = 'ended'`)).n,
    offers_old:         (await one(`SELECT count(*)::int n FROM brand_offers WHERE engine <> 2`)).n,
    pool_items:         (await one(`SELECT count(*)::int n FROM offer_pool_items`)).n,
    pool_items_held:    (await one(`SELECT count(*)::int n FROM offer_pool_items WHERE NOT isempty(lock_days)`)).n,
    collab_offers:      (await one(`SELECT count(*)::int n FROM collab_offers`)).n,
    posts_with_offer:   (await one(`SELECT count(*)::int n FROM creator_posts WHERE offer_id IS NOT NULL`)).n,
    order_lines_offer:  (await one(`SELECT count(*)::int n FROM order_lines WHERE offer_id IS NOT NULL`)).n,
    brand_wallets:      (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM brands`)).t,
    infl_wallets:       (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM influencers`)).t,
    infl_pending:       (await one(`SELECT COALESCE(sum(pending_balance),0)::text t FROM influencers`)).t,
  });

  console.log('server version   :', (await one(`SHOW server_version`)).server_version);

  // What the brand will be able to delete once the new code runs (nothing is deleted here).
  const shape = await all(
    `SELECT CASE WHEN status = 'draft' THEN 'draft (erased on delete)'
                 WHEN status = 'ended' THEN 'ended early (hidden on delete)'
                 WHEN ends_on < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN 'ended by date (hidden on delete)'
                 ELSE 'scheduled or live (delete refused)' END AS kind,
            count(*)::int AS n
       FROM brand_offers WHERE engine = 2 GROUP BY 1 ORDER BY 1`);
  console.log('new-builder offers:', shape.length ? '' : 'none');
  for (const r of shape) console.log(`  ${String(r.n).padStart(5)}  ${r.kind}`);

  const col0 = await column();
  console.log('\nalready applied? :', JSON.stringify({ 'brand_offers.deleted_at': !!col0 }));
  if (col0) {
    const hidden = (await one(`SELECT count(*)::int n FROM brand_offers WHERE deleted_at IS NOT NULL`)).n;
    console.log('offers hidden    :', hidden);
  }

  const before = await counts();
  console.log('\n── before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(19)}: ${v}`);

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '201_offer_deleted_at.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  const col = await column();
  const checks = [
    ['brand_offers.deleted_at exists', !!col],
    ['it is a timestamptz', !!col && col.data_type === 'timestamp with time zone'],
    ['it is nullable, with no default', !!col && col.is_nullable === 'YES' && col.column_default === null],
    // No backfill: the migration hides nothing. (On a second run, offers the brand deleted since
    // the first run are its own doing, not this script's — they are counted, not failed.)
    ['no offer hidden by the migration', col0 ? true : (await one(`SELECT count(*)::int n FROM brand_offers WHERE deleted_at IS NOT NULL`)).n === 0],
  ];

  console.log('');
  let bad = 0;
  for (const [label, ok] of checks) { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}`); }
  const after = await counts();
  console.log('\n── after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved++;
    console.log(`  ${k.padEnd(19)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nSOMETHING MOVED in ${moved} place(s) — investigate.` : '\nNothing moved: no offer, link, hold, post, order or money changed.');
  if (col0) console.log('(The column was already there: this run changed nothing.)');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
