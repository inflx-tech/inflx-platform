'use strict';

/**
 * negotiation-expiry.job.js
 *
 * Runs every 30 minutes. For any negotiation whose expires_at has passed
 * while still in awaiting_brand or awaiting_influencer:
 *   1. Mark negotiation status='walked_away', clear current_turn + expires_at.
 *   2. Mark the parent campaign_influencer status='declined' with
 *      declined_reason='other' (the other side never responded).
 *   3. Notify the side that DROPPED THE BALL so they know why the slot died.
 *
 * Suggested cron schedule: '*\/30 * * * *'  (every 30 min)
 */

const db = require('../config/db');
const notificationService = require('../services/notification.service');

async function runNegotiationExpiryJob() {
  console.log('[JOB] negotiation-expiry: checking for stale negotiations...');

  const { rows: stale } = await db.query(
    `SELECT n.id              AS negotiation_id,
            n.current_turn,
            n.campaign_influencer_id,
            ci.id              AS ci_id,
            cs.campaign_id,
            c.name             AS campaign_name,
            inf_user.id        AS influencer_user_id,
            inf_user.fcm_token AS influencer_fcm_token,
            br_user.id         AS brand_user_id,
            br_user.fcm_token  AS brand_fcm_token
     FROM   negotiations n
     JOIN   campaign_influencers ci ON ci.id  = n.campaign_influencer_id
     JOIN   campaign_sets       cs ON cs.id  = ci.set_id
     JOIN   campaigns           c  ON c.id   = cs.campaign_id
     JOIN   brands              b  ON b.id   = c.brand_id
     JOIN   influencers         inf ON inf.id = ci.influencer_id
     JOIN   users               inf_user ON inf_user.id = inf.user_id
     JOIN   users               br_user  ON br_user.id  = b.user_id
     WHERE  n.status IN ('awaiting_brand', 'awaiting_influencer')
       AND  n.expires_at IS NOT NULL
       AND  n.expires_at < now()`
  );

  if (stale.length === 0) {
    console.log('[JOB] negotiation-expiry: nothing to expire.');
    return { expired_count: 0 };
  }

  console.log(`[JOB] negotiation-expiry: expiring ${stale.length} negotiation(s)...`);

  for (const n of stale) {
    await db.withTransaction(async (client) => {
      await client.query(
        `UPDATE negotiations
         SET status='walked_away', current_turn=NULL, expires_at=NULL
         WHERE id = $1`,
        [n.negotiation_id]
      );
      await client.query(
        `UPDATE campaign_influencers
         SET status = 'declined', declined_reason = 'other'
         WHERE id = $1`,
        [n.ci_id]
      );
    });

    // Whoever owed the next response is the one who dropped the ball.
    const culpritUserId  = n.current_turn === 'brand' ? n.brand_user_id      : n.influencer_user_id;
    const culpritFcm     = n.current_turn === 'brand' ? n.brand_fcm_token    : n.influencer_fcm_token;
    const otherUserId    = n.current_turn === 'brand' ? n.influencer_user_id : n.brand_user_id;
    const otherFcm       = n.current_turn === 'brand' ? n.influencer_fcm_token : n.brand_fcm_token;

    await notificationService.send({
      userId: culpritUserId,
      type:   'negotiation.expired',
      title:  'Negotiation Auto-Closed',
      body:   `The negotiation for "${n.campaign_name}" was auto-closed because no response was received within 48 hours.`,
      data:   { screen: 'negotiation', negotiation_id: n.negotiation_id },
      fcmToken: culpritFcm,
      sendSms: false,
    }).catch(e => console.error('[NOTIFICATION] negotiation.expired culprit failed:', e.message));

    await notificationService.send({
      userId: otherUserId,
      type:   'negotiation.expired',
      title:  'Negotiation Closed',
      body:   `The other party did not respond to the negotiation for "${n.campaign_name}" within 48 hours. The offer is now closed.`,
      data:   { screen: 'negotiation', negotiation_id: n.negotiation_id },
      fcmToken: otherFcm,
      sendSms: false,
    }).catch(e => console.error('[NOTIFICATION] negotiation.expired other failed:', e.message));
  }

  console.log(`[JOB] negotiation-expiry: done. Expired ${stale.length}.`);
  return { expired_count: stale.length };
}

module.exports = { runNegotiationExpiryJob };
