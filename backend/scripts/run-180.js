#!/usr/bin/env node
/**
 * Migration 180 — item 4: campaign/set columns, the branch CHECK, three indexes.
 * Usage: node scripts/run-180.js --dry | --apply   [--env=.env]
 * Contract: features/item4-campaigns-sets
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

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  const one = async (s, p) => (await q(s, p))[0];
  const hasCol = async (t, col) => (await one(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col])).n === 1;
  const hasIdx = async (name) => (await one(`SELECT count(*)::int n FROM pg_indexes WHERE indexname=$1`, [name])).n === 1;

  console.log(`\n=== migration 180 · ${apply ? 'APPLY' : 'DRY RUN'} · ${envFile} ===\n`);
  const before = await one(`SELECT
      (SELECT count(*)::int FROM campaigns) campaigns,
      (SELECT count(*)::int FROM campaign_sets) sets,
      (SELECT count(*)::int FROM campaign_sets WHERE shoot_mode = 'visit') visit_sets,
      (SELECT count(*)::int FROM campaign_influencers) invitations`);
  console.log('before:', before);
  console.log('columns already present:', {
    'campaigns.updated_at': await hasCol('campaigns', 'updated_at'),
    'campaigns.started_from_group_id': await hasCol('campaigns', 'started_from_group_id'),
    'campaign_sets.branch_id': await hasCol('campaign_sets', 'branch_id'),
    'campaign_sets.expired_at': await hasCol('campaign_sets', 'expired_at'),
  });
  console.log('indexes already present:', {
    idx_campaign_sets_campaign: await hasIdx('idx_campaign_sets_campaign'),
    idx_campaign_sets_due: await hasIdx('idx_campaign_sets_due'),
    idx_ci_set_status: await hasIdx('idx_ci_set_status'),
  });
  console.log(`sets that would fail the branch CHECK (visit with no branch): ${before.visit_sets} (expected 0)`);

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '180_item4_campaign_sets_state.sql'), 'utf8');
  await c.query(sql);

  const after = {
    'campaigns.updated_at': await hasCol('campaigns', 'updated_at'),
    'campaigns.started_from_group_id': await hasCol('campaigns', 'started_from_group_id'),
    'campaign_sets.branch_id': await hasCol('campaign_sets', 'branch_id'),
    'campaign_sets.created_at': await hasCol('campaign_sets', 'created_at'),
    'campaign_sets.updated_at': await hasCol('campaign_sets', 'updated_at'),
    'campaign_sets.expired_at': await hasCol('campaign_sets', 'expired_at'),
    idx_campaign_sets_campaign: await hasIdx('idx_campaign_sets_campaign'),
    idx_campaign_sets_due: await hasIdx('idx_campaign_sets_due'),
    idx_ci_set_status: await hasIdx('idx_ci_set_status'),
    check_validated: (await one(`SELECT convalidated FROM pg_constraint WHERE conname='campaign_sets_visit_needs_branch'`) || {}).convalidated === true,
  };
  console.log('after:', after);
  const ok = Object.values(after).every(Boolean);
  const counts = await one(`SELECT (SELECT count(*)::int FROM campaigns) campaigns, (SELECT count(*)::int FROM campaign_sets) sets`);
  console.log('row counts unchanged:', counts.campaigns === before.campaigns && counts.sets === before.sets, counts);
  console.log(ok ? '\nAll checks OK.' : '\nCHECKS FAILED — inspect above.');
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
