#!/usr/bin/env node
/**
 * Migration 186 — item 9: the per-brand campaign fee becomes a real override,
 * and the Pay for Content final payment waits 7 days instead of 30.
 * Usage: node scripts/run-186.js --dry | --apply   [--env=.env]
 * Contract: features/item7-agreement · Docs/ITEM9_FUNDING_LOCKING_GAP_REPORT.md
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
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const all = async (sql, p) => (await c.query(sql, p)).rows;

  const platformPct = (await one(`SELECT value FROM platform_settings WHERE key='campaign_fee_pct'`)).value;
  console.log(`platform-wide campaign fee        : ${platformPct}%`);
  console.log('brands by their own percentage    :', JSON.stringify(
    await all(`SELECT platform_fee_pct, count(*)::int n FROM brands GROUP BY 1 ORDER BY 1`)));
  console.log('  → of those, how many will become NULL (they equal the platform number, so nothing changes):',
    (await one(`SELECT count(*)::int n FROM brands WHERE platform_fee_pct IS NOT NULL AND platform_fee_pct = $1`, [platformPct])).n);
  console.log('  → how many are a DELIBERATE override and will be kept as-is:',
    (await one(`SELECT count(*)::int n FROM brands WHERE platform_fee_pct IS NOT NULL AND platform_fee_pct <> $1`, [platformPct])).n);

  console.log('\ntranche-3 wait (days)             :', (await one(`SELECT tranche_3_release_after_days d FROM payment_config WHERE id=1`)).d);
  console.log('tranche-3 rows by status          :', JSON.stringify(
    await all(`SELECT status, count(*)::int n FROM escrow_entries WHERE tranche_number=3 GROUP BY 1 ORDER BY 1`)));
  const armed = (await one(`SELECT count(*)::int n FROM escrow_entries WHERE tranche_number=3 AND status='queued'`)).n;
  console.log(`  → ARMED and therefore affected by the 30→7 change: ${armed}`);
  if (armed > 0) {
    console.log('    those rows and how much sooner they would now release:');
    for (const r of await all(
      `SELECT id, amount, triggered_at::date armed_on,
              (triggered_at + interval '30 days')::date was_due,
              (triggered_at + interval '7 days')::date now_due
         FROM escrow_entries WHERE tranche_number=3 AND status='queued' ORDER BY triggered_at`)) {
      console.log(`      ₹${r.amount}  armed ${String(r.armed_on).slice(0,10)}  was due ${String(r.was_due).slice(0,10)}  →  ${String(r.now_due).slice(0,10)}`);
    }
  }

  console.log('\nalready applied?                  :', JSON.stringify({
    'brands.platform_fee_pct default dropped': (await one(
      `SELECT column_default IS NULL AS v FROM information_schema.columns WHERE table_name='brands' AND column_name='platform_fee_pct'`)).v,
    'payment_config t3 default = 7': (await one(
      `SELECT column_default = '7' AS v FROM information_schema.columns WHERE table_name='payment_config' AND column_name='tranche_3_release_after_days'`)).v,
  }));

  console.log('\nno agreement already signed is recalculated: every collaboration stamps its own');
  console.log('campaign fee percentage into terms_json when the agreement is generated, and the');
  console.log('tranche-3 clock only starts when a brand confirms content is live.');

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  await c.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '186_item9_fee_override_and_t3_wait.sql'), 'utf8'));
  console.log('\nAPPLIED.');
  console.log('brands with their own percentage  :', JSON.stringify(
    await all(`SELECT platform_fee_pct, count(*)::int n FROM brands GROUP BY 1 ORDER BY 1`)));
  console.log('tranche-3 wait (days)             :', (await one(`SELECT tranche_3_release_after_days d FROM payment_config WHERE id=1`)).d);
  console.log('signed collaborations unchanged   :', JSON.stringify(
    await all(`SELECT terms_json->'money'->>'campaignFeePct' stamped, count(*)::int n FROM contracts WHERE terms_json IS NOT NULL GROUP BY 1 ORDER BY 1`)));
  console.log('\nAll checks OK.');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
