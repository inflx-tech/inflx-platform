#!/usr/bin/env node
/**
 * Migration 191 — item 11: the Remote shoot, and INFLX's own shipping layer.
 * Usage: node scripts/run-191.js --dry | --apply   [--env=.env]
 * Contract: features/item11-remote · Docs/ITEM11_REMOTE_GAP_REPORT.md §8, approval §3.4
 *
 * ADDITIVE throughout, and idempotent (proved by applying it twice to the test database).
 * NO BACKFILL: the five signed Kanchi Silks Remote collaborations read "Waiting for her
 * address" on the new screens; the unsigned sixth stays invisible.
 *
 * The only pre-existing object it MODIFIES is the campaign_influencers delayed-stage CHECK,
 * which is widened. The current one would reject every Remote stage (finding 3).
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

const REMOTE_STAGES = ['address_not_sent', 'not_booked', 'in_transit', 'not_checked', 'shoot_not_marked'];

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const all = async (sql, p) => (await c.query(sql, p)).rows;
  const has = async (t, col) => !!(await one(
    `SELECT 1 AS v FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col]));
  const table = async (t) => !!(await one(
    `SELECT 1 AS v FROM information_schema.tables WHERE table_name=$1`, [t]));

  // ── the money, before ────────────────────────────────────────────────────
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
  });

  console.log('server version                    :', (await one(`SHOW server_version`)).server_version);
  console.log('');
  console.log('production_events                 :', (await one(`SELECT count(*)::int n FROM production_events`)).n);
  console.log('  by mode / status                :', JSON.stringify(await all(
    `SELECT mode, status, count(*)::int n FROM production_events GROUP BY 1,2 ORDER BY 1,2`)));
  console.log('production_event_items            :', (await one(`SELECT count(*)::int n FROM production_event_items`)).n);
  console.log('production_event_log              :', (await one(`SELECT count(*)::int n FROM production_event_log`)).n);
  console.log('campaign_influencers              :', (await one(`SELECT count(*)::int n FROM campaign_influencers`)).n);
  console.log('  flagged delayed                 :', (await one(`SELECT count(*)::int n FROM campaign_influencers WHERE delayed_at IS NOT NULL`)).n);
  console.log('brand_branches                    :', (await one(`SELECT count(*)::int n FROM brand_branches`)).n);
  console.log('  unusable for a pickup           :', (await one(
    `SELECT count(*)::int n FROM brand_branches
      WHERE NULLIF(btrim(COALESCE(formatted_address,'')),'') IS NULL
         OR NULLIF(btrim(COALESCE(pincode,'')),'') IS NULL`)).n,
    '(no street address or no pincode — F7/F8 refuse these, R6 cannot select them)');
  console.log('platform_settings keys            :', (await one(`SELECT count(*)::int n FROM platform_settings`)).n);
  console.log('wallet_tx_type values             :', (await one(
    `SELECT count(*)::int n FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='wallet_tx_type'`)).n);

  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);

  console.log('\nalready applied?                  :', JSON.stringify({
    'production_events.address_sent_at': await has('production_events', 'address_sent_at'),
    'production_events.ship_to_pincode': await has('production_events', 'ship_to_pincode'),
    'production_event_items.disposition': await has('production_event_items', 'disposition'),
    'production_event_log.seq': await has('production_event_log', 'seq'),
    'shipments': await table('shipments'),
    'shipment_events': await table('shipment_events'),
    'brand_branch_pickups': await table('brand_branch_pickups'),
    'brand_dues': await table('brand_dues'),
    'remote_return_autoconfirm_days seeded': !!(await one(
      `SELECT 1 AS v FROM platform_settings WHERE key='remote_return_autoconfirm_days'`)),
  }, null, 0));

  // Does the CURRENT delayed CHECK reject the Remote stages? (finding 3)
  const ck = await one(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ci_delayed_stage_known'`);
  console.log('\nci_delayed_stage_known (current)  :', ck ? ck.def : '(absent)');
  if (ck) {
    const rejects = REMOTE_STAGES.filter(s => !ck.def.includes(`'${s}'`));
    console.log('  Remote stages it would REJECT   :', rejects.length ? rejects.join(', ') : 'none');
  }

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  // ── apply ────────────────────────────────────────────────────────────────
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '191_item11_remote.sql'), 'utf8');
  await c.query(sql);
  console.log('\nAPPLIED.');

  // ── verify ───────────────────────────────────────────────────────────────
  const checks = [];
  const want = async (label, fn) => { const ok = await fn(); checks.push([label, ok]); };

  await want('production_events.address_sent_at', () => has('production_events', 'address_sent_at'));
  await want('production_events.ship_to_pincode', () => has('production_events', 'ship_to_pincode'));
  await want('production_events.coverage_return_pickup', () => has('production_events', 'coverage_return_pickup'));
  await want('production_event_items.disposition', () => has('production_event_items', 'disposition'));
  await want('production_event_items.variant_id', () => has('production_event_items', 'variant_id'));
  await want('production_event_log.seq', () => has('production_event_log', 'seq'));
  await want('shipments', () => table('shipments'));
  await want('shipment_events', () => table('shipment_events'));
  await want('brand_branch_pickups', () => table('brand_branch_pickups'));
  await want('brand_dues', () => table('brand_dues'));
  await want('remote_return_autoconfirm_days seeded', async () => !!(await one(
    `SELECT 1 AS v FROM platform_settings WHERE key='remote_return_autoconfirm_days'`)));
  await want('shipment_events.dedupe_key is UNIQUE', async () => !!(await one(
    `SELECT 1 AS v FROM pg_indexes WHERE tablename='shipment_events' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%dedupe_key%'`)));
  await want('shipments.production_event_id is ON DELETE RESTRICT', async () => !!(await one(
    `SELECT 1 AS v FROM pg_constraint WHERE conrelid='shipments'::regclass AND contype='f' AND confdeltype='r'`)));
  await want('shipments.production_event_id is NULLABLE (item 16)', async () => !!(await one(
    `SELECT 1 AS v FROM information_schema.columns WHERE table_name='shipments' AND column_name='production_event_id' AND is_nullable='YES'`)));

  const ck2 = await one(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ci_delayed_stage_known'`);
  for (const s of REMOTE_STAGES) checks.push([`delayed CHECK accepts '${s}'`, !!ck2 && ck2.def.includes(`'${s}'`)]);

  const enums = (await all(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='wallet_tx_type'`)).map(r => r.enumlabel);
  for (const v of ['courier_charge', 'courier_lock', 'courier_lock_release', 'courier_refund'])
    checks.push([`wallet_tx_type has '${v}'`, enums.includes(v)]);
  checks.push(['wallet_tx_type still has escrow_lock (untouched)', enums.includes('escrow_lock')]);

  console.log('');
  let bad = 0;
  for (const [label, ok] of checks) { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}`); }

  // ── the money, after ─────────────────────────────────────────────────────
  const after = await money();
  console.log('\n── money after ──');
  let moved = 0;
  for (const [k, v] of Object.entries(after)) {
    const same = String(before[k]) === String(v);
    if (!same) moved++;
    console.log(`  ${same ? 'same' : 'MOVED'}  ${k.padEnd(20)}: ${v}${same ? '' : `   (was ${before[k]})`}`);
  }

  console.log('\nrows in the new tables            :', JSON.stringify({
    shipments:            (await one(`SELECT count(*)::int n FROM shipments`)).n,
    shipment_events:      (await one(`SELECT count(*)::int n FROM shipment_events`)).n,
    brand_branch_pickups: (await one(`SELECT count(*)::int n FROM brand_branch_pickups`)).n,
    brand_dues:           (await one(`SELECT count(*)::int n FROM brand_dues`)).n,
  }), '(all zero — no backfill, by design)');
  console.log('production_events (unchanged)     :', (await one(`SELECT count(*)::int n FROM production_events`)).n);
  console.log('remote_return_autoconfirm_days    :', JSON.stringify(await one(
    `SELECT value, min_value, max_value FROM platform_settings WHERE key='remote_return_autoconfirm_days'`)));

  await c.end();
  if (bad || moved) {
    console.error(`\n${bad} check(s) failed, ${moved} money figure(s) moved.`);
    process.exit(1);
  }
  console.log('\nAll checks OK. No money moved. Push next, then OTA.');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
