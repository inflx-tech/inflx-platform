'use strict';

/**
 * Migration runner.
 * Runs migrations/001_initial_schema.sql against the database in DATABASE_URL.
 *
 * Usage:
 *   node scripts/migrate.js
 *   node scripts/migrate.js --test    (uses TEST_DATABASE_URL)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrate() {
  const useTestDb = process.argv.includes('--test');
  const connectionString = useTestDb
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in .env');
    process.exit(1);
  }

  console.log(`\nRunning migration on: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const sqlPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);
    console.log('✓ Migration complete — all tables created\n');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('ℹ Migration already applied — schema already exists\n');
    } else {
      console.error('Migration failed:', err.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

migrate();
