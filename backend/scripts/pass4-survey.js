'use strict';
/**
 * Pass 4, step 1 of 3 — SURVEY. Reads only; writes nothing, drops nothing.
 *
 * Docs/THE_CUT.md pass 4. Before anything is exported or dropped, this establishes
 * the truth against the LIVE database: which of the retired tables actually exist,
 * and how many rows each holds right now.
 *
 * The inventory that named "72 empty, 13 with data" was taken earlier in the same
 * session. Acting on a remembered number rather than a fresh one is exactly how an
 * irreversible step goes wrong, so it is re-taken here.
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

// Every table belonging to a retired era. Grouped so the report reads by decision,
// not alphabetically.
const GROUPS = {
  'Food and restaurants': [
    'master_dishes', 'master_dish_aliases', 'master_dish_queue', 'dish_cuisines',
    'dish_groups', 'dish_group_members', 'restaurant_details', 'restaurant_reviews',
    'meal_settings', 'meal_slots', 'meal_offer_rules', 'meal_intents', 'meal_offers',
    'meal_orders', 'meal_learnings', 'diner_preferences', 'meal_chats',
    'product_addon_groups', 'product_addon_items', 'addon_templates',
  ],
  'Car rental and local services': [
    'master_vehicles', 'master_services', 'bookings',
  ],
  'The pre-agreement pathway': [
    'brand_collab_requests', 'collab_agreements', 'collab_diary_entries',
    'handshake_settings', 'collab_cooldowns', 'influencer_proposals',
    'proposal_cooldowns', 'negotiation_rounds', 'negotiation_turns_legacy',
  ],
  'Referrals and agencies': [
    'referral_codes', 'referral_edges', 'referral_earnings',
    'referral_applications', 'referral_settings', 'agencies', 'agency_withdrawals',
  ],
  'The design system that was never connected': [
    'design_tokens', 'design_presets', 'page_layouts', 'shop_themes',
    'experience_templates', 'creator_experiences', 'experience_products',
    'creator_photos', 'creator_product_photos',
  ],
  'Shopper features removed': [
    'follower_wallet', 'follower_wallet_transactions', 'saved_offers',
    'enquiry_leads', 'lookbooks', 'lookbook_products',
  ],
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows: existing } = await c.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const present = new Set(existing.map(r => r.table_name));

  let totalEmpty = 0, totalWithData = 0, totalMissing = 0;
  const withData = [];

  for (const [group, tables] of Object.entries(GROUPS)) {
    console.log('\n=== ' + group + ' ===');
    for (const t of tables) {
      if (!present.has(t)) { console.log('  (no such table)      ' + t); totalMissing++; continue; }
      const { rows } = await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
      const n = rows[0].n;
      if (n === 0) { totalEmpty++; console.log('  empty                ' + t); }
      else { totalWithData++; withData.push({ table: t, rows: n, group }); console.log('  ' + String(n).padStart(6) + ' rows          ' + t); }
    }
  }

  console.log('\n---------------------------------------------');
  console.log('empty (safe to drop outright): ' + totalEmpty);
  console.log('HOLD DATA (export first):      ' + totalWithData);
  console.log('named but do not exist:        ' + totalMissing);
  if (withData.length) {
    console.log('\nTHE EXPORT LIST:');
    for (const w of withData) console.log('  ' + String(w.rows).padStart(6) + '  ' + w.table);
  }

  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
