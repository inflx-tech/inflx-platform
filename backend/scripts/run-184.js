#!/usr/bin/env node
/**
 * Migration 184 — item 8: the thread anchor, the pitch's columns and limits,
 * the pool's provenance, and the two admin numbers.
 * Usage: node scripts/run-184.js --dry | --apply   [--env=.env]
 * Contract: features/item8-pitch
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

const PITCH_COLS = ['proposed_go_live_date', 'response_due_at', 'response_days',
  'reminder_7d_sent_at', 'reminder_21d_sent_at', 'answered_by', 'cooldown_until',
  'cooldown_days', 'pool_entry_id', 'closed_reason'];
const POOL_COLS = ['from_pitch_id', 'matched_shoot_mode'];
const IDX = ['uq_neg_ci', 'uq_neg_pitch', 'uq_pitch_open_per_aim', 'idx_pitch_due',
  'idx_pitch_date_due', 'idx_pool_from_pitch'];

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  const one = async (s, p) => (await q(s, p))[0];
  const hasCol = async (t, col) => (await one(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col])).n === 1;
  const hasIdx = async (n) => (await one(`SELECT count(*)::int n FROM pg_indexes WHERE indexname=$1`, [n])).n === 1;
  const hasCon = async (n) => (await one(`SELECT count(*)::int n FROM pg_constraint WHERE conname=$1`, [n])).n === 1;
  const ciNullable = async () => (await one(`SELECT is_nullable FROM information_schema.columns WHERE table_name='negotiations' AND column_name='campaign_influencer_id'`)).is_nullable === 'YES';

  console.log(`\n=== migration 184 · ${apply ? 'APPLY' : 'DRY RUN'} · ${envFile} ===\n`);

  const before = await one(`SELECT
      (SELECT count(*)::int FROM influencer_proposals) pitches,
      (SELECT count(*)::int FROM influencer_proposals WHERE flagged) flagged_pitches,
      (SELECT count(*)::int FROM brand_collab_requests) brand_requests,
      (SELECT count(*)::int FROM collab_agreements) agreements,
      (SELECT count(*)::int FROM collab_agreements WHERE status = 'ready') agreements_ready,
      (SELECT count(*)::int FROM negotiations) threads,
      (SELECT count(*)::int FROM negotiation_turns) turns,
      (SELECT count(*)::int FROM campaign_influencers WHERE agreement_id IS NOT NULL) briefed_invitations,
      (SELECT count(*)::int FROM brand_creator_pool) pool_entries,
      (SELECT count(*)::int FROM proposal_cooldowns) creator_cooldowns`, []);
  console.log('before:', before);
  console.log('invitations by source:', await q(`SELECT source, count(*)::int n FROM campaign_influencers GROUP BY 1 ORDER BY 1`));
  console.log('pitches by status:', (await q(`SELECT status, count(*)::int n FROM influencer_proposals GROUP BY 1 ORDER BY 1`)).length
    ? await q(`SELECT status, count(*)::int n FROM influencer_proposals GROUP BY 1 ORDER BY 1`) : '(none)');

  // The partial unique index in part B fails if a creator already has two open
  // pitches of the same Aim to one brand.
  const dupes = await q(`SELECT influencer_id, brand_id, goal, count(*)::int n
                           FROM influencer_proposals
                          WHERE status IN ('sent','viewed','countered')
                          GROUP BY 1,2,3 HAVING count(*) > 1`);
  console.log('creators with two open pitches of one Aim to one brand:', dupes.length ? dupes : '(none — the unique index will build)');
  if (dupes.length) { console.error('\nREFUSING: resolve the duplicates above before applying.'); await c.end(); process.exit(1); }

  // Part A fails if any thread exists with no anchor — impossible today, but
  // the CHECK is NOT VALID-free so it validates on the spot.
  const anchorless = await one(`SELECT count(*)::int n FROM negotiations WHERE campaign_influencer_id IS NULL`, []);
  console.log('threads with no invitation anchor:', anchorless.n);

  const present = {};
  present['negotiations.campaign_influencer_id nullable'] = await ciNullable();
  present['negotiations.pitch_id'] = await hasCol('negotiations', 'pitch_id');
  present['constraint.negotiations_one_anchor'] = await hasCon('negotiations_one_anchor');
  for (const col of PITCH_COLS) present[`influencer_proposals.${col}`] = await hasCol('influencer_proposals', col);
  for (const col of POOL_COLS) present[`brand_creator_pool.${col}`] = await hasCol('brand_creator_pool', col);
  for (const i of IDX) present[`index.${i}`] = await hasIdx(i);
  console.log('already present:', present);
  console.log('nothing to backfill: no pitch is given a date or a deadline it never had, the nineteen ready agreements are untouched, and no pool entry is invented.');

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '184_item8_pitch.sql'), 'utf8');
  await c.query(sql);

  const after = {};
  after['negotiations.campaign_influencer_id nullable'] = await ciNullable();
  after['negotiations.pitch_id'] = await hasCol('negotiations', 'pitch_id');
  after['constraint.negotiations_one_anchor'] = await hasCon('negotiations_one_anchor');
  after['old unique gone'] = !(await hasCon('negotiations_campaign_influencer_id_key'));
  for (const col of PITCH_COLS) after[`influencer_proposals.${col}`] = await hasCol('influencer_proposals', col);
  for (const col of POOL_COLS) after[`brand_creator_pool.${col}`] = await hasCol('brand_creator_pool', col);
  for (const i of IDX) after[`index.${i}`] = await hasIdx(i);
  console.log('after:', after);

  const settings = await q(`SELECT key, value, min_value, max_value FROM platform_settings ORDER BY key`);
  console.log('platform settings:', settings);

  const counts = await one(`SELECT
      (SELECT count(*)::int FROM influencer_proposals) pitches,
      (SELECT count(*)::int FROM collab_agreements) agreements,
      (SELECT count(*)::int FROM collab_agreements WHERE status = 'ready') agreements_ready,
      (SELECT count(*)::int FROM negotiations) threads,
      (SELECT count(*)::int FROM campaign_influencers WHERE agreement_id IS NOT NULL) briefed_invitations,
      (SELECT count(*)::int FROM brand_creator_pool) pool_entries`, []);
  const unchanged = counts.pitches === before.pitches
    && counts.agreements === before.agreements
    && counts.agreements_ready === before.agreements_ready
    && counts.threads === before.threads
    && counts.briefed_invitations === before.briefed_invitations
    && counts.pool_entries === before.pool_entries;
  console.log('row counts unchanged:', unchanged, counts);
  console.log(`the ${before.agreements_ready} ready agreements are untouched, as approved (Q6).`);

  const ok = Object.values(after).every(Boolean) && settings.length === 7 && unchanged;
  console.log(ok ? '\nAll checks OK.' : '\nCHECKS FAILED — inspect above.');
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
