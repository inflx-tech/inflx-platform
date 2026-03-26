'use strict';

const db = require('../config/db');
const notificationService = require('../services/notification.service');

async function run() {
  console.log('[CRON low-wallet] Running...');

  // For each brand with at least one active campaign, find highest upcoming queued tranche
  const { rows: brandData } = await db.query(
    `SELECT
       b.id AS brand_id,
       b.wallet_balance,
       u.id AS user_id,
       u.fcm_token,
       u.phone,
       u.name,
       MAX(ee.amount) AS highest_upcoming_tranche
     FROM brands b
     JOIN users u ON u.id = b.user_id
     JOIN campaigns c ON c.brand_id = b.id AND c.status IN ('active', 'live', 'published')
     JOIN campaign_sets cs ON cs.campaign_id = c.id
     JOIN campaign_influencers ci ON ci.set_id = cs.id
     JOIN escrow_entries ee ON ee.campaign_influencer_id = ci.id AND ee.status = 'queued'
     GROUP BY b.id, b.wallet_balance, u.id, u.fcm_token, u.phone, u.name`
  );

  if (brandData.length === 0) {
    console.log('[CRON low-wallet] No brands with active campaigns and queued tranches.');
    return { alerted: 0 };
  }

  let alerted = 0;

  for (const brand of brandData) {
    const walletBalance = parseFloat(brand.wallet_balance);
    const highestTranche = parseFloat(brand.highest_upcoming_tranche);

    if (walletBalance < highestTranche) {
      const balanceRupees = (walletBalance / 100).toFixed(2);
      await notificationService.send({
        userId: brand.user_id,
        type: 'wallet.low_balance',
        title: 'Low Wallet Balance',
        body: `Wallet balance (₹${balanceRupees}) is below your campaign requirement`,
        data: { screen: 'wallet' },
        fcmToken: brand.fcm_token,
        sendSms: true,
        phone: brand.phone,
      });
      alerted++;
    }
  }

  console.log(`[CRON low-wallet] Alerted ${alerted} brands`);
  return { alerted };
}

module.exports = { run };
