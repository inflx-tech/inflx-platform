'use strict';

/**
 * Compare a list of expected ig_handles against what's actually in
 * creator_profiles. Reports: matches, missing-from-DB, extras-in-DB.
 *
 * Usage: edit the EXPECTED array below and run.
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const EXPECTED = [
  'crazyzizterz_official',
  'explorinn.in',
  'minnie_inti_ruchulu',
  'foodie_._gurl',
  'bhanu__lathika',
  'ooru_suthalaama',
  'venkatt_blaze',
  'kavya_settyy',
  'hanaamalik',
  'sadha_siya',
];

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(`
    SELECT ig_handle, full_name, followers_count, follower_tier,
           rank_score, is_active_creator, activity_status,
           last_calculated_at
      FROM creator_profiles
      ORDER BY followers_count DESC NULLS LAST
  `);

  const inDb = new Map(rows.map(r => [r.ig_handle, r]));

  console.log(`\n=== DB has ${rows.length} creator_profiles total ===\n`);

  console.log('Status of each EXPECTED handle:');
  let matched = 0;
  for (const handle of EXPECTED) {
    const r = inDb.get(handle);
    if (r) {
      matched++;
      const stale = r.last_calculated_at && (Date.now() - r.last_calculated_at.getTime() > 48 * 3600 * 1000);
      const flag = r.is_active_creator ? '✅' : '⚠️ inactive';
      const staleFlag = stale ? ' [STALE >48h]' : '';
      console.log(`  ${flag}  @${handle.padEnd(28)} followers=${String(r.followers_count).padStart(8)}  tier=${r.follower_tier || '?'}  rank=${r.rank_score}  last=${r.last_calculated_at?.toISOString().slice(0,16)}${staleFlag}`);
    } else {
      console.log(`  ❌  @${handle.padEnd(28)} NOT IN DB`);
    }
  }
  console.log(`\nMatched: ${matched} / ${EXPECTED.length}`);

  // Extras in DB
  const expectedSet = new Set(EXPECTED);
  const extras = rows.filter(r => !expectedSet.has(r.ig_handle));
  if (extras.length > 0) {
    console.log(`\n${extras.length} additional handle(s) in DB not on the expected list:`);
    for (const r of extras) {
      const stale = r.last_calculated_at && (Date.now() - r.last_calculated_at.getTime() > 48 * 3600 * 1000);
      const staleFlag = stale ? ' [STALE >48h]' : '';
      console.log(`  •  @${r.ig_handle.padEnd(28)} followers=${String(r.followers_count).padStart(8)}  tier=${r.follower_tier || '?'}  last=${r.last_calculated_at?.toISOString().slice(0,16)}${staleFlag}`);
    }
  }

  // Posts coverage
  const { rows: postRows } = await client.query(`
    SELECT cp.ig_handle, COUNT(p.*)::int AS post_count
      FROM creator_profiles cp
      LEFT JOIN posts p ON p.creator_profile_id = cp.id
      GROUP BY cp.ig_handle
      ORDER BY post_count DESC, cp.ig_handle
  `);
  console.log('\nPosts pushed per creator:');
  for (const r of postRows) {
    const flag = r.post_count > 0 ? '📊' : '— ';
    console.log(`  ${flag} @${r.ig_handle.padEnd(28)} ${r.post_count} posts`);
  }

  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
