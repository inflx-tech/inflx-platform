#!/usr/bin/env node
/**
 * Migration 187 — item 10: the Store Visit shoot plan.
 * Usage: node scripts/run-187.js --dry | --apply             [--env=.env]
 *        node scripts/run-187.js --fix-modes [--apply]        (the Q2 data correction, separately)
 * Contract: features/item10-store-visit · Docs/ITEM10_STOREVISIT_GAP_REPORT.md §4.3, §7
 *
 * --fix-modes: six production_events rows were born 'remote' because the set's shoot_mode never
 * reached the resolver. Sets mode = campaign_sets.shoot_mode on EXACTLY the rows where the two
 * disagree and the set has a mode — nothing else on the row. Run it AFTER the resolver change
 * has been deployed, so the fix and the code that prevents a recurrence land together.
 */
const fs = require('fs');
const path = require('path');
const envArg = process.argv.find(a => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
const fixModes = process.argv.includes('--fix-modes');
if (!apply && !dry && !fixModes) { console.error('Pass --dry, --apply, or --fix-modes [--apply].'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const all = async (sql, p) => (await c.query(sql, p)).rows;

  if (fixModes) {
    console.log('── Q2 data correction: production_events.mode ← campaign_sets.shoot_mode ──');
    const rows = await all(
      `SELECT pe.id, pe.mode AS before, cs.shoot_mode AS after, pe.status, pe.visit_scheduled_at,
              b.business_name AS brand, cs.go_live_date::text AS posts
         FROM production_events pe
         JOIN contracts ct ON ct.id = pe.contract_id
         JOIN campaign_influencers ci ON ci.id = ct.campaign_influencer_id
         JOIN campaign_sets cs ON cs.id = ci.set_id
         JOIN campaigns c ON c.id = cs.campaign_id
         JOIN brands b ON b.id = c.brand_id
        WHERE cs.shoot_mode IS NOT NULL AND pe.mode <> cs.shoot_mode
        ORDER BY cs.shoot_mode, pe.id`);
    console.log(`rows where the shoot row disagrees with its set: ${rows.length}`);
    for (const r of rows) console.log(`  ${r.id}  ${r.before} → ${r.after}   status ${r.status}  time ${r.visit_scheduled_at || '—'}  ${r.brand}  posts ${r.posts}`);
    console.log('untouched by this fix: status, every timestamp, escrow, wallets, contracts.');
    if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }
    await c.query('BEGIN');
    const upd = await c.query(
      `UPDATE production_events pe SET mode = cs.shoot_mode, updated_at = now()
         FROM contracts ct, campaign_influencers ci, campaign_sets cs
        WHERE ct.id = pe.contract_id AND ci.id = ct.campaign_influencer_id AND cs.id = ci.set_id
          AND cs.shoot_mode IS NOT NULL AND pe.mode <> cs.shoot_mode
          AND pe.id = ANY($1::uuid[])`, [rows.map(r => r.id)]);
    if (upd.rowCount !== rows.length) { await c.query('ROLLBACK'); throw new Error(`expected ${rows.length} rows, updated ${upd.rowCount} — rolled back`); }
    await c.query('COMMIT');
    console.log(`\nAPPLIED — ${upd.rowCount} rows.`);
    console.log('after:', JSON.stringify(await all(
      `SELECT pe.id, pe.mode FROM production_events pe WHERE pe.id = ANY($1::uuid[]) ORDER BY pe.id`, [rows.map(r => r.id)])));
    console.log('still disagreeing:', (await one(
      `SELECT count(*)::int n FROM production_events pe JOIN contracts ct ON ct.id = pe.contract_id
         JOIN campaign_influencers ci ON ci.id = ct.campaign_influencer_id JOIN campaign_sets cs ON cs.id = ci.set_id
        WHERE cs.shoot_mode IS NOT NULL AND pe.mode <> cs.shoot_mode`)).n);
    await c.end(); return;
  }

  console.log('production_events                 :', (await one(`SELECT count(*)::int n FROM production_events`)).n);
  console.log('  by mode / status                :', JSON.stringify(await all(`SELECT mode, status, count(*)::int n FROM production_events GROUP BY 1,2 ORDER BY 1,2`)));
  console.log('negotiations                      :', (await one(`SELECT count(*)::int n FROM negotiations`)).n);
  console.log('  with exactly one anchor today   :', (await one(`SELECT count(*)::int n FROM negotiations WHERE (campaign_influencer_id IS NOT NULL) <> (pitch_id IS NOT NULL)`)).n, '(must equal the total or the new CHECK will refuse)');
  console.log('campaign_influencers              :', (await one(`SELECT count(*)::int n FROM campaign_influencers`)).n);
  console.log('platform_settings keys            :', (await one(`SELECT count(*)::int n FROM platform_settings`)).n);
  console.log('shoot rows disagreeing with set   :', (await one(
    `SELECT count(*)::int n FROM production_events pe JOIN contracts ct ON ct.id = pe.contract_id
       JOIN campaign_influencers ci ON ci.id = ct.campaign_influencer_id JOIN campaign_sets cs ON cs.id = ci.set_id
      WHERE cs.shoot_mode IS NOT NULL AND pe.mode <> cs.shoot_mode`)).n, '(corrected separately by --fix-modes)');

  console.log('\nalready applied?                  :', JSON.stringify({
    'production_events.plan_sent_at': !!(await one(`SELECT 1 AS v FROM information_schema.columns WHERE table_name='production_events' AND column_name='plan_sent_at'`)),
    'campaign_influencers.delayed_at': !!(await one(`SELECT 1 AS v FROM information_schema.columns WHERE table_name='campaign_influencers' AND column_name='delayed_at'`)),
    'negotiations.production_event_id': !!(await one(`SELECT 1 AS v FROM information_schema.columns WHERE table_name='negotiations' AND column_name='production_event_id'`)),
    'shoot_auto_confirm_days seeded': !!(await one(`SELECT 1 AS v FROM platform_settings WHERE key='shoot_auto_confirm_days'`)),
  }));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '187_item10_store_visit.sql'), 'utf8'));
  console.log('\nAPPLIED.');
  console.log('production_events (unchanged)     :', (await one(`SELECT count(*)::int n FROM production_events`)).n);
  console.log('negotiations failing new CHECK    :', (await one(`SELECT count(*)::int n FROM negotiations WHERE num_nonnulls(campaign_influencer_id, pitch_id, production_event_id) <> 1`)).n);
  console.log('shoot_auto_confirm_days           :', JSON.stringify(await one(`SELECT value, min_value, max_value FROM platform_settings WHERE key='shoot_auto_confirm_days'`)));
  console.log('delayed rows                      :', (await one(`SELECT count(*)::int n FROM campaign_influencers WHERE delayed_at IS NOT NULL`)).n);
  console.log('\nAll checks OK. Run --fix-modes next (dry first).');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
