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
      test_phone_numbers,
      referral_ledger,
      referral_edges,
      referral_codes,
      agency_withdrawals,
      agencies,
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
      brand_offers,
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
/**
 * Reference data that migrations seed and TRUNCATE ... CASCADE then destroys.
 *
 * The comment above TRUNCATE_SQL claims subscription_tiers and categories are "NOT
 * truncated". Measured 2026-08-22: after migrations there are 4 tiers; after one
 * truncateAll there are 0. CASCADE reaches them, and the note was simply wrong.
 *
 * The cost was not subtle. Campaign creation refuses to run without a 'free' tier —
 * it answers 500 "free tier missing from subscription_tiers" — so from the first
 * cleanup of the first suite onward, EVERY test that creates a campaign failed, and
 * every test built on a campaign failed behind it. That single defect accounted for
 * roughly three-quarters of the suite's ~232 failures.
 *
 * Re-seeding here rather than widening the truncate list: these rows are seeded by
 * migration and are configuration, so the guarantee tests need is "they are present
 * at the start of every test", which is what this restores.
 */
async function reseedReferenceData(client) {
  await client.query(`
    INSERT INTO subscription_tiers
      (tier_key, name, monthly_price_inr, max_campaigns, max_sets_per_campaign,
       max_influencers_per_cycle, max_products, is_enterprise, sort_order, description)
    VALUES
      ('free',       'Free',           0.00,  1, 1,  5,  10, false, 1, 'Starter plan'),
      ('growth',     'Growth',      2499.00,  3, 3, 25, 100, false, 2, 'Growth plan'),
      ('scale',      'Scale',       7999.00, 10, 5, 75, 500, false, 3, 'Scale plan'),
      ('enterprise', 'Enterprise',     0.00, -1,-1, -1,  -1, true,  4, 'Enterprise plan')
    ON CONFLICT (tier_key) DO NOTHING
  `);
  /**
   * ⚠ THE CATALOGUE, AND THE TIER ROWS THAT GIVE IT MEANING.
   *
   * Contract: features/quota-tests-prove-nothing
   *
   * Both are configuration seeded by migration 061, both are reached by CASCADE, and neither
   * was being put back. The cost was silent and total:
   *
   *   no `features` rows  -> entitlements.getEntitlements reads an EMPTY catalogue
   *                       -> every quota answers null
   *                       -> quotaCheck reads null as "not configured" and PASSES
   *
   * So "the 11th product must be refused" failed unnoticed among the suite's known failures,
   * while every test that creates several products or campaigns passed for the wrong reason:
   * not because its brand was entitled to them, but because no limit existed at all.
   *
   * `tier_features` is the second half and just as necessary. subscription_tiers alone is not
   * what entitlements reads. With a catalogue but no tier rows, EVERY brand falls back to the
   * catalogue defaults - 1 campaign, 1 set, 10 products, 5 invites - whichever plan it is on,
   * so an enterprise test brand (what registerBrand creates) reads as the smallest plan there
   * is. Seeding the catalogue without this turns 23 green tests red; measured 2026-09-16.
   */
  await client.query(`
    INSERT INTO features (feature_key, label, category, feature_type, unit, default_quota, sort_order, description) VALUES
      ('discover_filter',           'Discover filter',                'influencer',  'config',   NULL,        NULL,  1, 'Limits which influencers a brand can see by niche and area'),
      ('search_filters_advanced',   'Advanced search filters',        'influencer',  'boolean',  NULL,        NULL,  2, 'Access to collaboration history + engagement-tier filters on top of basic search'),
      ('bulk_outreach',             'Bulk influencer outreach',       'influencer',  'boolean',  NULL,        NULL,  3, 'Send invitations to many influencers in one action'),
      ('invitations_per_cycle',     'Influencer invitations per cycle','influencer', 'quota',    'per_cycle', 5,     4, 'Max number of influencer invites a brand can issue per subscription cycle'),
      ('open_group_broadcast',      'Open-group campaign broadcast',  'influencer',  'config',   NULL,        NULL,  5, 'Publish a campaign as open-group with area scope + recipient cap'),
      ('active_campaigns',          'Active campaigns',               'campaigns',   'quota',    'count',     1,     6, 'Max simultaneously active campaigns'),
      ('sets_per_campaign',         'Sets per campaign',              'campaigns',   'quota',    'count',     1,     7, 'Max influencer sets a brand can create within one campaign'),
      ('products_in_store',         'Products in store',              'products',    'quota',    'count',     10,    8, 'Max active product listings visible to followers'),
      ('media_gallery_items',       'Media gallery items',            'products',    'quota',    'count',     20,    9, 'Max images/videos uploadable to a brand gallery'),
      ('multi_branch_support',      'Multi-branch support',           'brand_store', 'boolean',  NULL,        NULL,  10, 'Manage multiple physical branches under one brand account'),
      ('self_serve_onboarding',     'Self-serve onboarding',          'support',     'baseline', NULL,        NULL,  11, 'Default account creation flow available to everyone'),
      ('dedicated_onboarding_call', 'Dedicated onboarding call',      'support',     'boolean',  NULL,        NULL,  12, 'One-on-one onboarding call with INFLX team at sign-up'),
      ('phone_support_24x7',        '24x7 phone support',             'support',     'boolean',  NULL,        NULL,  13, 'Round-the-clock phone support hotline')
    ON CONFLICT (feature_key) DO NOTHING
  `);
  // Each tier carries its own number, straight off the tier row, so enterprise reads -1
  // (unlimited) and free reads the free numbers.
  await client.query(`
    INSERT INTO tier_features (tier_id, feature_id, included, quota_value, config)
    SELECT t.id, f.id,
           CASE WHEN f.feature_type = 'quota' THEN true ELSE t.tier_key <> 'free' END,
           CASE f.feature_key
             WHEN 'active_campaigns'      THEN t.max_campaigns
             WHEN 'sets_per_campaign'     THEN t.max_sets_per_campaign
             WHEN 'invitations_per_cycle' THEN t.max_influencers_per_cycle
             WHEN 'products_in_store'     THEN t.max_products
             WHEN 'media_gallery_items'   THEN CASE WHEN t.is_enterprise THEN -1 ELSE 20 END
           END,
           '{}'::jsonb
      FROM subscription_tiers t, features f
    ON CONFLICT (tier_id, feature_id) DO NOTHING
  `);
  // Item 6: platform_settings is seeded by migration 182 and is configuration, not test data —
  // the same reasoning as the tiers above. Without it every read falls back to the code defaults
  // and no admin write has a row to change.
  await client.query(`
    INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
      ('negotiation_rounds',  2,  1,  5, 'rounds', 'Negotiation rounds'),
      ('pool_lifetime_days', 30,  7, 90, 'days',   'Pool entry lifetime'),
      ('min_shoppable_posts', 1,  1, 10, 'post',   'Minimum shoppable posts'),
      ('campaign_fee_pct',    8,  0, 30, 'percent', 'INFLX campaign fee'),
      ('remote_return_days',  7,  1, 60, 'days',   'Remote return window'),
      ('pitch_response_days', 30, 7, 90, 'days',   'Pitch response period'),
      ('pitch_cooldown_days', 30, 0, 90, 'days',   'Pitch rejection cooldown'),
      ('shoot_auto_confirm_days', 3, 1, 30, 'days', 'Store visit auto-confirm'),
      -- Item 11 (R17). And "subscriptions_enforced", which migration 185 added and this list
      -- never gained — so after the first truncateAll of any run it was missing too.
      --
      -- WHY A MISSING ROW HERE IS NOT COSMETIC: platform_settings_audit.key REFERENCES
      -- platform_settings(key). The service validates a write against the CODE defaults, so
      -- an admin PATCH of a key with no row passes validation, updates nothing, and then dies
      -- on the audit insert's foreign key — surfacing as a bare 422 "Referenced resource does
      -- not exist" that says nothing about what is actually wrong. Every key the code knows
      -- about belongs in this list.
      ('subscriptions_enforced', 1, 0, 1, 'on/off', 'Subscription plans'),
      ('remote_return_autoconfirm_days', 7, 1, 30, 'days', 'Remote return auto-confirm'),
      -- Item 12 (C17): the two new numbers, and the waiting period moved from payment_config (Q4).
      ('content_change_rounds',       2, 1,  5, 'rounds', 'Content change requests'),
      ('content_report_silence_days', 7, 1, 30, 'days',   'Brand silence before the Creator may report'),
      ('final_payment_wait_days',     7, 1, 60, 'days',   'Final payment waiting period'),
      -- post-links-codes (mig 196) and the shopper app's feed (follower-app-v2, mig 197).
      ('link_channel_window_days', 30, 1, 90, 'days', 'Link channel window'),
      ('feed_near_km',        50, 5, 500, 'km',      'Near range'),
      ('feed_new_share_pct',  15, 0, 50,  'percent', 'Places for new posts'),
      ('feed_new_hours',      48, 6, 168, 'hours',   'A post counts as new for'),
      ('feed_repeat_days',    30, 1, 90,  'days',    'Seen posts stay out of the feed for'),
      ('feed_learning_on',     0, 0, 1,   'on/off',  'Feed that learns'),
      ('feed_w_does',         40, 0, 100, 'weight',  'Dial: what she does'),
      ('feed_w_recent',       25, 0, 100, 'weight',  'Dial: how recent'),
      ('feed_w_near',         15, 0, 100, 'weight',  'Dial: how near'),
      ('feed_w_performs',     20, 0, 100, 'weight',  'Dial: how it performs')
    ON CONFLICT (key) DO NOTHING
  `);
  // Item 7: the standard terms are seeded by migration 183 and are configuration
  // too — and they are load-bearing, because generating an agreement without a
  // current version is refused outright rather than stamped with nothing.
  await client.query(`
    INSERT INTO standard_terms (version, body_md, is_current)
    VALUES ('1.0',
'1. The influencer agrees to create and publish content as specified above.
2. Content must be original, accurate, and comply with ASCI guidelines for sponsored content.
3. The brand retains the right to request up to the specified number of revisions.
4. Commission returns are subject to the return window stated in this agreement.
5. TDS of 10% will be deducted from withdrawals as per applicable Indian tax law.
6. Any disputes shall be resolved through the INFLX platform dispute resolution process.
7. This contract is governed by the laws of India.
8. The creator receives the agreed amount in full. The INFLX campaign fee is paid by the brand and is never deducted from a creator payment.
9. For Remote work the creator returns anything she does not keep within the period stated in this agreement, and the brand pays the return shipping.',
      true)
    ON CONFLICT (version) DO NOTHING
  `);

  /**
   * Item 9: the per-business sale rates, seeded by migration 058 and destroyed by the
   * same CASCADE that took the tiers. This is the table that decides what INFLX takes
   * when a follower buys, looked up by the business type a store registered under —
   * so with it empty every sale silently falls back to a last-resort 8% and the
   * fallback looks like correct behaviour.
   *
   * Only the businesses INFLX currently accepts are needed here; fashion is the live
   * one (Docs/THE_CUT.md) and restaurant is kept because rows registered before the
   * accepted-business gate still carry it.
   */
  await client.query(`
    INSERT INTO categories (category_key, name, label, path_a_pct, path_b_pct, path_c_pct, active) VALUES
      ('fashion',    'Fashion',    'Fashion',    10.00, 5.00, 7.00, true),
      ('restaurant', 'Restaurant', 'Restaurant',  8.00, 4.00, 6.00, true)
    ON CONFLICT (category_key) DO NOTHING
  `);

  /**
   * The reseeded rows come back with NEW ids, and two services hold them for 60 seconds: the
   * entitlements catalogue and the platform settings. Without this the cached rows point at ids
   * that no longer exist, every tier_features lookup misses, and the service falls back to the
   * catalogue defaults - which reads exactly like "enterprise is capped at 10 products".
   */
  try { require('../../src/services/entitlements.service').bustCatalogCache(); } catch (e) { /* not loaded */ }
  try { require('../../src/services/platformSettings.service')._resetCache(); } catch (e) { /* not loaded */ }
}

async function truncateAll() {
  const client = await pool.connect();
  try {
    await client.query(`SET lock_timeout = '8s'`);
    await client.query(TRUNCATE_SQL);
    await reseedReferenceData(client);
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
