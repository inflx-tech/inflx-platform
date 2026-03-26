'use strict';

/**
 * offer-expiry.job.js
 * Block B — runs every 15 minutes (see Section 8 of spec).
 *
 * Finds all campaign_influencer rows where:
 *   - status = 'invited'
 *   - offer_expires_at < now()
 *
 * For each expired offer:
 *   1. Sets status = 'expired'
 *   2. Sends push + in-app notification to the brand (offer expired on their campaign)
 *
 * Schedule: every 15 minutes  → '0,15,30,45 * * * *'
 * Entry point: called from src/index.js via setInterval or a cron library.
 */

const db = require('../config/db');
const notificationService = require('../services/notification.service');

async function runOfferExpiryJob() {
  console.log('[JOB] offer-expiry: checking for expired offers...');

  // Find all expired offers that haven't been processed yet
  const { rows: expired } = await db.query(
    `SELECT ci.id,
            ci.influencer_id,
            ci.agreed_fee,
            cs.campaign_id,
            c.brand_id,
            c.name AS campaign_name,
            u.id   AS brand_user_id,
            u.fcm_token AS brand_fcm_token,
            u.phone AS brand_phone
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
     JOIN users u ON u.id = b.user_id
     WHERE ci.status = 'invited'
       AND ci.offer_expires_at < now()`
  );

  if (expired.length === 0) {
    console.log('[JOB] offer-expiry: no expired offers found.');
    return { expired_count: 0 };
  }

  console.log(`[JOB] offer-expiry: expiring ${expired.length} offer(s)...`);

  for (const offer of expired) {
    // 1. Mark as expired
    await db.query(
      `UPDATE campaign_influencers SET status = 'expired' WHERE id = $1`,
      [offer.id]
    );

    // 2. Notify the brand that an offer expired
    await notificationService.send({
      userId: offer.brand_user_id,
      type: 'offer.expired',
      title: 'Offer Expired',
      body: `An influencer did not respond to your invitation for campaign "${offer.campaign_name}" within 48 hours.`,
      data: {
        screen: 'campaign_detail',
        campaign_id: offer.campaign_id,
        campaign_influencer_id: offer.id,
      },
      fcmToken: offer.brand_fcm_token,
      sendSms: false,
      phone: offer.brand_phone,
    });
  }

  console.log(`[JOB] offer-expiry: done. Expired ${expired.length} offer(s).`);
  return { expired_count: expired.length };
}

module.exports = { runOfferExpiryJob };
