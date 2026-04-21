'use strict';

const db = require('../config/db');
const notificationService = require('../services/notification.service');

async function run() {
  console.log('[CRON commission-confirm] Running...');

  const { rows: ready } = await db.query(
    `SELECT ft.*, ci.influencer_id, i.user_id AS influencer_user_id, u.fcm_token, u.phone
     FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE ft.return_window_ends_at <= NOW()
       AND ft.commission_confirmed_at IS NULL
       AND ft.status = 'completed'`
  );

  if (ready.length === 0) {
    console.log('[CRON commission-confirm] No commissions to confirm.');
    return { confirmed: 0, total_amount: 0 };
  }

  let totalAmount = 0;

  for (const tx of ready) {
    const commission = parseFloat(tx.influencer_commission);
    totalAmount += commission;

    // 1. Mark commission confirmed
    await db.query(
      `UPDATE follower_transactions SET commission_confirmed_at = NOW() WHERE id = $1`,
      [tx.id]
    );

    // 2. Move pending_balance → wallet_balance (do NOT touch total_earned — already added at transaction time)
    await db.query(
      `UPDATE influencers
       SET wallet_balance  = wallet_balance  + $1,
           pending_balance = pending_balance - $1
       WHERE id = $2`,
      [commission, tx.influencer_id]
    );

    // 3. Notify influencer
    await notificationService.send({
      userId: tx.influencer_user_id,
      type: 'commission.confirmed',
      title: 'Commission Confirmed',
      body: `\u20B9${commission.toFixed(2)} commission confirmed \u2014 available to withdraw`,
      data: { screen: 'earnings' },
      fcmToken: tx.fcm_token,
      sendSms: false,
      phone: tx.phone,
    });
  }

  console.log(`[CRON commission-confirm] Confirmed ${ready.length} commissions totalling \u20B9${totalAmount.toFixed(2)}`);
  return { confirmed: ready.length, total_amount: totalAmount };
}

module.exports = { run };
