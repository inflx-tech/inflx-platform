'use strict';

/**
 * READ-ONLY — show the latest store-context follower_transactions with the full money
 * breakdown, to verify a commission test. No writes.
 *   ENV_FILE=.env.prod-backup node scripts/check-store-sale.js
 */
const { Client } = require('pg');
const path = require('path');
const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[check-store-sale] ${(await c.query('SELECT current_database() d')).rows[0].d}\n`);

  const { rows } = await c.query(`
    SELECT ft.created_at, ft.transaction_type, b.business_name AS brand,
           i.instagram_handle AS via_store_creator,
           ft.via_store_influencer_id, ft.campaign_influencer_id,
           ft.gross_amount, ft.discount_amount, ft.net_amount,
           ft.influencer_commission, ft.marketplace_fee_amount, ft.brand_net,
           ft.status, ft.return_window_ends_at
      FROM follower_transactions ft
      JOIN brands b ON b.id = ft.brand_id
      LEFT JOIN influencers i ON i.id = ft.via_store_influencer_id
     ORDER BY ft.created_at DESC
     LIMIT 5`);

  if (!rows.length) { console.log('No transactions found.'); await c.end(); return; }
  console.log('Latest 5 transactions (newest first):');
  rows.forEach((r, n) => {
    console.log(`\n#${n + 1}  ${r.created_at}  ${r.transaction_type}  [${r.status}]`);
    console.log(`  brand:            ${r.brand}`);
    console.log(`  store-context:    ${r.via_store_creator ? '@' + r.via_store_creator + ' (in their store ✓)' : '— (not a store sale)'}`);
    console.log(`  net amount:       ₹${r.net_amount}   (gross ₹${r.gross_amount} − disc ₹${r.discount_amount})`);
    console.log(`  influencer earns: ₹${r.influencer_commission}  (in pending until ${r.return_window_ends_at ? new Date(r.return_window_ends_at).toDateString() : 'n/a'})`);
    console.log(`  platform fee:     ₹${r.marketplace_fee_amount}`);
    console.log(`  brand nets:       ₹${r.brand_net}`);
  });
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
