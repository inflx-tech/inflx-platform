'use strict';

/** Apply migration 152 (collab diary + pitch rounds).
 * Contract: features/collab-phase0-foundations
 *
 * Target is chosen by argv: `node scripts/run-152.js staging|prod`.
 * Additive DDL plus one factual backfill; idempotent, so re-running is safe.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const target = (process.argv[2] || '').toLowerCase();
if (!['staging', 'prod'].includes(target)) {
  console.error('Usage: node scripts/run-152.js staging|prod');
  process.exit(1);
}
require('dotenv').config({
  path: path.join(__dirname, target === 'prod' ? '../.env.prod-backup' : '../.env.staging'),
});

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs) { console.error('ABORT: no DATABASE_URL for', target); process.exit(1); }
  console.log(`Target [${target}]: ${cs.replace(/:[^:@]+@/, ':***@')}`);

  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync(
    path.join(__dirname, '../migrations', '152_collab_diary_and_pitch_rounds.sql'), 'utf8'));

  const { rows } = await c.query(`
    SELECT
      (SELECT count(*)::int FROM collab_events)                                        AS diary_rows,
      (SELECT count(*)::int FROM information_schema.columns
        WHERE table_name = 'collab_events')                                            AS diary_cols,
      (SELECT count(*)::int FROM information_schema.columns
        WHERE table_name = 'influencer_proposals'
          AND column_name IN ('brand_rounds_used','creator_rounds_used','counter_by'))  AS pitch_cols,
      (SELECT count(*)::int FROM influencer_proposals
        WHERE counter_terms IS NOT NULL AND counter_by IS NULL)                        AS unbackfilled
  `);
  console.log('post-migration:', rows[0]);
  const r = rows[0];
  const ok = r.diary_rows === 0 && r.pitch_cols === 3 && r.unbackfilled === 0;
  console.log(ok ? 'OK — diary empty by design, 3 columns present, backfill complete'
                 : 'CHECK FAILED — inspect above');
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
