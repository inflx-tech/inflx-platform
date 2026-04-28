'use strict';

/**
 * One-shot inspection + cleanup of marketing-automation smoke-test rows.
 *
 * 1. SELECT what's currently in creator_profiles + posts.
 * 2. DELETE only the row(s) named via argv (default: fake_brand_smoke_test).
 * 3. Re-print the row count.
 *
 * Usage:
 *   node scripts/inspect-cleanup-smoke.js              # dry-run (SELECT only)
 *   node scripts/inspect-cleanup-smoke.js --delete     # actually deletes
 *   node scripts/inspect-cleanup-smoke.js --delete fake_brand_smoke_test
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const HANDLES_TO_DELETE = process.argv
  .filter((a) => !a.startsWith('--') && !a.endsWith('.js') && a !== 'node')
  .filter((a) => !/^[A-Z]:\\/.test(a)); // strip Windows path argv on cmd
const DELETE_LIST = HANDLES_TO_DELETE.length > 0
  ? HANDLES_TO_DELETE
  : ['fake_brand_smoke_test'];
const DO_DELETE = process.argv.includes('--delete');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('\n--- creator_profiles (all rows) ---');
  const { rows } = await client.query(
    `SELECT ig_handle, full_name, followers_count, is_onboarded,
            is_active_creator, last_calculated_at
       FROM creator_profiles
       ORDER BY last_calculated_at DESC NULLS LAST`
  );
  if (rows.length === 0) {
    console.log('  (empty)');
  } else {
    for (const r of rows) {
      console.log(`  @${r.ig_handle.padEnd(28)} | followers=${String(r.followers_count).padStart(8)} | onboarded=${r.is_onboarded} | active=${r.is_active_creator} | last=${r.last_calculated_at}`);
    }
  }

  console.log('\n--- posts (count by creator) ---');
  const { rows: postCounts } = await client.query(
    `SELECT cp.ig_handle, COUNT(p.*)::int AS post_count
       FROM creator_profiles cp
       LEFT JOIN posts p ON p.creator_profile_id = cp.id
       GROUP BY cp.ig_handle
       ORDER BY cp.ig_handle`
  );
  for (const r of postCounts) {
    console.log(`  @${r.ig_handle.padEnd(28)} | posts=${r.post_count}`);
  }

  if (!DO_DELETE) {
    console.log('\n[dry-run] Pass --delete to actually remove smoke rows.\n');
    await client.end();
    return;
  }

  console.log(`\n--- Deleting handles: ${DELETE_LIST.join(', ')} ---`);
  // Posts are removed via ON DELETE CASCADE on creator_profile_id, but we
  // also do an explicit posts cleanup in case any orphaned rows existed.
  for (const handle of DELETE_LIST) {
    const { rowCount: postsDeleted } = await client.query(
      `DELETE FROM posts
        WHERE creator_profile_id IN (SELECT id FROM creator_profiles WHERE ig_handle = $1)`,
      [handle]
    );
    const { rowCount: profilesDeleted } = await client.query(
      `DELETE FROM creator_profiles WHERE ig_handle = $1`,
      [handle]
    );
    console.log(`  @${handle}: ${postsDeleted} posts + ${profilesDeleted} profile row(s) removed`);
  }

  console.log('\n--- After cleanup ---');
  const { rows: after } = await client.query(
    `SELECT COUNT(*)::int AS c FROM creator_profiles`
  );
  console.log(`  creator_profiles total: ${after[0].c}`);

  await client.end();
  console.log('\n✓ Done\n');
})().catch((err) => {
  console.error('\n✗ Failed:', err.message);
  process.exit(1);
});
