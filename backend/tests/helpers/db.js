'use strict';

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Test-helper pool. Contract: features/qa-db-env-resilience.
//   max:10                       — bumped from 5; raises queueing threshold
//                                  under sustained qa:db parallel test load.
//   connectionTimeoutMillis:10000 — matches app pool (src/config/db.js); makes
//                                   wait-for-connection failures surface loud
//                                   instead of hanging until Jest's 30s hook
//                                   timeout (which obscures the real cause).
const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10000,
});

// Loud diagnostic on unexpected pool errors. Logs pool state alongside the
// message so a future env-block (Connection terminated, etc.) is triageable
// without needing to re-run with --detectOpenHandles. NOT a mask — the error
// continues to propagate to whichever query/test triggered it.
pool.on('error', (err) => {
  try {
    console.error(
      '[test-pool] Unexpected pool error:', err && err.message,
      '— pool state:', {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      }
    );
  } catch (_) { /* never let diagnostic logging throw */ }
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
      brand_withdrawals,
      attribution_clicks,
      subscription_invoices,
      brand_subscriptions,
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
// Note: subscription_tiers + categories (admin-config seeded by M058) are
// NOT truncated — same pattern as escrow_fee_tiers (M037). Tests that
// PATCH these tables reset their rows explicitly in beforeEach.

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
