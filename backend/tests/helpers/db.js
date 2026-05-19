'use strict';

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 5,
});

async function query(text, params) {
  return pool.query(text, params);
}

const TRUNCATE_SQL = `
    TRUNCATE
      notifications,
      deliverable_stats,
      enquiry_leads,
      follower_bookings,
      follower_orders,
      follower_addresses,
      influencer_withdrawals,
      follower_transactions,
      escrow_entries,
      wallet_transactions,
      contracts,
      campaign_offers,
      brand_products,
      negotiation_turns,
      negotiations,
      deliverables,
      campaign_influencers,
      campaign_sets,
      campaigns,
      follower_follows,
      followers,
      influencers,
      brands,
      admin_profiles,
      refresh_tokens,
      otp_codes,
      users
    RESTART IDENTITY CASCADE
  `;

/**
 * Wipes all tables so each test starts clean.
 *
 * Hardened (contract: features/qa-db-truncate-flake): runs on a
 * dedicated client with a bounded `lock_timeout`. `TRUNCATE …
 * CASCADE` needs ACCESS EXCLUSIVE on every table, so it blocks
 * (previously until the 30s Jest hook timeout → flaky ±1
 * nondeterminism) whenever any other session still holds a
 * conflicting lock. With `lock_timeout` it instead fails FAST
 * and LOUD, and on a block we dump `pg_stat_activity` so the
 * actual blocker (pid / state / wait / query) is named — this
 * is diagnosis, NOT masking (the error is re-thrown).
 */
async function truncateAll() {
  const client = await pool.connect();
  try {
    await client.query(`SET lock_timeout = '8s'`);
    await client.query(TRUNCATE_SQL);
  } catch (err) {
    if (/lock timeout|canceling statement due to lock timeout/i.test(err.message)) {
      try {
        const { rows } = await pool.query(`
          SELECT pid, state, wait_event_type, wait_event,
                 EXTRACT(EPOCH FROM (now() - xact_start))::int AS xact_age_s,
                 EXTRACT(EPOCH FROM (now() - query_start))::int AS query_age_s,
                 left(query, 240) AS query
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND pid <> pg_backend_pid()
          ORDER BY xact_start NULLS LAST
        `);
        console.error('[truncateAll] BLOCKED — lock_timeout hit. Conflicting sessions:');
        for (const r of rows) {
          console.error(
            `  pid=${r.pid} state=${r.state} wait=${r.wait_event_type}/${r.wait_event} ` +
            `xact_age=${r.xact_age_s}s query_age=${r.query_age_s}s :: ${String(r.query).replace(/\s+/g, ' ').trim()}`
          );
        }
      } catch (diagErr) {
        console.error('[truncateAll] BLOCKED and diagnostic query failed:', diagErr.message);
      }
    }
    throw err; // loud — never swallow
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, truncateAll, closePool };
