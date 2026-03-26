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

/**
 * Wipes all tables in dependency order so each test starts clean.
 * CASCADE handles any remaining FK references.
 */
async function truncateAll() {
  await pool.query(`
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
  `);
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, truncateAll, closePool };
