#!/usr/bin/env node
/**
 * Migration 208 — a creator's own delivery address (new table), and the rest of her bank details
 * (three columns on influencers, two on withdrawal_requests).
 * Usage: node scripts/run-208.js --dry | --apply   [--env=.env]
 * Contract: features/creator-address-bank-save · 05-impact.md
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). No value is written into any existing
 * row: the table arrives empty and the five columns arrive NULL. Every creator's saved bank
 * account, every withdrawal request, every sent Remote address and every wallet is read before and
 * after and must be identical.
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
  const hasTable = async (table) => !!(await one(
    `SELECT 1 AS x FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [table]));
  const has = async (table, column) => !!(await one(
    `SELECT 1 AS x FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, column]));
  const hasCheck = async (name) => !!(await one(`SELECT 1 AS x FROM pg_constraint WHERE conname = $1`, [name]));

  const shape = async () => ({
    'table creator_delivery_addresses': await hasTable('creator_delivery_addresses'),
    'check: pincode is six digits': await hasCheck('creator_delivery_addresses_pincode'),
    'check: phone is a ten-digit mobile': await hasCheck('creator_delivery_addresses_phone'),
    'check: street is 1 to 190 characters': await hasCheck('creator_delivery_addresses_street'),
    'influencers.bank_holder_name': await has('influencers', 'bank_holder_name'),
    'influencers.bank_name': await has('influencers', 'bank_name'),
    'influencers.bank_branch': await has('influencers', 'bank_branch'),
    'withdrawal_requests.bank_name': await has('withdrawal_requests', 'bank_name'),
    'withdrawal_requests.bank_branch': await has('withdrawal_requests', 'bank_branch'),
  });
  // What must not move.
  const fixed = async () => ({
    creators:          (await one(`SELECT count(*)::int n FROM influencers`)).n,
    creator_bank:      (await one(`SELECT COALESCE(md5(string_agg(id::text || '|' || COALESCE(bank_account_no,'') || '|' || COALESCE(bank_ifsc,'') || '|' || COALESCE(upi_id,''), ',' ORDER BY id)), '-') t FROM influencers`)).t,
    creators_with_bank:(await one(`SELECT count(*)::int n FROM influencers WHERE bank_account_no IS NOT NULL`)).n,
    withdrawals:       (await one(`SELECT count(*)::int n FROM withdrawal_requests`)).n,
    withdrawals_print: (await one(`SELECT COALESCE(md5(string_agg(id::text || '|' || status || '|' || amount::text || '|' || method || '|' || payee_name || '|' || COALESCE(account_enc,'') || '|' || COALESCE(ifsc,'') || '|' || COALESCE(payee_masked,''), ',' ORDER BY id)), '-') t FROM withdrawal_requests`)).t,
    sent_addresses:    (await one(`SELECT count(*)::int n FROM production_events WHERE address_sent_at IS NOT NULL`)).n,
    sent_print:        (await one(`SELECT COALESCE(md5(string_agg(id::text || '|' || COALESCE(ship_to_name,'') || '|' || COALESCE(ship_to_street,'') || '|' || COALESCE(ship_to_pincode,''), ',' ORDER BY id)), '-') t FROM production_events WHERE address_sent_at IS NOT NULL`)).t,
    brand_wallets:     (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM brands`)).t,
    infl_wallets:      (await one(`SELECT COALESCE(sum(wallet_balance), 0)::text t FROM influencers`)).t,
    infl_hold:         (await one(`SELECT COALESCE(sum(withdrawal_hold), 0)::text t FROM influencers`)).t,
    infl_pending:      (await one(`SELECT COALESCE(sum(pending_balance), 0)::text t FROM influencers`)).t,
  });

  console.log('server version   :', (await one(`SHOW server_version`)).server_version);
  const s0 = await shape();
  console.log('\nalready there?');
  for (const [k, v] of Object.entries(s0)) console.log(`  ${v ? 'yes' : 'no '}  ${k}`);
  const before = await fixed();
  console.log('\n── before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(19)}: ${v}`);

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '208_creator_delivery_address_bank_details.sql'), 'utf8'));
  console.log('\nAPPLIED 208_creator_delivery_address_bank_details.sql');

  const s1 = await shape();
  let bad = 0;
  const ok = (label, good) => { if (!good) bad += 1; console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${label}`); };
  console.log('');
  for (const [k, v] of Object.entries(s1)) ok(k, v === true);
  ok('no creator keeps an address yet', s0['table creator_delivery_addresses'] || (await one(`SELECT count(*)::int n FROM creator_delivery_addresses`)).n === 0);
  ok('no creator has a holder name, bank or branch yet', s0['influencers.bank_name']
    || (await one(`SELECT count(*)::int n FROM influencers WHERE bank_holder_name IS NOT NULL OR bank_name IS NOT NULL OR bank_branch IS NOT NULL`)).n === 0);
  ok('no withdrawal request has a bank or branch yet', s0['withdrawal_requests.bank_name']
    || (await one(`SELECT count(*)::int n FROM withdrawal_requests WHERE bank_name IS NOT NULL OR bank_branch IS NOT NULL`)).n === 0);

  const after = await fixed();
  console.log('\n── after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved += 1;
    console.log(`  ${k.padEnd(19)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nSOMETHING MOVED in ${moved} place(s) — investigate.` : '\nNothing moved: no saved bank account, withdrawal request, sent address or wallet changed.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
