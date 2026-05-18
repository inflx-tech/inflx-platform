'use strict';

/**
 * Jest globalSetup — runs once before all test suites.
 * Connects to TEST_DATABASE_URL, drops and recreates the schema,
 * then runs the full migration SQL so tests start with a clean DB.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'TEST_DATABASE_URL is not set in .env — cannot run tests.\n' +
      'Add: TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/inflx_test'
    );
  }

  const client = new Client({ connectionString });
  await client.connect();

  // Wipe and recreate the public schema for a clean slate on each test run
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO public');

  // Apply ALL migrations in sorted order (001 → 054). Filenames are
  // zero-padded 3-digit prefixes, so lexicographic sort == numeric
  // order. Previously this applied ONLY 001 — the long-standing
  // staleness B2b fixes. Any SQL error stops the run, names the
  // file, and fails globalSetup loudly (no partial/silent schema).
  const migDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  let applied = 0;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
    try {
      await client.query(sql);
      applied += 1;
    } catch (e) {
      console.error(`[setup] MIGRATION FAILED at ${f}: ${e.message}`);
      await client.end();
      throw new Error(`Migration failed at ${f}: ${e.message}`);
    }
  }

  await client.end();

  console.log(`\n[setup] migrations applied: ${applied}/${files.length}`);
  console.log('✓ Test database migrated (inflx_test)\n');
};
