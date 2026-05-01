'use strict';

/**
 * production-shipment-reminder.job.js — Phase P.3
 *
 * Daily check for shipment-mode production events that are stuck. Two
 * cohorts:
 *
 *   3-7 days dispatched, no receipt confirmation
 *     → push reminder to influencer ("did your package arrive?")
 *
 *   14+ days dispatched, no receipt confirmation
 *     → push reminder, plus mark for admin attention.
 *       Admin sees these in /v1/admin/production/queue and decides
 *       whether to force-complete or escalate. We deliberately don't
 *       auto-complete — too risky (could pay out for a package the
 *       influencer never got).
 */

const db = require('../config/db');
const notificationService = require('../services/notification.service');

async function run() {
  console.log('[CRON production-reminder] Running...');

  // Find in-transit shipments older than 3 days without confirmation.
  const { rows } = await db.query(
    `SELECT pe.id, pe.shipment_dispatched_at, pe.shipment_courier, pe.shipment_awb,
            c.campaign_influencer_id,
            inf_u.id AS influencer_user_id, inf_u.fcm_token, inf_u.phone,
            camp.name AS campaign_name,
            EXTRACT(EPOCH FROM (NOW() - pe.shipment_dispatched_at)) / 86400 AS days_since_dispatch
     FROM   production_events pe
     JOIN   contracts c ON c.id = pe.contract_id
     JOIN   campaign_influencers ci ON ci.id = c.campaign_influencer_id
     JOIN   campaign_sets cs ON cs.id = ci.set_id
     JOIN   campaigns camp ON camp.id = cs.campaign_id
     JOIN   influencers inf ON inf.id = ci.influencer_id
     JOIN   users inf_u ON inf_u.id = inf.user_id
     WHERE  pe.mode = 'shipment'
       AND  pe.status = 'in_progress'
       AND  pe.shipment_dispatched_at IS NOT NULL
       AND  pe.shipment_dispatched_at < NOW() - INTERVAL '3 days'
       AND  pe.shipment_received_confirmed_at IS NULL`
  );

  let reminded3 = 0;
  let reminded14 = 0;

  for (const ev of rows) {
    const days = Number(ev.days_since_dispatch || 0);
    const tracking = [ev.shipment_courier, ev.shipment_awb].filter(Boolean).join(' · ');
    try {
      if (days >= 14) {
        // Escalation reminder — also flagged for admin via the queue endpoint.
        await notificationService.send({
          userId:  ev.influencer_user_id,
          type:    'production.shipment_overdue',
          title:   'Did your package arrive?',
          body:    `It's been ${Math.floor(days)} days since the brand dispatched the package for "${ev.campaign_name}". Please confirm receipt or contact support.`,
          data:    { screen: 'contract_detail', campaign_influencer_id: ev.campaign_influencer_id, tracking },
          fcmToken: ev.fcm_token,
          sendSms:  true,
          phone:    ev.phone,
        });
        reminded14++;
      } else {
        await notificationService.send({
          userId:  ev.influencer_user_id,
          type:    'production.shipment_reminder',
          title:   'Confirm package receipt',
          body:    `The brand shipped your package for "${ev.campaign_name}" ${Math.floor(days)} days ago. Tap to confirm receipt once it arrives.`,
          data:    { screen: 'contract_detail', campaign_influencer_id: ev.campaign_influencer_id, tracking },
          fcmToken: ev.fcm_token,
          sendSms:  false,
          phone:    ev.phone,
        });
        reminded3++;
      }
    } catch (err) {
      console.error('[CRON production-reminder] notify failed:', err.message);
    }
  }

  console.log(`[CRON production-reminder] sent ${reminded3} 3+ day reminders, ${reminded14} 14+ day escalations`);
  return { reminded3, reminded14 };
}

module.exports = { run };
