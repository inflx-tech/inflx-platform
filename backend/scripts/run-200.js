#!/usr/bin/env node
/**
 * Migration 200 — item 17, the Wallet: the withdrawal hold, the one withdrawal-request table, the
 * add-money orders (one credit per payment), the by-hand corrections record, the new ledger types,
 * and one Admin number (24 hours).
 * Usage: node scripts/run-200.js --dry | --apply   [--env=.env]
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * ADDITIVE. Idempotent. The MIGRATION moves no money: every balance is read before and after and
 * must be identical. (The new CODE moves money differently from then on — see "what changes next".)
 *
 * It refuses to apply if any add-money payment was credited twice: the unique index would fail,
 * and a double credit is something a person must look at first.
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

const TABLES = ['withdrawal_requests', 'wallet_topup_orders', 'money_corrections'];
const COLS = [['brands', 'withdrawal_hold'], ['influencers', 'withdrawal_hold'], ['wallet_transactions', 'source_ref_id']];
const TYPES = ['sale_settlement', 'withdrawal_hold', 'withdrawal_paid', 'withdrawal_release', 'adjustment'];

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const all = async (sql, p) => (await c.query(sql, p)).rows;
  const has = async (t, col) => !!(await one(`SELECT 1 AS v FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col]));
  const table = async (t) => !!(await one(`SELECT 1 AS v FROM information_schema.tables WHERE table_name=$1`, [t]));

  const money = async () => ({
    brand_wallets:    (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM brands`)).t,
    infl_wallets:     (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM influencers`)).t,
    infl_pending:     (await one(`SELECT COALESCE(sum(pending_balance),0)::text t FROM influencers`)).t,
    escrow_total:     (await one(`SELECT COALESCE(sum(amount),0)::text t FROM escrow_entries`)).t,
    escrow_released:  (await one(`SELECT COALESCE(sum(amount),0)::text t FROM escrow_entries WHERE status = 'released'`)).t,
    contracts_locked: (await one(`SELECT COALESCE(sum(locked_amount),0)::text t FROM contracts`)).t,
    wallet_tx_rows:   (await one(`SELECT count(*)::int n FROM wallet_transactions`)).n,
    infl_ledger_rows: (await one(`SELECT count(*)::int n FROM influencer_ledger`)).n,
  });

  console.log('server version   :', (await one(`SHOW server_version`)).server_version);

  // 1. A payment credited twice blocks the unique index — and is a real fault to look at first.
  const dup = await all(
    `SELECT razorpay_payment_id, count(*)::int AS n, sum(amount)::text AS amount, min(brand_id::text) AS brand_id
       FROM wallet_transactions WHERE type = 'topup' AND razorpay_payment_id IS NOT NULL
      GROUP BY 1 HAVING count(*) > 1 ORDER BY 2 DESC`);
  console.log('\npayments credited twice :', dup.length ? JSON.stringify(dup, null, 1) : 'none');

  // 2. What the retired paths left open (nothing here is changed by the migration).
  const oldBrand = await all(`SELECT status::text AS status, count(*)::int n, COALESCE(sum(amount_requested),0)::text amount FROM brand_withdrawals GROUP BY 1 ORDER BY 1`);
  const oldCreator = await all(`SELECT status::text AS status, count(*)::int n, COALESCE(sum(amount_requested),0)::text amount FROM influencer_withdrawals GROUP BY 1 ORDER BY 1`);
  console.log('old brand withdrawals   :', JSON.stringify(oldBrand));
  console.log('old creator withdrawals :', JSON.stringify(oldCreator));
  const stuck = [...oldBrand, ...oldCreator].filter((x) => ['pending', 'processing'].includes(x.status));
  if (stuck.length) console.log('  ! some OLD requests are still waiting. The old approve button is retired with this release — settle them by hand first, or tell me.');
  const dues = (await has('brand_dues', 'source_kind'))
    ? await all(`SELECT COALESCE(source_kind, 'shipment') AS kind, count(*)::int n, COALESCE(sum(amount),0)::text amount FROM brand_dues WHERE settled_at IS NULL GROUP BY 1`)
    : [];
  console.log('open brand dues         :', JSON.stringify(dues), '(an "order" due is a cash-on-delivery debt under the OLD rule; under v1.31 the brand owes nothing for it)');

  // 2b. One bank-details store (W9). The website used to keep a brand's bank details in
  // listing_data.bank_details; withdrawals now read ONLY brands.bank_account_no + bank_ifsc.
  const oldBank = await all(
    `SELECT b.business_name FROM brands b
      WHERE b.listing_data ? 'bank_details' AND COALESCE(b.listing_data->'bank_details'->>'account_number', '') <> ''
        AND b.bank_account_no IS NULL ORDER BY 1`);
  console.log('bank only in old store  :', oldBank.length ? `${oldBank.length} brand(s) — ${oldBank.map((x) => x.business_name).join(', ')} — must re-enter their bank account in Wallet before withdrawing` : 'none');
  const wallets = await one(
    `SELECT (SELECT count(*) FROM brands WHERE wallet_balance > 0)::int AS brands_with_money,
            (SELECT count(*) FROM influencers WHERE wallet_balance > 0)::int AS creators_with_money,
            (SELECT count(*) FROM influencers WHERE wallet_balance > 0 AND upi_id IS NULL AND bank_account_no IS NULL)::int AS creators_no_details`);
  console.log('wallets with money      :', JSON.stringify(wallets));

  // 3. What changes next, once the new code runs (not done by this migration).
  const sales = await one(
    `SELECT count(*) FILTER (WHERE ft.brand_settlement_status = 'pending')::int AS waiting,
            COALESCE(sum(ft.brand_net - COALESCE(ft.brand_net_reversed, 0)) FILTER (WHERE ft.brand_settlement_status = 'pending'), 0)::text AS waiting_amount,
            count(*) FILTER (WHERE ft.brand_settlement_status = 'pending' AND ft.return_window_ends_at <= now()
                               AND (fo.payment_method IS DISTINCT FROM 'cod' OR fo.order_status = 'delivered'))::int AS due_now,
            count(*) FILTER (WHERE ft.brand_settlement_status = 'pending' AND fo.payment_method = 'cod' AND fo.order_status IS DISTINCT FROM 'delivered')::int AS cod_not_delivered,
            count(*) FILTER (WHERE ft.brand_settlement_status = 'settled' AND ft.razorpay_transfer_id IS NOT NULL)::int AS already_transferred
       FROM follower_transactions ft LEFT JOIN follower_orders fo ON fo.id = ft.order_id
      WHERE ft.status = 'completed'`);
  // Sales the OLD path marked settled without ever paying anyone (no bank transfer was ever live):
  // the new code will not credit them again, and the wallet would show them as "added".
  const orphan = await one(
    `SELECT count(*)::int AS settled_never_paid,
            COALESCE(sum(ft.brand_net - COALESCE(ft.brand_net_reversed, 0)), 0)::text AS amount
       FROM follower_transactions ft
      WHERE ft.status = 'completed' AND ft.brand_settlement_status = 'settled' AND ft.checkout_id IS NOT NULL
        AND (ft.razorpay_transfer_id IS NULL OR ft.razorpay_transfer_id LIKE 'trf_mock_%')
        AND ft.brand_net > COALESCE(ft.brand_net_reversed, 0)`);
  console.log('settled, never paid     :', JSON.stringify(orphan), orphan.settled_never_paid ? '← credit each brand once from Money → Disputes & corrections after deploy' : '');

  console.log('\nwhat changes next       :', JSON.stringify(sales));
  console.log('  waiting           = sales whose brand share has not been settled; it will be ADDED TO THE BRAND WALLET when each window closes');
  console.log('  due_now           = of those, the ones the nightly job will add on its next run');
  console.log('  cod_not_delivered = cash orders that wait for Delivered before their window starts');

  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(17)}: ${v}`);
  const already = {};
  for (const t of TABLES) already[t] = await table(t);
  for (const [t, col] of COLS) already[`${t}.${col}`] = await has(t, col);
  console.log('\nalready applied?:', JSON.stringify(already));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); process.exit(dup.length ? 1 : 0); }
  if (dup.length) { console.error('\nNOT APPLIED — a payment was credited twice (above). Fix that first.'); await c.end(); process.exit(1); }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '200_item17_wallet.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  const checks = [];
  for (const t of TABLES) checks.push([`table ${t}`, await table(t)]);
  for (const [t, col] of COLS) checks.push([`${t}.${col}`, await has(t, col)]);
  const labels = (await all(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'wallet_tx_type'`)).map((r) => r.enumlabel);
  for (const t of TYPES) checks.push([`ledger type ${t}`, labels.includes(t)]);
  for (const ix of ['uq_withdrawal_open_brand', 'uq_withdrawal_open_creator', 'uq_wallet_topup_payment']) {
    checks.push([`index ${ix}`, !!(await one(`SELECT 1 AS v FROM pg_indexes WHERE indexname = $1`, [ix]))]);
  }
  const setting = await one(`SELECT value FROM platform_settings WHERE key = 'withdrawal_process_hours'`);
  checks.push(['setting withdrawal_process_hours = 24', !!setting && Number(setting.value) === 24]);
  checks.push(['withdrawal_requests is empty', (await one(`SELECT count(*)::int n FROM withdrawal_requests`)).n === 0 || already.withdrawal_requests]);
  const hold = await one(`SELECT (SELECT COALESCE(sum(withdrawal_hold),0) FROM brands)::float b, (SELECT COALESCE(sum(withdrawal_hold),0) FROM influencers)::float i`);
  checks.push(['nothing on hold yet', (hold.b === 0 && hold.i === 0) || already['brands.withdrawal_hold']]);

  console.log('');
  let bad = 0;
  for (const [label, ok] of checks) { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}`); }
  const after = await money();
  console.log('\n── money after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(v) === String(before[k]);
    if (!same) moved++;
    console.log(`  ${k.padEnd(17)}: ${v}${same ? '' : `   ← was ${before[k]}`}`);
  }
  console.log(moved ? `\nMONEY MOVED in ${moved} place(s) — investigate.` : '\nNo money moved.');
  await c.end();
  process.exit(bad || moved ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
