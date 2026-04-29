'use strict';

/**
 * Wipe ingest-only data (creator_profiles + posts) for end-to-end pipeline
 * test resets. Other public tables are untouched. Schema is untouched.
 *
 * Wrapped in BEGIN/COMMIT so either both tables are emptied or neither.
 *
 * Usage:
 *   node scripts/truncate-ingest-data.js
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Snapshot before
  const before = await client.query(`
    SELECT (SELECT COUNT(*) FROM creator_profiles)::int AS profiles,
           (SELECT COUNT(*) FROM posts)::int            AS posts
  `);
  console.log('Before:', before.rows[0]);

  await client.query('BEGIN');
  try {
    await client.query('TRUNCATE TABLE creator_profiles, posts RESTART IDENTITY CASCADE');
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }

  const after = await client.query(`
    SELECT (SELECT COUNT(*) FROM creator_profiles)::int AS profiles,
           (SELECT COUNT(*) FROM posts)::int            AS posts
  `);
  console.log('After: ', after.rows[0]);

  await client.end();
  console.log('\n✓ Truncate complete\n');
})().catch((e) => { console.error('\n✗ Failed:', e.message); process.exit(1); });
