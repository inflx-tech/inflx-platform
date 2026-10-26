#!/usr/bin/env node
/**
 * Migration 211 — product-approval-switch: the product_approval_required setting (OFF) and the
 * four approval columns on brand_products (approval_status default 'approved').
 * Usage: node scripts/run-211.js --dry | --apply   [--env=.env]
 * Contract: features/product-approval-switch · 05-impact.md
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). No existing row is rewritten: every
 * product reads approval_status = 'approved' by default, and the setting arrives at 0, so nothing
 * changes for anybody until an admin turns the switch on. brand_products is counted before and
 * after, and the number that are pushed_to_store must be identical.
 */
const fs = require('fs');
const path = require('path');
const envArg = process.argv.find((a) => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
if (!apply && !dry) { console.error('Pass --dry or --apply.'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const hasColumn = async (col) => !!(await one(
    `SELECT 1 AS x FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'brand_products' AND column_name = $1`, [col]));

  const shape = async () => ({
    'setting row': (await one(`SELECT value FROM platform_settings WHERE key = 'product_approval_required'`) || {}).value ?? null,
    approval_status: await hasColumn('approval_status'),
    approval_requested_at: await hasColumn('approval_requested_at'),
    approval_decided_at: await hasColumn('approval_decided_at'),
    approval_decided_by: await hasColumn('approval_decided_by'),
    approval_note: await hasColumn('approval_note'),
  });
  const counts = async () => ({
    brand_products: Number((await one(`SELECT count(*)::int AS n FROM brand_products`)).n),
    pushed_to_store: Number((await one(`SELECT count(*)::int AS n FROM brand_products WHERE pushed_to_store`)).n),
    is_active: Number((await one(`SELECT count(*)::int AS n FROM brand_products WHERE is_active`)).n),
    platform_settings: Number((await one(`SELECT count(*)::int AS n FROM platform_settings`)).n),
  });

  const before = { shape: await shape(), counts: await counts() };
  console.log('Before:', JSON.stringify(before, null, 2));
  if (dry) { await c.end(); console.log('Dry run: nothing written.'); return; }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '211_product_approval_switch.sql'), 'utf8');
  await c.query(sql);
  const after = { shape: await shape(), counts: await counts() };
  const notApproved = Number((await one(`SELECT count(*)::int AS n FROM brand_products WHERE approval_status <> 'approved'`)).n);
  console.log('After:', JSON.stringify(after, null, 2), '\nproducts not approved:', notApproved);
  const sameProducts = before.counts.brand_products === after.counts.brand_products
    && before.counts.pushed_to_store === after.counts.pushed_to_store && before.counts.is_active === after.counts.is_active;
  const settingsGrew = after.counts.platform_settings === before.counts.platform_settings + (before.shape['setting row'] == null ? 1 : 0);
  const allOn = ['approval_status', 'approval_requested_at', 'approval_decided_at', 'approval_decided_by', 'approval_note'].every((k) => after.shape[k])
    && after.shape['setting row'] === 0 && notApproved === 0;
  console.log(sameProducts ? 'Product counts identical before and after.' : 'PRODUCT COUNTS CHANGED — look.');
  console.log(settingsGrew ? 'Settings: exactly the one row added (or already there).' : 'SETTINGS COUNT UNEXPECTED — look.');
  console.log(allOn ? 'Every shape check is on; the switch is OFF; every product is approved.' : 'A SHAPE CHECK IS OFF — look.');
  await c.end();
  process.exit(sameProducts && settingsGrew && allOn ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
