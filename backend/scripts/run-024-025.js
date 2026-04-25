'use strict';

/**
 * One-shot runner for migrations 024 + 025 on production Supabase.
 *
 * Both migrations are wrapped in BEGIN/COMMIT and use IF NOT EXISTS,
 * so this is safe to run multiple times.
 *
 * Usage: node scripts/run-024-025.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const masked = connectionString.replace(/:[^:@]+@/, ':***@');
  console.log(`\nTarget: ${masked}\n`);

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  const files = ['024_creator_profiles.sql', '025_posts.sql'];
  for (const file of files) {
    const sqlPath = path.join(__dirname, '../migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    process.stdout.write(`Running ${file} ... `);
    await client.query(sql);
    console.log('OK');
  }

  // Sanity check
  const { rows } = await client.query(`
    SELECT
      to_regclass('public.creator_profiles') AS creator_profiles,
      to_regclass('public.posts')            AS posts
  `);
  console.log('\nTables present:');
  console.log('  creator_profiles ->', rows[0].creator_profiles);
  console.log('  posts            ->', rows[0].posts);

  const { rows: cnt } = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM creator_profiles) AS creator_profiles_rows,
      (SELECT COUNT(*) FROM posts)            AS posts_rows
  `);
  console.log('\nRow counts:');
  console.log('  creator_profiles ->', cnt[0].creator_profiles_rows);
  console.log('  posts            ->', cnt[0].posts_rows);

  await client.end();
  console.log('\n✓ Done\n');
})().catch((err) => {
  console.error('\n✗ Migration failed:', err.message);
  process.exit(1);
});
