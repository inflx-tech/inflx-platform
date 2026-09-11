'use strict';

/**
 * Apply migrations 170–174 (Item 3 — discovery, profiles, creator groups).
 * Contract: features/item3-discovery-profiles-groups
 *
 * 170 seeds the remaining states/UTs + Delhi, Ongole, Karnal (runs FIRST, before backfills)
 * 171 brand profile columns, creator city_id + niche backfills, city uniqueness, state aliases
 * 172 brand_branches table + backfill from listing_data.branches / registration
 * 173 groups: added_by, name length (NOT VALID → VALIDATE in the same run), unique name per brand
 * 174 discovery indexes (+ creator_posts.scoped_brand_ids GIN for item 13)
 *
 * All five files are plain BEGIN/COMMIT (or bare index statements) with no enum changes, so
 * this script runs them inside ONE outer transaction and a dry run genuinely rolls back.
 *
 *   node scripts/run-170-174.js --dry     inspect against production, roll back
 *   node scripts/run-170-174.js --apply   commit against production
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DRY   = process.argv.includes('--dry');
const APPLY = process.argv.includes('--apply');
if (DRY === APPLY) { console.error('Pass exactly one of --dry (inspect, roll back) or --apply (commit).'); process.exit(2); }

require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });
const url = process.env.DATABASE_URL || '';
const HOST = (url.match(/@([^:/?]+)/) || [])[1] || '(unknown)';
if (!url) { console.error('No DATABASE_URL in backend/.env.prod-backup.'); process.exit(2); }
if (APPLY && /^(localhost|127\.0\.0\.1)$/.test(HOST)) { console.error(`Refusing --apply against ${HOST}.`); process.exit(2); }

const FILES = [
  '170_item3_states_cities_seed.sql',
  '171_item3_brand_profile_and_creator_city.sql',
  '172_item3_brand_branches.sql',
  '173_item3_groups.sql',
  '174_item3_discovery_indexes.sql',
];
const stripTx = (sql) => sql.replace(/^\s*BEGIN;\s*$/mg, '').replace(/^\s*COMMIT;\s*$/mg, '');
const one = async (c, sql) => (await c.query(sql)).rows[0].n;
const row = (label, got, want) => { const ok = String(got) === String(want); console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(46)} ${String(got).padStart(4)}   (must be ${want})`); return ok; };

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(DRY ? `=== DRY RUN against ${HOST} — will be rolled back\n` : `=== APPLYING FOR REAL against ${HOST}\n`);

  const before = {
    brands: await one(c, 'SELECT count(*)::int AS n FROM brands'),
    influencers: await one(c, 'SELECT count(*)::int AS n FROM influencers'),
    groups: await one(c, 'SELECT count(*)::int AS n FROM influencer_groups'),
    members: await one(c, 'SELECT count(*)::int AS n FROM influencer_group_members'),
    states: await one(c, 'SELECT count(*)::int AS n FROM ref_states'),
    cities: await one(c, 'SELECT count(*)::int AS n FROM ref_cities'),
    jsonBranches: await one(c, `SELECT COALESCE(sum(jsonb_array_length(COALESCE(listing_data->'branches','[]'::jsonb))),0)::int AS n FROM brands`),
    longNames: await one(c, 'SELECT count(*)::int AS n FROM influencer_groups WHERE char_length(trim(name)) > 40 OR char_length(trim(name)) = 0'),
    dupNames: await one(c, 'SELECT count(*)::int AS n FROM (SELECT brand_id, lower(trim(name)) FROM influencer_groups GROUP BY 1,2 HAVING count(*) > 1) d'),
  };
  console.log('BEFORE');
  console.log(`  brands ${before.brands} · creators ${before.influencers} · groups ${before.groups} / members ${before.members}`);
  console.log(`  states ${before.states} · cities ${before.cities} · JSON branches ${before.jsonBranches}`);
  console.log(`  group names over 40 or empty: ${before.longNames} · case-insensitive duplicates: ${before.dupNames}\n`);
  if (before.longNames || before.dupNames) { console.error('Migration 173 would fail on existing group names. Stopping before any change.'); await c.end(); process.exit(1); }

  await c.query('BEGIN');
  try {
    for (const f of FILES) {
      await c.query(stripTx(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8')));
      console.log(`applied  ${f}`);
    }
    console.log('\nAFTER');
    let ok = true;
    ok &= row('brands rows unchanged', await one(c, 'SELECT count(*)::int AS n FROM brands'), before.brands);
    ok &= row('creators rows unchanged', await one(c, 'SELECT count(*)::int AS n FROM influencers'), before.influencers);
    ok &= row('groups unchanged', await one(c, 'SELECT count(*)::int AS n FROM influencer_groups'), before.groups);
    ok &= row('members unchanged', await one(c, 'SELECT count(*)::int AS n FROM influencer_group_members'), before.members);
    ok &= row('ref_states', await one(c, 'SELECT count(*)::int AS n FROM ref_states'), 36);
    ok &= row('ref_cities', await one(c, 'SELECT count(*)::int AS n FROM ref_cities'), before.cities + 29 - (before.cities > 63 ? before.cities - 63 : 0));
    ok &= row('brands with exactly one main branch', await one(c, `SELECT count(*)::int AS n FROM brands b WHERE (SELECT count(*) FROM brand_branches x WHERE x.brand_id=b.id AND x.is_main) = 1`), before.brands);
    ok &= row('brand_branches rows ≥ JSON branches', (await one(c, 'SELECT count(*)::int AS n FROM brand_branches')) >= before.jsonBranches ? 'yes' : 'no', 'yes');
    ok &= row('creators with a capitalised niche', await one(c, `SELECT count(*)::int AS n FROM influencers WHERE cardinality(niche)=1 AND niche[1] <> lower(niche[1])`), 0);
    ok &= row('state aliases', await one(c, 'SELECT count(*)::int AS n FROM ref_state_aliases'), 13);

    const { rows: unmatchedCreators } = await c.query(`SELECT COALESCE(i.city,u.city) AS city, count(*)::int AS n FROM influencers i JOIN users u ON u.id=i.user_id WHERE i.city_id IS NULL GROUP BY 1`);
    const { rows: unmatchedBranches } = await c.query(`SELECT b.business_name, x.name, x.formatted_address FROM brand_branches x JOIN brands b ON b.id=x.brand_id WHERE x.city_id IS NULL`);
    const { rows: contact } = await c.query(`SELECT count(*)::int AS n FROM brands WHERE contact_person IS NOT NULL`);
    console.log(`\n  creators with city_id set: ${await one(c, 'SELECT count(*)::int AS n FROM influencers WHERE city_id IS NOT NULL')} / ${before.influencers}`);
    console.log(`  creators still unmatched: ${JSON.stringify(unmatchedCreators)}`);
    console.log(`  branches without a city: ${JSON.stringify(unmatchedBranches)}`);
    console.log(`  brands with contact_person backfilled: ${contact[0].n}`);

    if (!ok) { await c.query('ROLLBACK'); console.error('\nROLLED BACK — a check failed. Nothing was committed.'); process.exit(1); }
    if (DRY) { await c.query('ROLLBACK'); console.log('\nROLLED BACK — dry run complete, nothing was changed.'); }
    else { await c.query('COMMIT'); console.log('\nCOMMITTED.'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('\nERROR —', e.message);
    process.exit(1);
  } finally { await c.end(); }
})();
