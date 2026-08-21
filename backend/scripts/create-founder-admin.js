'use strict';
/**
 * Stage 0, job E1 — the founder's superadmin account.
 * Contract: features/stage-0-clear-the-decks
 *
 * Created directly because the admin dashboard has no sign-up: admins are made by
 * other admins, and the wipe removed all three that existed. This is the seed that
 * lets the founder back in; every other admin he creates himself from the dashboard.
 *
 * Idempotent — safe to run twice.
 */
const { Client } = require('pg'); const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const PHONE = '+918639448121';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN');
  try {
    const { rows } = await c.query(
      `INSERT INTO users (phone, role, name, status)
       VALUES ($1, 'admin', 'Aveen', 'approved')
       ON CONFLICT (phone, role) DO UPDATE SET status = 'approved'
       RETURNING id, phone, role, name, status`, [PHONE]);
    const user = rows[0];

    await c.query(
      `INSERT INTO admin_profiles (user_id, admin_role)
       VALUES ($1, 'superadmin')
       ON CONFLICT (user_id) DO UPDATE SET admin_role = 'superadmin'`, [user.id]);

    await c.query('COMMIT');
    console.log('superadmin ready:', JSON.stringify(user));
    console.log('sign in at the admin dashboard with a real code sent to', PHONE);
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
