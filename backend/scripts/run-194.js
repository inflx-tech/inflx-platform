#!/usr/bin/env node
/**
 * Migration 194 — creator-terms-v2: what a creator can sell is her offers + products without offers.
 * Usage: node scripts/run-194.js --dry | --apply   [--env=.env]
 * Contract: features/creator-terms-v2 · Docs/OFFER_TERMS_POSTS_RULES.md §2
 *
 * ADDITIVE. Every existing collaboration keeps its old terms (sell_v2 = false) and is read as
 * before. Idempotent (applied twice to the test database).
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

const CI_COLS = ['sell_v2', 'sell_mode', 'sell_product_ids', 'withdrawn_reason'];
const CONSTRAINTS = ['ci_sell_mode_known', 'ci_sell_v2_no_old_scope'];

(async () => {
  const masked = url.replace(/:[^:@/]+@/, ':***@');
  console.log('Target:', masked);
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const all = async (sql, p) => (await c.query(sql, p)).rows;
  const has = async (t, col) => !!(await one(`SELECT 1 AS v FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col]));

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
  const byStatus = await all(`SELECT status, count(*)::int n FROM campaign_influencers GROUP BY status ORDER BY status`);
  const ciCount = byStatus.reduce((s, r) => s + r.n, 0);
  console.log(`collaborations                  : ${ciCount}  (${byStatus.map(r => `${r.status} ${r.n}`).join(' · ') || 'none'})`);
  console.log('  — all keep their old terms; none is changed');
  console.log('collab_offers rows              :', (await one(`SELECT count(*)::int n FROM collab_offers`)).n);
  console.log('new-builder offers              :', (await one(`SELECT count(*)::int n FROM brand_offers WHERE engine = 2`)).n);

  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);

  const already = {};
  for (const col of CI_COLS) already[`campaign_influencers.${col}`] = await has('campaign_influencers', col);
  already['collab_offers.dropped_reason'] = await has('collab_offers', 'dropped_reason');
  console.log('\nalready applied?                :', JSON.stringify(already));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '194_creator_terms_v2.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  const checks = [];
  for (const col of CI_COLS) checks.push([`campaign_influencers.${col}`, await has('campaign_influencers', col)]);
  checks.push(['collab_offers.dropped_reason', await has('collab_offers', 'dropped_reason')]);
  for (const k of CONSTRAINTS) checks.push([`constraint ${k}`, !!(await one(`SELECT 1 AS v FROM pg_constraint WHERE conname = $1`, [k]))]);
  checks.push(['index idx_ci_sell_products', !!(await one(`SELECT 1 AS v FROM pg_indexes WHERE indexname = 'idx_ci_sell_products'`))]);
  checks.push(['collaboration count unchanged', (await one(`SELECT count(*)::int n FROM campaign_influencers`)).n === ciCount]);
  checks.push(['no collaboration moved to the new terms', (await one(`SELECT count(*)::int n FROM campaign_influencers WHERE sell_v2`)).n === 0]);

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
