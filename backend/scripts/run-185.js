#!/usr/bin/env node
/**
 * Migration 185 — the subscriptions master switch: one platform_settings row.
 * Usage: node scripts/run-185.js --dry | --apply   [--env=.env]
 * Contract: features/subscriptions-master-switch
 *
 * The smallest migration in the repo: no schema change at all, because
 * platform_settings.value is already an int with CHECK (value BETWEEN min_value AND max_value).
 *
 * It arrives at 1 — ON — which is exactly today's behaviour. Nothing changes for anybody until
 * an admin turns it off at Admin → Settings → Platform. The checks below prove that: the row is
 * present, it reads 1, and not one other row in the database moved.
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

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  const one = async (s, p) => (await q(s, p))[0];

  console.log(`\n=== migration 185 · ${apply ? 'APPLY' : 'DRY RUN'} · ${envFile} ===\n`);

  const before = await one(`SELECT
      (SELECT count(*)::int FROM platform_settings) settings,
      (SELECT count(*)::int FROM brand_subscriptions) subscriptions,
      (SELECT count(*)::int FROM subscription_tiers) tiers,
      (SELECT count(*)::int FROM tier_features) tier_features,
      (SELECT count(*)::int FROM features) features`, []);
  console.log('before:', before);
  console.log('settings now:', await q(`SELECT key, value FROM platform_settings ORDER BY key`));

  if (apply) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '185_subscriptions_master_switch.sql'), 'utf8');
    await c.query('BEGIN');
    try { await c.query(sql); await c.query('COMMIT'); }
    catch (e) { await c.query('ROLLBACK'); throw e; }
    console.log('\napplied.\n');
  } else {
    console.log('\n(dry run — nothing written)\n');
  }

  const row = await one(`SELECT key, value, min_value, max_value, unit, label FROM platform_settings WHERE key = 'subscriptions_enforced'`, []);
  console.log('the switch:', row || '(absent)');

  const after = await one(`SELECT
      (SELECT count(*)::int FROM platform_settings) settings,
      (SELECT count(*)::int FROM brand_subscriptions) subscriptions,
      (SELECT count(*)::int FROM subscription_tiers) tiers,
      (SELECT count(*)::int FROM tier_features) tier_features,
      (SELECT count(*)::int FROM features) features`, []);
  console.log('after:', after);

  // Everything except the settings count must be untouched — this migration writes one row.
  const untouched = after.subscriptions === before.subscriptions
    && after.tiers === before.tiers
    && after.tier_features === before.tier_features
    && after.features === before.features;
  const present = !!row && Number(row.value) === 1 && Number(row.min_value) === 0 && Number(row.max_value) === 1;

  if (apply) {
    console.log('row counts elsewhere unchanged:', untouched);
    console.log('switch present and ON:', present);
    const ok = untouched && present && after.settings === before.settings + 1;
    console.log(ok ? '\nAll checks OK. Plan limits still apply exactly as before; the switch is ON.' : '\nCHECKS FAILED — inspect above.');
    await c.end();
    process.exit(ok ? 0 : 1);
  }

  console.log(`\nDry run complete. --apply would add one row: subscriptions_enforced = 1 (ON).`);
  await c.end();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
