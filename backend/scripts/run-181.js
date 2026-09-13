#!/usr/bin/env node
/**
 * Migration 181 — item 5: two enum values, eleven invitation columns, two CHECKs, the live-row
 * unique index, the set/created index, and the invited_at / source backfill.
 * Usage: node scripts/run-181.js --dry | --apply   [--env=.env]
 * Contract: features/item5-invitations
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

const COLS = ['invited_at', 'answered_at', 'invited_by', 'source', 'source_group_id', 'brand_note', 'usage_rights_json', 'withdrawn_at', 'withdrawn_by', 'removed_at', 'removed_by'];

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  const one = async (s, p) => (await q(s, p))[0];
  const hasCol = async (col) => (await one(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='campaign_influencers' AND column_name=$1`, [col])).n === 1;
  const hasIdx = async (name) => (await one(`SELECT count(*)::int n FROM pg_indexes WHERE indexname=$1`, [name])).n === 1;
  const enumHas = async (v) => (await one(`SELECT count(*)::int n FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname='campaign_influencer_status' AND e.enumlabel=$1`, [v])).n === 1;

  console.log(`\n=== migration 181 · ${apply ? 'APPLY' : 'DRY RUN'} · ${envFile} ===\n`);
  const before = await one(`SELECT
      count(*)::int AS invitations,
      count(*) FILTER (WHERE agreement_id IS NOT NULL)::int AS from_pitch,
      count(*) FILTER (WHERE agreement_id IS NULL)::int AS not_from_pitch
      FROM campaign_influencers`, []);
  const dups = await q(`SELECT set_id, influencer_id, count(*)::int n FROM campaign_influencers
      WHERE status IN ('invited','applied','accepted','negotiating','contracted','active','completed')
      GROUP BY 1, 2 HAVING count(*) > 1`);
  console.log('before:', before);
  console.log('live duplicates that would break the unique index:', dups.length, dups.length ? dups : '(none)');
  console.log('enum values present:', { withdrawn: await enumHas('withdrawn'), removed: await enumHas('removed') });
  const present = {};
  for (const col of COLS) present[col] = await hasCol(col);
  console.log('columns already present:', present);
  console.log('indexes already present:', { uq_ci_live_per_set: await hasIdx('uq_ci_live_per_set'), idx_ci_set_created: await hasIdx('idx_ci_set_created') });
  console.log(`backfill would set invited_at on ${before.invitations} rows; source = pitch on ${before.from_pitch}, legacy on ${before.not_from_pitch}.`);

  if (dups.length) { console.error('\nRefusing: resolve the duplicate live rows first.'); await c.end(); process.exit(1); }
  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '181_item5_invitations.sql'), 'utf8');
  await c.query(sql);

  const after = { withdrawn: await enumHas('withdrawn'), removed: await enumHas('removed'), uq_ci_live_per_set: await hasIdx('uq_ci_live_per_set'), idx_ci_set_created: await hasIdx('idx_ci_set_created') };
  for (const col of COLS) after[col] = await hasCol(col);
  const fill = await one(`SELECT count(*)::int AS rows,
      count(invited_at)::int AS with_invited_at,
      count(*) FILTER (WHERE source = 'pitch')::int AS src_pitch,
      count(*) FILTER (WHERE source = 'legacy')::int AS src_legacy
      FROM campaign_influencers`, []);
  console.log('after:', after);
  console.log('backfill:', fill);
  const ok = Object.values(after).every(Boolean) && fill.rows === before.invitations && fill.with_invited_at === fill.rows
    && fill.src_pitch === before.from_pitch && fill.src_legacy === before.not_from_pitch;
  console.log(ok ? '\nAll checks OK.' : '\nCHECKS FAILED — inspect above.');
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
