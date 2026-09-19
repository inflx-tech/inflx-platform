#!/usr/bin/env node
/**
 * Migration 188 — registration-and-profile: the offered lists, the 30 languages, the Other niche,
 * the creator and brand profile columns, submitted-for-review.
 * Usage: node scripts/run-188.js --dry | --apply   [--env=.env]
 * Contract: features/registration-and-profile
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
if (apply && /localhost|127\.0\.0\.1/.test(url)) { console.error('--apply refuses a localhost DATABASE_URL.'); process.exit(2); }
console.log('Target:', url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:****@'));

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const has = async (table, col) => !!(await one(`SELECT 1 AS v FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [table, col]));

  const before = {
    ref_states: (await one(`SELECT count(*)::int n FROM ref_states`)).n,
    ref_cities: (await one(`SELECT count(*)::int n FROM ref_cities`)).n,
    ref_languages: (await one(`SELECT count(*)::int n FROM ref_languages`)).n,
    ref_creator_niches: (await one(`SELECT count(*)::int n FROM ref_creator_niches`)).n,
    influencers: (await one(`SELECT count(*)::int n FROM influencers`)).n,
    brands: (await one(`SELECT count(*)::int n FROM brands`)).n,
    pending_influencers: (await one(`SELECT count(*)::int n FROM influencers i JOIN users u ON u.id=i.user_id WHERE u.status='pending'`)).n,
    pending_brands: (await one(`SELECT count(*)::int n FROM brands b JOIN users u ON u.id=b.user_id WHERE u.status='pending'`)).n,
    rajahmundry_rows: (await one(`SELECT count(*)::int n FROM ref_cities WHERE name_norm IN ('rajahmundry','rajamahendravaram')`)).n,
  };
  console.log('before:', JSON.stringify(before, null, 2));
  console.log('already applied?:', JSON.stringify({
    'ref_states.is_offered': await has('ref_states', 'is_offered'),
    'influencers.state_id': await has('influencers', 'state_id'),
    'brands.bank_account_no': await has('brands', 'bank_account_no'),
    'niche other': !!(await one(`SELECT 1 AS v FROM ref_creator_niches WHERE code='other'`)),
  }));

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '188_registration_and_profile.sql'), 'utf8'));
  console.log('\nAPPLIED.');
  const after = {
    offered_states: (await one(`SELECT count(*)::int n FROM ref_states WHERE is_offered`)).n,
    offered_cities: (await one(`SELECT count(*)::int n FROM ref_cities WHERE is_offered`)).n,
    offered_cities_outside_six: (await one(`SELECT count(*)::int n FROM ref_cities c JOIN ref_states s ON s.id=c.state_id WHERE c.is_offered AND NOT s.is_offered`)).n,
    ref_states: (await one(`SELECT count(*)::int n FROM ref_states`)).n,
    ref_cities: (await one(`SELECT count(*)::int n FROM ref_cities`)).n,
    ref_languages: (await one(`SELECT count(*)::int n FROM ref_languages WHERE active`)).n,
    first_three_languages: (await c.query(`SELECT code FROM ref_languages WHERE active ORDER BY sort, label LIMIT 3`)).rows.map(r => r.code).join(','),
    sanskrit: (await one(`SELECT count(*)::int n FROM ref_languages WHERE lower(code)='sanskrit'`)).n,
    ref_creator_niches: (await one(`SELECT count(*)::int n FROM ref_creator_niches`)).n,
    influencers_with_state: (await one(`SELECT count(*)::int n FROM influencers WHERE state_id IS NOT NULL`)).n,
    influencers_with_city: (await one(`SELECT count(*)::int n FROM influencers WHERE city_id IS NOT NULL`)).n,
    pending_influencers_submitted: (await one(`SELECT count(*)::int n FROM influencers WHERE submitted_for_review_at IS NOT NULL`)).n,
    pending_brands_submitted: (await one(`SELECT count(*)::int n FROM brands WHERE submitted_for_review_at IS NOT NULL`)).n,
  };
  console.log('after:', JSON.stringify(after, null, 2));
  const problems = [];
  if (after.offered_states !== 6) problems.push(`offered states ${after.offered_states} ≠ 6`);
  if (after.offered_cities !== 146) problems.push(`offered cities ${after.offered_cities} ≠ 146`);
  if (after.offered_cities_outside_six !== 0) problems.push('an offered city sits under an unoffered state');
  if (after.ref_languages !== 30) problems.push(`languages ${after.ref_languages} ≠ 30`);
  if (after.first_three_languages !== 'English,Hindi,Telugu') problems.push(`language order ${after.first_three_languages}`);
  if (after.sanskrit !== 0) problems.push('Sanskrit present');
  if (after.ref_creator_niches !== before.ref_creator_niches + 1) problems.push('niche count did not grow by exactly one');
  if (after.ref_states !== before.ref_states) problems.push('a state was added or removed');
  if (after.influencers_with_state !== after.influencers_with_city) problems.push('a creator with a city has no state');
  if (after.pending_influencers_submitted < before.pending_influencers) problems.push('a pending creator is not marked submitted');
  if (after.pending_brands_submitted < before.pending_brands) problems.push('a pending brand is not marked submitted');
  if (problems.length) { console.error('\nCHECKS FAILED (migration committed — review by hand):', problems); process.exit(1); }
  console.log('\nAll checks OK.');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
