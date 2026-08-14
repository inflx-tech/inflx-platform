'use strict';

/** Apply migration 150 (post event log + follower_transactions.via_post_id) to
 * PRODUCTION. Loads ../.env.prod-backup. Additive DDL only; idempotent.
 * Contract: features/follower-event-log/ */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs || !cs.includes('supabase')) { console.error('ABORT: not prod (.env.prod-backup).'); process.exit(1); }
  console.log(`Target: ${cs.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();

  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '150_post_event_log.sql'), 'utf8'));

  const { rows } = await c.query(`
    SELECT
      (SELECT count(*)::int FROM information_schema.tables
        WHERE table_name = 'post_events')                                          AS events_table,
      (SELECT count(*)::int FROM post_events)                                      AS event_rows,
      (SELECT count(*)::int FROM information_schema.columns
        WHERE table_name = 'follower_transactions' AND column_name = 'via_post_id') AS via_post_col,
      (SELECT count(*)::int FROM follower_transactions WHERE via_post_id IS NOT NULL) AS linked_txns,
      (SELECT count(*)::int FROM pg_indexes WHERE indexname = 'idx_post_events_post') AS post_idx,
      (SELECT count(*)::int FROM pg_indexes WHERE indexname = 'idx_ft_via_post')      AS ft_idx`);

  console.log('OK —', rows[0]);
  console.log('(expected: events_table 1 · event_rows 0 · via_post_col 1 · linked_txns 0 · post_idx 1 · ft_idx 1)');
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
