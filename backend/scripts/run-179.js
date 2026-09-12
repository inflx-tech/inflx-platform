#!/usr/bin/env node
/**
 * Migration 179 — Instagram engagement moves from followers to views, and the numbers are
 * computed from the newest 30 posts instead of every post in 90 days.
 * Usage: node scripts/run-179.js --dry | --apply   [--env=.env]
 * Contract: features/item3b-social-numbers
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

  console.log(`\n=== migration 179 · ${apply ? 'APPLY' : 'DRY RUN'} · ${envFile} ===\n`);
  const before = await one(`SELECT
      (SELECT count(*)::int FROM creator_social_metrics WHERE is_current) AS current_metrics,
      (SELECT count(*)::int FROM creator_social_metrics WHERE ig_engagement IS NOT NULL) AS with_engagement,
      (SELECT count(*)::int FROM influencers WHERE engagement_rate IS NOT NULL) AS legacy_engagement`);
  console.log('before:', before);

  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '179_item3b_engagement_on_views.sql'), 'utf8');
  if (!apply) {
    console.log('\nWould run 179_item3b_engagement_on_views.sql:');
    console.log('  + creator_social_metrics.ig_engagement_basis (views|followers)');
    console.log('  + creator_social_metrics.posts_seen');
    console.log(`  ~ clear ig_engagement on ${before.with_engagement} metrics row(s) computed under the old rule`);
    console.log(`  ~ clear influencers.engagement_rate on ${before.legacy_engagement} creator(s) until their next run`);
    console.log('\nDRY RUN — nothing written.');
    await c.end();
    return;
  }

  await c.query(sql);
  const after = await one(`SELECT
      (SELECT count(*)::int FROM information_schema.columns WHERE table_name='creator_social_metrics' AND column_name='ig_engagement_basis') AS has_basis,
      (SELECT count(*)::int FROM information_schema.columns WHERE table_name='creator_social_metrics' AND column_name='posts_seen') AS has_posts_seen,
      (SELECT count(*)::int FROM creator_social_metrics WHERE ig_engagement IS NOT NULL) AS with_engagement,
      (SELECT count(*)::int FROM influencers WHERE engagement_rate IS NOT NULL) AS legacy_engagement`);
  console.log('after: ', after);
  const ok = after.has_basis === 1 && after.has_posts_seen === 1 && after.with_engagement === 0 && after.legacy_engagement === 0;
  console.log(ok ? '\nAll checks OK. Every creator now shows "—" for engagement until her next run recomputes it.' : '\nCHECKS FAILED — inspect above.');
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
