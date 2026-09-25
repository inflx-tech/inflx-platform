#!/usr/bin/env node
/**
 * Migration 192 — item 12: Pay for Content, from the shoot to the last rupee.
 * Usage: node scripts/run-192.js --dry | --apply   [--env=.env]
 * Contract: features/item12-content · Docs/ITEM12_CONTENT_GAP_REPORT.md §8, approval §3.3
 *
 * ADDITIVE throughout, and idempotent (proved by applying it twice to the test database).
 * NO BACKFILL (approval Q31): no collab_content row is created for anyone. The two signed
 * Pay for Content collaborations read "Shoot not done yet" on the new screens.
 *
 * The only pre-existing object it MODIFIES is the campaign_influencers delayed-stage CHECK,
 * widened with the five content stages. final_payment_wait_days is copied from
 * payment_config.tranche_3_release_after_days (Q4); that column stays in place, unread.
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

const CONTENT_STAGES = ['content_not_submitted', 'content_in_review', 'content_changes_requested', 'content_not_posted', 'content_not_confirmed'];
const NEW_TABLES = ['collab_content', 'content_rounds', 'content_files', 'content_file_notes', 'content_captions', 'content_proofs', 'escrow_manual_releases'];
const NEW_KEYS = ['content_change_rounds', 'content_report_silence_days', 'final_payment_wait_days'];

(async () => {
  const masked = url.replace(/:[^:@/]+@/, ':***@');
  console.log('Target:', masked);
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const all = async (sql, p) => (await c.query(sql, p)).rows;
  const has = async (t, col) => !!(await one(
    `SELECT 1 AS v FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col]));
  const table = async (t) => !!(await one(`SELECT 1 AS v FROM information_schema.tables WHERE table_name=$1`, [t]));

  // ── the money, before ────────────────────────────────────────────────────
  const money = async () => ({
    escrow_rows:        (await one(`SELECT count(*)::int n FROM escrow_entries`)).n,
    escrow_total:       (await one(`SELECT COALESCE(sum(amount),0)::text t FROM escrow_entries`)).t,
    escrow_by_status:   JSON.stringify(await all(`SELECT tranche_number t, status::text s, count(*)::int n FROM escrow_entries GROUP BY 1,2 ORDER BY 1,2`)),
    contracts_locked:   (await one(`SELECT COALESCE(sum(locked_amount),0)::text t FROM contracts`)).t,
    contracts_released: (await one(`SELECT COALESCE(sum(released_amount),0)::text t FROM contracts`)).t,
    brand_wallets:      (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM brands`)).t,
    infl_wallets:       (await one(`SELECT COALESCE(sum(wallet_balance),0)::text t FROM influencers`)).t,
    infl_pending:       (await one(`SELECT COALESCE(sum(pending_balance),0)::text t FROM influencers`)).t,
    infl_earned:        (await one(`SELECT COALESCE(sum(total_earned),0)::text t FROM influencers`)).t,
    ledger_rows:        (await one(`SELECT count(*)::int n FROM influencer_ledger`)).n,
    wallet_tx_rows:     (await one(`SELECT count(*)::int n FROM wallet_transactions`)).n,
  });

  console.log('server version                    :', (await one(`SHOW server_version`)).server_version);
  console.log('');
  const pfc = await all(
    `SELECT ci.id, s.shoot_mode, pe.status AS shoot,
            jsonb_array_length(COALESCE(k.terms_json->'work'->'deliverables','[]'::jsonb)) AS rows
       FROM contracts k JOIN campaign_influencers ci ON ci.id = k.campaign_influencer_id
       JOIN campaign_sets s ON s.id = ci.set_id
       LEFT JOIN production_events pe ON pe.contract_id = k.id
      WHERE s.goal = 'engagement' AND k.brand_signed_at IS NOT NULL AND k.influencer_signed_at IS NOT NULL`);
  console.log('signed Pay for Content            :', pfc.length);
  for (const r of pfc) console.log(`  ${r.id}  ${r.shoot_mode}  shoot=${r.shoot}  rows=${r.rows}`);
  console.log('  …with the shoot done            :', pfc.filter(r => r.shoot === 'completed').length);
  console.log('  …whose snapshot lists NO content:', pfc.filter(r => Number(r.rows) === 0).length, '(Q7 — these would refuse the step)');
  console.log('legacy deliverables rows          :', JSON.stringify(await all(
    `SELECT type::text, status::text, count(*)::int n FROM deliverables GROUP BY 1,2 ORDER BY 1,2`)));
  console.log('delayed now                       :', JSON.stringify(await all(
    `SELECT delayed_stage, count(*)::int n FROM campaign_influencers WHERE delayed_at IS NOT NULL GROUP BY 1`)));
  console.log('payment_config T3 wait            :', JSON.stringify(await one(
    `SELECT tranche_3_release_after_days, tranche_3_release_time_ist FROM payment_config LIMIT 1`)));

  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)}: ${v}`);

  const already = {};
  for (const t of NEW_TABLES) already[t] = await table(t);
  already['escrow_entries.release_due_at'] = await has('escrow_entries', 'release_due_at');
  for (const k of NEW_KEYS) already[k] = !!(await one(`SELECT 1 AS v FROM platform_settings WHERE key=$1`, [k]));
  console.log('\nalready applied?                  :', JSON.stringify(already));

  const ck = await one(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ci_delayed_stage_known'`);
  console.log('\nci_delayed_stage_known (current)  :', ck ? ck.def : '(absent)');
  if (ck) console.log('  content stages it would REJECT  :', CONTENT_STAGES.filter(s => !ck.def.includes(`'${s}'`)).join(', ') || 'none');

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  // ── apply ────────────────────────────────────────────────────────────────
  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '192_item12_content.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  // ── verify ───────────────────────────────────────────────────────────────
  const checks = [];
  for (const t of NEW_TABLES) checks.push([`table ${t}`, await table(t)]);
  checks.push(['escrow_entries.release_due_at', await has('escrow_entries', 'release_due_at')]);
  for (const k of NEW_KEYS) checks.push([`platform_settings ${k}`, !!(await one(`SELECT 1 AS v FROM platform_settings WHERE key=$1`, [k]))]);
  const ck2 = await one(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ci_delayed_stage_known'`);
  for (const s of CONTENT_STAGES) checks.push([`delayed CHECK accepts '${s}'`, !!ck2 && ck2.def.includes(`'${s}'`)]);
  checks.push(["delayed CHECK still accepts 'address_not_sent'", !!ck2 && ck2.def.includes(`'address_not_sent'`)]);
  checks.push(['collab_content is empty (no backfill)', (await one(`SELECT count(*)::int n FROM collab_content`)).n === 0]);
  checks.push(['content_files is empty', (await one(`SELECT count(*)::int n FROM content_files`)).n === 0]);
  checks.push(['no release_due_at stamped', (await one(`SELECT count(*)::int n FROM escrow_entries WHERE release_due_at IS NOT NULL`)).n === 0]);
  const wait = await one(`SELECT value FROM platform_settings WHERE key='final_payment_wait_days'`);
  const pc = await one(`SELECT tranche_3_release_after_days AS d FROM payment_config LIMIT 1`);
  checks.push([`final_payment_wait_days carried across (${wait && wait.value} = payment_config ${pc && pc.d})`, !!wait && !!pc && Number(wait.value) === Math.min(60, Math.max(1, Number(pc.d)))]);

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
  console.log('\nnew numbers                       :', JSON.stringify(await all(
    `SELECT key, value, min_value, max_value FROM platform_settings WHERE key = ANY($1) ORDER BY key`, [NEW_KEYS])));

  await c.end();
  if (bad || moved) {
    console.error(`\n${bad} check(s) failed, ${moved} money figure(s) moved.`);
    process.exit(1);
  }
  console.log('\nAll checks OK. No money moved. Push next, then OTA.');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
