'use strict';

/**
 * Apply migrations 165 + 166 (Stage A — the set carries its own shape).
 * Contract: features/stage-a-the-set
 *
 * Both are purely additive: nullable columns, no defaults, IF NOT EXISTS, plus two
 * CHECKs on 165 that explicitly permit NULL. There is no backfill and no UPDATE —
 * see 165's header for why deriving a go-live day from window_end would have been
 * inventing dates for nine live sets.
 *
 * Pass --dry to run both inside a transaction that is ROLLED BACK. The dry run
 * proves the thing that matters: every existing row is still there, and still
 * valid, after the constraints exist.
 *
 *   node scripts/run-165-166.js --dry     inspect against production, roll back
 *   node scripts/run-165-166.js --apply   commit against production
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// TARGET IS EXPLICIT, NEVER IMPLIED BY --dry.
//
// run-164.js and its siblings read .env.prod-backup for --dry and .env for the real
// run. In this working copy .env points at LOCALHOST, so the dry run inspects
// production and the real run would apply to a local database — and print
// "COMMITTED". Nothing about which database is being written to should be a side
// effect of a different flag.
//
//   --dry     production, rolled back
//   --apply   production, committed
//   neither   refuses
const DRY   = process.argv.includes('--dry');
const APPLY = process.argv.includes('--apply');

if (DRY === APPLY) {
  console.error('Pass exactly one of --dry (inspect, roll back) or --apply (commit).');
  process.exit(2);
}

require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const url = process.env.DATABASE_URL || '';
const HOST = (url.match(/@([^:/?]+)/) || [])[1] || '(unknown)';

if (!url) {
  console.error('No DATABASE_URL in backend/.env.prod-backup.');
  process.exit(2);
}
if (APPLY && /^(localhost|127\.0\.0\.1)$/.test(HOST)) {
  console.error(`Refusing --apply against ${HOST}. This script applies to production only.`);
  process.exit(2);
}

const FILES = [
  '165_set_carries_its_own_shape.sql',
  '166_terms_move_down_to_the_creator.sql',
];

const one = async (c, sql) => (await c.query(sql)).rows[0].n;

const snapshot = async (c) => ({
  sets:        await one(c, 'SELECT count(*)::int AS n FROM campaign_sets'),
  cis:         await one(c, 'SELECT count(*)::int AS n FROM campaign_influencers'),
  campaigns:   await one(c, 'SELECT count(*)::int AS n FROM campaigns'),
  contracts:   await one(c, 'SELECT count(*)::int AS n FROM contracts'),
  // the fallbacks the new nullable columns depend on — must be untouched
  withWinStart: await one(c, 'SELECT count(*)::int AS n FROM campaign_sets WHERE window_start IS NOT NULL'),
  withWinEnd:   await one(c, 'SELECT count(*)::int AS n FROM campaign_sets WHERE window_end IS NOT NULL'),
  withGoal:     await one(c, 'SELECT count(*)::int AS n FROM campaign_sets WHERE goal IS NOT NULL'),
});

const afterOnly = async (c) => ({
  // every live row must survive the CHECKs — all of them are NULL here
  badMode: await one(c, `SELECT count(*)::int AS n FROM campaign_sets
                          WHERE shoot_mode IS NOT NULL
                            AND shoot_mode NOT IN ('visit','shipment','remote')`),
  goLiveSet: await one(c, 'SELECT count(*)::int AS n FROM campaign_sets WHERE go_live_date IS NOT NULL'),
  chanSet:   await one(c, 'SELECT count(*)::int AS n FROM campaign_influencers WHERE channels_json IS NOT NULL'),
  fmtSet:    await one(c, 'SELECT count(*)::int AS n FROM campaign_influencers WHERE formats_json IS NOT NULL'),
});

const row = (label, got, want) => {
  const ok = String(got) === String(want);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(34)} ${String(got).padStart(4)}   (must be ${want})`);
  return ok;
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log(DRY
    ? `=== DRY RUN against ${HOST} — will be rolled back\n`
    : `=== APPLYING FOR REAL against ${HOST}\n`);

  const before = await snapshot(c);
  console.log('BEFORE');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(14)} ${v}`);
  console.log();

  const bodies = FILES.map((f) => {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
    // each file has its own BEGIN/COMMIT; strip them so we control the transaction
    return sql.replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, '');
  });

  await c.query('BEGIN');
  for (let i = 0; i < FILES.length; i++) {
    await c.query(bodies[i]);
    console.log(`applied  ${FILES[i]}`);
  }

  const after = await snapshot(c);
  const extra = await afterOnly(c);
  console.log('\nAFTER' + (DRY ? ' (inside the rolled-back transaction)' : ''));

  let allOk = true;
  allOk &= row('campaign_sets rows',        after.sets,         before.sets);
  allOk &= row('campaign_influencers rows', after.cis,          before.cis);
  allOk &= row('campaigns rows',            after.campaigns,    before.campaigns);
  allOk &= row('contracts rows',            after.contracts,    before.contracts);
  allOk &= row('sets with window_start',    after.withWinStart, before.withWinStart);
  allOk &= row('sets with window_end',      after.withWinEnd,   before.withWinEnd);
  allOk &= row('sets with goal',            after.withGoal,     before.withGoal);
  console.log();
  allOk &= row('sets with an unknown mode', extra.badMode,   0);
  allOk &= row('sets given a go-live day',  extra.goLiveSet, 0);
  allOk &= row('creators given channels',   extra.chanSet,   0);
  allOk &= row('creators given formats',    extra.fmtSet,    0);

  if (!allOk) {
    await c.query('ROLLBACK');
    console.error('\nROLLED BACK — a check failed. Nothing was changed.');
    await c.end();
    process.exit(1);
  }

  if (DRY) {
    await c.query('ROLLBACK');
    console.log('\nROLLED BACK — nothing was changed. Re-run with --apply to commit.');
  } else {
    await c.query('COMMIT');
    console.log('\nCOMMITTED.');
  }
  await c.end();
})().catch(async (e) => {
  console.error('\nERROR —', e.message);
  process.exit(1);
});
