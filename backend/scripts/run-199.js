#!/usr/bin/env node
/**
 * Migration 199 — item 14, Pay for Sale going live: the social rows she names, the
 * self-confirmation stamp, the brand's report reasons, the six Delayed sale stages, one Admin number.
 * Usage: node scripts/run-199.js --dry | --apply   [--env=.env]
 * Contract: features/item14-sale-going-live · master rules v1.30 §12.1
 *
 * ADDITIVE. Idempotent. Money is read before and after and must be identical (item 14 moves none).
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

const COLS = [['collab_content', 'autoconfirm_days'], ['collab_content', 'autoconfirm_at'], ['collab_content', 'live_confirmed_auto']];
const SALE_STAGES = ['posts_not_approved', 'social_not_sent', 'social_in_review', 'social_changes_requested', 'social_not_posted', 'social_not_confirmed'];

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
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
  });

  console.log('server version   :', (await one(`SHOW server_version`)).server_version);
  const sale = await one(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE ci.sell_v2)::int new_terms,
            count(*) FILTER (WHERE ci.sell_v2 AND EXISTS (SELECT 1 FROM contracts con JOIN production_events pe ON pe.contract_id = con.id
                              WHERE con.campaign_influencer_id = ci.id AND pe.status = 'completed'))::int shoot_done
       FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id
      WHERE cs.goal = 'conversion' AND ci.status::text IN ('contracted','active','completed')`);
  console.log('sale collabs     :', JSON.stringify(sale), '(signed Pay for Sale · on the new terms · shoot done)');
  console.log('delayed now      :', JSON.stringify((await c.query(`SELECT delayed_stage, count(*)::int n FROM campaign_influencers WHERE delayed_at IS NOT NULL GROUP BY 1`)).rows));
  const before = await money();
  console.log('\n── money before ──');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(17)}: ${v}`);
  const already = { content_social_rows: await table('content_social_rows') };
  for (const [t, col] of COLS) already[`${t}.${col}`] = await has(t, col);
  console.log('\nalready applied?:', JSON.stringify(already));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '199_item14_sale_going_live.sql'), 'utf8'));
  console.log('\nAPPLIED.');

  const checks = [['table content_social_rows', await table('content_social_rows')]];
  for (const [t, col] of COLS) checks.push([`${t}.${col}`, await has(t, col)]);
  const delayedDef = (await one(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname = 'ci_delayed_stage_known'`) || {}).d || '';
  for (const st of SALE_STAGES) checks.push([`Delayed stage ${st}`, delayedDef.includes(`'${st}'`)]);
  const reportDef = (await one(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname = 'collab_content_brand_report_kind_check'`) || {}).d || '';
  for (const k of ['not_posted', 'missing', 'posted_wrong', 'rounds_used']) checks.push([`report kind ${k}`, reportDef.includes(`'${k}'`)]);
  const setting = await one(`SELECT value FROM platform_settings WHERE key = 'sale_live_autoconfirm_days'`);
  checks.push(['setting sale_live_autoconfirm_days = 7', !!setting && Number(setting.value) === 7]);

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
