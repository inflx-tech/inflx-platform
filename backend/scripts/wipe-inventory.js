'use strict';

/**
 * wipe-inventory.js — Stage 0, job B2. READ ONLY. Deletes nothing.
 * Contract: features/stage-0-clear-the-decks
 *
 * Prints exactly what the wipe would remove and what it would keep, so the founder
 * can look at the list before agreeing to anything. Run it against production with
 * the prod credentials:
 *
 *   node scripts/wipe-inventory.js
 *
 * Deliberately has no --execute flag and no DELETE statement anywhere in it. The
 * thing that removes data is a separate file, so a mistyped argument here can never
 * destroy anything.
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

// Everything that belongs to a test account, in the order it would be removed:
// children before parents, so nothing relies on a cascade.
const USER_DATA = [
  'collab_events', 'brand_collab_requests', 'brand_request_cooldowns',
  'influencer_proposals', 'collab_agreements',
  'post_events', 'creator_posts', 'creator_assets',
  'deliverables', 'production_events', 'contracts',
  'negotiation_turns', 'negotiations',
  'campaign_influencers', 'campaign_offers', 'campaign_sets', 'campaigns',
  'influencer_group_members', 'influencer_groups',
  'follower_transactions', 'follower_orders', 'follower_bookings',
  'follower_addresses', 'follower_follows', 'post_likes', 'post_saves',
  'enquiry_leads', 'attribution_clicks',
  'wallet_transactions', 'escrow_entries',
  'influencer_withdrawals', 'brand_withdrawals',
  'notifications', 'refresh_tokens', 'otp_codes',
  'brand_products',
  'brands', 'influencers', 'followers', 'agencies',
  'users',
];

// Configuration, not user data. These must survive.
const KEEP = [
  'subscription_tiers', 'category_nodes', 'follower_app_config',
  'handshake_settings', 'test_phone_numbers',
];

async function countOf(client, table) {
  try {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
    return rows[0].n;
  } catch (err) {
    return err.message.includes('does not exist') ? null : `ERROR: ${err.message}`;
  }
}

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('\n================ WHAT THE WIPE WOULD REMOVE ================\n');
  let total = 0;
  for (const table of USER_DATA) {
    const n = await countOf(client, table);
    if (n === null) continue;                       // table not in this database
    if (typeof n === 'string') { console.log(`  ${table.padEnd(30)} ${n}`); continue; }
    if (n > 0) console.log(`  ${table.padEnd(30)} ${String(n).padStart(6)}`);
    if (typeof n === 'number') total += n;
  }
  console.log(`  ${''.padEnd(30)} ${'------'}`);
  console.log(`  ${'TOTAL ROWS'.padEnd(30)} ${String(total).padStart(6)}\n`);

  // The headline numbers, in the founder's language.
  const { rows: people } = await client.query(
    `SELECT role, count(*)::int AS n FROM users GROUP BY role ORDER BY 2 DESC`
  );
  console.log('  Accounts by kind:');
  for (const r of people) console.log(`    ${r.role.padEnd(14)} ${String(r.n).padStart(5)}`);

  console.log('\n================ WHAT SURVIVES ================\n');
  for (const table of KEEP) {
    const n = await countOf(client, table);
    if (n === null) { console.log(`  ${table.padEnd(30)} (not present)`); continue; }
    console.log(`  ${table.padEnd(30)} ${String(n).padStart(6)}`);
  }

  console.log('\n================ SAFETY CHECKS ================\n');
  const { rows: money } = await client.query(
    `SELECT
       (SELECT COALESCE(sum(wallet_balance),0) FROM brands)          AS brand_wallets,
       (SELECT COALESCE(sum(wallet_balance),0) FROM influencers)     AS creator_wallets,
       (SELECT COALESCE(sum(pending_balance),0) FROM influencers)    AS creator_pending,
       (SELECT count(*)::int FROM wallet_transactions)               AS wallet_movements,
       (SELECT count(*)::int FROM influencer_withdrawals)            AS withdrawals`
  );
  const m = money[0];
  console.log(`  Brand wallets holding      ₹${m.brand_wallets}`);
  console.log(`  Creator wallets holding    ₹${m.creator_wallets}`);
  console.log(`  Creator money pending      ₹${m.creator_pending}`);
  console.log(`  Wallet movements ever      ${m.wallet_movements}`);
  console.log(`  Withdrawals ever           ${m.withdrawals}`);

  const anyMoney =
    Number(m.brand_wallets) > 0 || Number(m.creator_wallets) > 0 ||
    Number(m.creator_pending) > 0 || m.wallet_movements > 0 || m.withdrawals > 0;

  console.log(
    anyMoney
      ? '\n  *** REAL MONEY IS PRESENT. DO NOT WIPE. Escalate to the founder. ***\n'
      : '\n  No money has ever moved. Nothing financial is lost by wiping.\n'
  );

  // Any account that does not look like test data deserves a second look before
  // it is destroyed. Cheap to print, and the only chance to catch a real person.
  const { rows: suspicious } = await client.query(
    `SELECT phone, role, name, created_at::date AS joined FROM users
      WHERE name NOT ILIKE '%test%' AND name NOT ILIKE '%tester%'
        AND name NOT ILIKE 'follower' AND name NOT ILIKE '%[FTW]%'
        AND name NOT ILIKE 'Pending (%' AND name NOT ILIKE '%User%'
        AND name NOT ILIKE 'Aveen%' AND name NOT ILIKE '%Boy%'
      ORDER BY created_at DESC LIMIT 30`
  );
  console.log('  Accounts whose name does not obviously read as test data:');
  if (suspicious.length === 0) {
    console.log('    (none — every account reads as test data)\n');
  } else {
    for (const s of suspicious) {
      console.log(`    ${s.phone}  ${String(s.role).padEnd(11)} ${String(s.name).padEnd(30)} ${s.joined.toISOString().slice(0, 10)}`);
    }
    console.log('\n    ^ Read this list before agreeing to the wipe.\n');
  }

  await client.end();
})().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
