#!/usr/bin/env node
/**
 * Migration 182 — item 6: negotiation columns, the move request, the pool table, platform
 * settings + audit. Usage: node scripts/run-182.js --dry | --apply   [--env=.env]
 * Contract: features/item6-negotiation
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

const COLS = {
  negotiations: ['round_limit', 'outcome', 'ended_at', 'ended_by', 'turn_changed_at', 'reminder_48h_sent_at', 'reminder_7d_sent_at'],
  negotiation_turns: ['kind', 'terms_json', 'decline_reason', 'decline_note'],
  campaign_influencers: ['move_requested_at', 'move_answer', 'move_answered_at', 'min_shoppable_posts', 'pool_entry_id'],
};

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  const one = async (s, p) => (await q(s, p))[0];
  const hasCol = async (t, col) => (await one(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col])).n === 1;
  const hasTable = async (t) => (await one(`SELECT count(*)::int n FROM information_schema.tables WHERE table_name=$1`, [t])).n === 1;
  const hasIdx = async (name) => (await one(`SELECT count(*)::int n FROM pg_indexes WHERE indexname=$1`, [name])).n === 1;

  console.log(`\n=== migration 182 · ${apply ? 'APPLY' : 'DRY RUN'} · ${envFile} ===\n`);
  const before = await one(`SELECT
      (SELECT count(*)::int FROM negotiations) negotiations,
      (SELECT count(*)::int FROM negotiation_turns) turns,
      (SELECT count(*)::int FROM campaign_influencers WHERE status = 'deferred') deferred,
      (SELECT count(*)::int FROM campaign_influencers) invitations,
      (SELECT count(*)::int FROM campaigns WHERE allow_negotiation = false) switch_off`, []);
  console.log('before:', before);
  const present = {};
  for (const [t, cols] of Object.entries(COLS)) for (const col of cols) present[`${t}.${col}`] = await hasCol(t, col);
  console.log('columns already present:', present);
  console.log('tables already present:', { brand_creator_pool: await hasTable('brand_creator_pool'), platform_settings: await hasTable('platform_settings'), platform_settings_audit: await hasTable('platform_settings_audit') });
  console.log('nothing to backfill: production negotiations and deferred rows are zero; settings are seeded with their defaults (rounds 2, lifetime 30, shoppable posts 1).');

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '182_item6_negotiation_pool_settings.sql'), 'utf8');
  await c.query(sql);

  const after = { brand_creator_pool: await hasTable('brand_creator_pool'), platform_settings: await hasTable('platform_settings'), platform_settings_audit: await hasTable('platform_settings_audit'),
    idx_negotiation_turns_neg: await hasIdx('idx_negotiation_turns_neg'), idx_pool_brand_state: await hasIdx('idx_pool_brand_state'), idx_pool_due: await hasIdx('idx_pool_due') };
  for (const [t, cols] of Object.entries(COLS)) for (const col of cols) after[`${t}.${col}`] = await hasCol(t, col);
  const settings = await q(`SELECT key, value, min_value, max_value FROM platform_settings ORDER BY key`);
  const counts = await one(`SELECT (SELECT count(*)::int FROM negotiations) negotiations, (SELECT count(*)::int FROM negotiation_turns) turns, (SELECT count(*)::int FROM campaign_influencers) invitations`, []);
  console.log('after:', after);
  console.log('settings:', settings);
  console.log('row counts unchanged:', counts.negotiations === before.negotiations && counts.turns === before.turns && counts.invitations === before.invitations, counts);
  const ok = Object.values(after).every(Boolean) && settings.length === 3 && counts.invitations === before.invitations;
  console.log(ok ? '\nAll checks OK.' : '\nCHECKS FAILED — inspect above.');
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
