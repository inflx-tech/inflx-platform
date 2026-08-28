'use strict';

/**
 * Apply migration 164 (two-sided shoot completion).
 * Contract: features/shoot-starts-where-the-agreement-left-it
 *
 * Additive + idempotent (IF NOT EXISTS). The one UPDATE only makes already-completed rows
 * self-consistent; it cannot un-complete anything.
 *
 * Pass --dry to run it inside a transaction that is ROLLED BACK, printing the before/after
 * counts. Nothing about a production schema change should be found out by doing it.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
require('dotenv').config({ path: path.join(__dirname, DRY ? '../.env.prod-backup' : '../.env') });

const counts = async (c) => {
  const q = async (sql) => (await c.query(sql)).rows[0].n;
  return {
    total:      await q('SELECT count(*)::int AS n FROM production_events'),
    completed:  await q("SELECT count(*)::int AS n FROM production_events WHERE status = 'completed'"),
    halfMarked: await q(`SELECT count(*)::int AS n FROM production_events
                          WHERE status = 'completed'
                            AND (brand_completed_at IS NULL OR influencer_completed_at IS NULL)`)
      .catch(() => null),
    earlyMarked: await q(`SELECT count(*)::int AS n FROM production_events
                           WHERE status <> 'completed'
                             AND (brand_completed_at IS NOT NULL OR influencer_completed_at IS NOT NULL)`)
      .catch(() => null),
  };
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const f = '164_shoot_two_sided_completion.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');

  const before = { total: (await c.query('SELECT count(*)::int AS n FROM production_events')).rows[0].n,
                   completed: (await c.query("SELECT count(*)::int AS n FROM production_events WHERE status='completed'")).rows[0].n };
  console.log('BEFORE  rows=%d  completed=%d', before.total, before.completed);

  if (DRY) {
    // The file has its own BEGIN/COMMIT, so strip them and wrap the body ourselves.
    const body = sql.replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, '');
    await c.query('BEGIN');
    await c.query(body);
    const after = await counts(c);
    console.log('AFTER (in the rolled-back transaction)');
    console.log('  rows            %d   (must equal %d)', after.total, before.total);
    console.log('  completed       %d   (must equal %d)', after.completed, before.completed);
    console.log('  half-marked     %s   (must be 0)', after.halfMarked);
    console.log('  marked early    %s   (must be 0)', after.earlyMarked);
    await c.query('ROLLBACK');
    console.log('\nROLLED BACK — nothing was changed.');
  } else {
    process.stdout.write(`Running ${f} ... `);
    await c.query(sql);
    console.log('OK');
    const after = await counts(c);
    console.log('AFTER   rows=%d  completed=%d  half-marked=%s  marked-early=%s',
      after.total, after.completed, after.halfMarked, after.earlyMarked);
    const { rows } = await c.query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_name='production_events'
         AND column_name IN ('brand_completed_at','influencer_completed_at')
       ORDER BY column_name`);
    console.log('columns present:', rows.map(r => r.column_name).join(', '));
  }

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
