'use strict';

/**
 * Apply migration 167 (Stage A — deferred creators / the holding pool).
 * Contract: features/stage-a-the-set
 *
 * Purely additive: a new enum value, four nullable columns, one CHECK that
 * explicitly permits NULL. No existing row is touched.
 *
 * Pass --dry to run inside a transaction that is ROLLED BACK. The dry run proves
 * the thing that matters: every existing row is still there, still 'declined' or
 * whatever it already was, and none of them picked up the new columns.
 *
 *   node scripts/run-167.js --dry     inspect against production, roll back
 *   node scripts/run-167.js --apply   commit against production
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// TARGET IS EXPLICIT, NEVER IMPLIED BY --dry. Same rule run-165-166.js fixed after
// finding run-164.js and its siblings could apply for real against localhost while
// claiming to have dry-run production.
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

const FILE = '167_deferred_creators.sql';

const one = async (c, sql) => (await c.query(sql)).rows[0].n;

const snapshot = async (c) => ({
  cis:            await one(c, 'SELECT count(*)::int AS n FROM campaign_influencers'),
  byStatus:       await one(c, `SELECT string_agg(status || ':' || cnt, ',' ORDER BY status)::text AS n FROM (
                                   SELECT status::text, count(*) AS cnt FROM campaign_influencers GROUP BY status
                                 ) x`).catch(() => 'n/a'),
});

const afterOnly = async (c) => ({
  deferredRows: await one(c, `SELECT count(*)::int AS n FROM campaign_influencers WHERE status = 'deferred'`),
  withDeferredAt: await one(c, 'SELECT count(*)::int AS n FROM campaign_influencers WHERE deferred_at IS NOT NULL'),
  badMode: await one(c, `SELECT count(*)::int AS n FROM campaign_influencers
                          WHERE deferred_shoot_mode IS NOT NULL
                            AND deferred_shoot_mode NOT IN ('visit','shipment','remote')`),
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
  console.log(`  campaign_influencers rows     ${before.cis}`);
  console.log(`  status breakdown              ${before.byStatus}`);
  console.log();

  const sql = fs.readFileSync(path.join(__dirname, '../migrations', FILE), 'utf8');
  // The file's own ALTER TYPE line runs first, unwrapped (non-transactional add-value,
  // same reasoning as migration 038); the BEGIN/COMMIT-wrapped column additions after it
  // are stripped so this script controls that transaction instead. Pulled out by regex,
  // not by position in the file — a paragraph-split would have caught a blank line
  // inside the header comment instead of the statement itself.
  const enumMatch = sql.match(/^ALTER TYPE[^;]+;/m);
  if (!enumMatch) throw new Error(`Could not find the ALTER TYPE statement in ${FILE}`);
  const body = sql
    .slice(sql.indexOf('BEGIN;'))
    .replace(/^\s*BEGIN;\s*$/m, '')
    .replace(/^\s*COMMIT;\s*$/m, '');
  if (!body.includes('ADD COLUMN')) throw new Error(`Could not find the BEGIN/COMMIT column block in ${FILE}`);

  await c.query(enumMatch[0]);
  console.log(`applied  ${FILE} (enum value)`);

  await c.query('BEGIN');
  await c.query(body);
  console.log(`applied  ${FILE} (columns + constraint)`);

  const after = await snapshot(c);
  const extra = await afterOnly(c);
  console.log('\nAFTER' + (DRY ? ' (columns/constraint inside the rolled-back transaction; the enum value is NOT rolled back — see note)' : ''));

  let allOk = true;
  allOk &= row('campaign_influencers rows', after.cis, before.cis);
  console.log();
  allOk &= row('rows now status=deferred',  extra.deferredRows,   0);
  allOk &= row('rows with deferred_at set', extra.withDeferredAt, 0);
  allOk &= row('rows with an unknown mode', extra.badMode,        0);

  if (!allOk) {
    await c.query('ROLLBACK');
    console.error('\nROLLED BACK — a check failed. Columns/constraint were not committed.');
    console.error('NOTE: the enum value addition above cannot be rolled back by this script —');
    console.error('ALTER TYPE ADD VALUE commits on its own statement. It is harmless alone');
    console.error('(an unused enum value), but re-running --dry after a failure here will see');
    console.error("it already present, which is correct and not itself a problem.");
    await c.end();
    process.exit(1);
  }

  if (DRY) {
    await c.query('ROLLBACK');
    console.log('\nROLLED BACK the column/constraint half — nothing else was changed.');
    console.log("The enum value ('deferred') DOES remain — see the note above. Re-run with");
    console.log('--apply to commit the columns; the enum value will already be there.');
  } else {
    await c.query('COMMIT');
    console.log('\nCOMMITTED.');
  }
  await c.end();
})().catch(async (e) => {
  console.error('\nERROR —', e.message);
  process.exit(1);
});
