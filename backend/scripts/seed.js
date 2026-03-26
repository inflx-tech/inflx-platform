'use strict';

/**
 * Seed script — creates the first superadmin user.
 *
 * Run this ONCE after migration:
 *   node scripts/seed.js
 *
 * The superadmin can then:
 *   1. Log in via POST /v1/auth/send-otp + verify-otp (OTP = 000000 in dev)
 *   2. Use the returned JWT to access all admin endpoints
 *   3. Create additional reviewer / finance admin accounts via POST /v1/admin/users
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPERADMIN_PHONE = '+919000000001';
const SUPERADMIN_NAME  = 'INFLX Super Admin';

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Check if superadmin already exists
    const { rows } = await client.query(
      `SELECT u.id FROM users u WHERE u.phone = $1 AND u.role = 'admin'`,
      [SUPERADMIN_PHONE]
    );

    if (rows.length > 0) {
      console.log(`ℹ Superadmin already exists (phone: ${SUPERADMIN_PHONE}). Skipping seed.\n`);
      return;
    }

    // Create user
    const { rows: userRows } = await client.query(
      `INSERT INTO users (phone, role, name, status)
       VALUES ($1, 'admin', $2, 'approved')
       RETURNING id`,
      [SUPERADMIN_PHONE, SUPERADMIN_NAME]
    );
    const userId = userRows[0].id;

    // Create admin profile
    await client.query(
      `INSERT INTO admin_profiles (user_id, admin_role) VALUES ($1, 'superadmin')`,
      [userId]
    );

    console.log('\n✓ Superadmin created successfully!');
    console.log('─────────────────────────────────────');
    console.log(`  Phone:     ${SUPERADMIN_PHONE}`);
    console.log(`  Name:      ${SUPERADMIN_NAME}`);
    console.log(`  Admin role: superadmin`);
    console.log('');
    console.log('To log in:');
    console.log(`  POST /v1/auth/send-otp   → { "phone": "${SUPERADMIN_PHONE}" }`);
    console.log(`  POST /v1/auth/verify-otp → { "phone": "${SUPERADMIN_PHONE}", "otp": "000000" }`);
    console.log('');
    console.log('Use the returned access_token as: Authorization: Bearer <token>\n');
  } finally {
    await client.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
