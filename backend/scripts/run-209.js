#!/usr/bin/env node
/**
 * Migration 209 — item 21: Pay for Content shoppable posts + Entire store.
 * Usage: node scripts/run-209.js --dry | --apply   [--env=.env]
 * Contract: features/item21-content-posts · 05-impact.md
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). No existing row is written: one new
 * nullable column, one CHECK widened by a value, one report kind added, one boolean with a default.
 * Every collaboration, content row and escrow row is counted before and after and must be identical.
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
  const has = async (table, column) => !!(await one(
    `SELECT 1 AS x FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, column]));
  const checkText = async (name) => ((await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = $1`, [name])) || {}).d || '';

  const shape = async () => ({
    'campaign_influencers.shoppable_posts_n': await has('campaign_influencers', 'shoppable_posts_n'),
    'sell_mode allows store': /'store'/.test(await checkText('ci_sell_mode_known')),
    'report kind allows posts_not_made': /posts_not_made/.test(await checkText('collab_content_brand_report_kind_check')),
    'escrow_entries.release_held_for_posts': await has('escrow_entries', 'release_held_for_posts'),
  });
  const counts = async () => ({
    collaborations: Number((await one(`SELECT count(*)::int AS n FROM campaign_influencers`)).n),
    sell_v2_rows: Number((await one(`SELECT count(*)::int AS n FROM campaign_influencers WHERE sell_v2`)).n),
    content_rows: Number((await one(`SELECT count(*)::int AS n FROM collab_content`)).n),
    escrow_rows: Number((await one(`SELECT count(*)::int AS n FROM escrow_entries`)).n),
    escrow_queued: Number((await one(`SELECT count(*)::int AS n FROM escrow_entries WHERE status = 'queued'`)).n),
    pay_for_content_collabs: Number((await one(`SELECT count(*)::int AS n FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id WHERE cs.goal = 'engagement'`)).n),
    pay_for_content_on_new_terms: Number((await one(`SELECT count(*)::int AS n FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id WHERE cs.goal = 'engagement' AND ci.sell_v2`)).n),
  });

  const before = { shape: await shape(), counts: await counts() };
  console.log('Before:', JSON.stringify(before, null, 2));
  if (dry) { await c.end(); console.log('Dry run: nothing written.'); return; }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '209_item21_content_posts.sql'), 'utf8');
  await c.query(sql);
  const after = { shape: await shape(), counts: await counts() };
  console.log('After:', JSON.stringify(after, null, 2));
  const same = JSON.stringify(before.counts) === JSON.stringify(after.counts);
  const allOn = Object.values(after.shape).every(Boolean);
  console.log(same ? 'Row counts identical before and after.' : 'ROW COUNTS CHANGED — look.');
  console.log(allOn ? 'Every shape check is on.' : 'A SHAPE CHECK IS OFF — look.');
  await c.end();
  process.exit(same && allOn ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
