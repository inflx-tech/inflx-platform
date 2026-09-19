#!/usr/bin/env node
/**
 * Migration 189 — change-login-number: the phone_changes audit table.
 * Usage: node scripts/run-189.js --dry | --apply   [--env=.env]
 * Contract: features/change-login-number
 */
const fs = require('fs');
const path = require('path');
const envArg = process.argv.find(a => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
if (!apply && !dry) { console.error('Pass --dry or --apply.'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }
if (apply && /localhost|127\.0\.0\.1/.test(url)) { console.error('--apply refuses a localhost DATABASE_URL.'); process.exit(2); }
console.log('Target:', url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:****@'));

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const exists = !!(await one(`SELECT 1 AS v FROM information_schema.tables WHERE table_name = 'phone_changes'`));
  console.log('users:', (await one(`SELECT count(*)::int n FROM users`)).n, ' phone_changes exists:', exists);
  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }
  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '189_change_login_number.sql'), 'utf8'));
  console.log('\nAPPLIED.');
  console.log('phone_changes exists:', !!(await one(`SELECT 1 AS v FROM information_schema.tables WHERE table_name = 'phone_changes'`)), 'rows:', (await one(`SELECT count(*)::int n FROM phone_changes`)).n);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
