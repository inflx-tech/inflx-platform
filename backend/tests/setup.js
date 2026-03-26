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

  // Apply the full migration
  const sqlPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await client.query(sql);

  await client.end();

  console.log('\n✓ Test database migrated (inflx_test)\n');
};
