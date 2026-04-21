'use strict';

/**
 * One-shot runner for migration 021 (paise → rupees normalization).
 *
 * Reads DATABASE_URL from backend/.env and applies
 * migrations/021_paise_to_rupees.sql inside a single transaction. Prints
 * a before/after balance snapshot for quick sanity.
 *
 * Usage:   node scripts/run-021.js
 *
 * Delete this file after it has been run on production.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function snapshot(client, label) {
  const b = await client.query(`SELECT id, business_name, wallet_balance FROM brands ORDER BY created_at LIMIT 5`);
  const i = await client.query(`SELECT id, wallet_balance, pending_balance, total_earned FROM influencers ORDER BY created_at LIMIT 5`);
  console.log(`\n=== ${label} ===`);
  console.log('Brands (first 5):');
  b.rows.forEach(r => console.log(`  ${r.business_name || '(unnamed)'}: wallet=${r.wallet_balance}`));
  console.log('Influencers (first 5):');
  i.rows.forEach(r => console.log(`  ${r.id.slice(0, 8)}: wallet=${r.wallet_balance} pending=${r.pending_balance} earned=${r.total_earned}`));
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in backend/.env');
    process.exit(1);
  }

  console.log(`\nConnecting to: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  const requireSSL = connectionString.includes('supabase.com');
  const client = new Client({
    connectionString,
    ...(requireSSL && { ssl: { rejectUnauthorized: false } }),
  });
  await client.connect();

  try {
    await snapshot(client, 'BEFORE migration 021');

    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/021_paise_to_rupees.sql'),
      'utf8'
    );
    console.log('\nApplying migration 021...');
    await client.query(sql);
    console.log('[OK] Migration applied.');

    await snapshot(client, 'AFTER migration 021');

    console.log('\nAll done. You can delete scripts/run-021.js now.');
  } catch (err) {
    console.error('\n[FAIL]', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
