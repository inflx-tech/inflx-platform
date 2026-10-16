'use strict';
/**
 * Register the Play Store review demo number on the test allowlist.
 *
 * WHY
 * Google Play review needs a login it can use without receiving an SMS. The only route to a
 * fixed code is membership in test_phone_numbers (migration 154): a listed number gets
 * 000000 and no SMS, every other number always gets a real one. This adds ONE number.
 * The follower account itself is then made the ordinary way, by signing in through
 * POST /v1/auth/send-otp and /v1/auth/verify-otp with role "follower".
 *
 * The number sits in the SIM-less +9179000002xx block, deliberately OUTSIDE the practice
 * world's +9179000001xx prefix, so `remove-practice-world.js --by-prefix` never sweeps it.
 *
 * SAFETY
 *  - The allowlist is per NUMBER, not per role. A listed number hands the fixed code to
 *    every account on it, so this refuses a number that holds an admin account.
 *  - It also refuses a number that already holds any account, unless --allow-existing is
 *    passed: a listed number with a real person's account on it is an open door.
 *
 * Usage (production is the default target, read from .env.prod-backup):
 *   node scripts/add-play-review-account.js                 # add +917900000200
 *   node scripts/add-play-review-account.js --phone=+91…    # a different number
 *   node scripts/add-play-review-account.js --remove        # take the number off again
 */
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const PHONE = args.phone || '+917900000200';
const NOTE = 'Play Store review demo account (follower) - keep while the app is on Play';

(async () => {
  if (!/^\+91[6-9]\d{9}$/.test(PHONE)) throw new Error(`${PHONE} is not a valid +91 mobile number`);
  const url = process.env.DATABASE_URL || '';
  console.log('Target:', url.replace(/\/\/[^@]+@/, '//<redacted>@'));
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    if (args.remove) {
      const r = await c.query(`DELETE FROM test_phone_numbers WHERE phone = $1`, [PHONE]);
      console.log(r.rowCount ? `${PHONE} removed from the allowlist - it now gets real SMS codes.` : `${PHONE} was not on the allowlist.`);
      return;
    }
    const { rows: accounts } = await c.query(`SELECT role FROM users WHERE phone = $1`, [PHONE]);
    if (accounts.some(a => a.role === 'admin')) {
      throw new Error(`${PHONE} holds an admin account - refusing to allow-list it`);
    }
    if (accounts.length && !args['allow-existing']) {
      throw new Error(`${PHONE} already holds ${accounts.length} account(s) (${accounts.map(a => a.role).join(', ')}) - pass --allow-existing only if they are all demo accounts`);
    }
    await c.query(
      `INSERT INTO test_phone_numbers (phone, note) VALUES ($1, $2)
         ON CONFLICT (phone) DO UPDATE SET note = EXCLUDED.note`, [PHONE, NOTE]);
    const { rows } = await c.query(`SELECT phone, note, created_at FROM test_phone_numbers WHERE phone = $1`, [PHONE]);
    console.log('Allow-listed:', rows[0].phone, '|', rows[0].note);
  } finally {
    await c.end();
  }
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
