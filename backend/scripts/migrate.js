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

  // Ordered list of all migration files. Each is run sequentially.
  // 003a was merged into 003 — do not add it back.
  const migrationFiles = [
    '001_initial_schema.sql',
    '002_add_missing_columns.sql',
    '003_seed_influencers.sql',
    '004_enrich_influencers.sql',
    '005_master_catalogue.sql',
    '006_contracts_and_payment_config.sql',
    '007_link_clicks.sql',
    '008_fix_withdrawal.sql',
  ];

  try {
    for (const file of migrationFiles) {
      const sqlPath = path.join(__dirname, '../migrations/', file);
      if (!fs.existsSync(sqlPath)) {
        console.log(`⚠ Skipping ${file} — file not found`);
        continue;
      }
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log(`✓ ${file}`);
    }
    console.log('\n✓ All migrations complete\n');
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
