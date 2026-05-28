'use strict';

const db = require('../config/db');
const escrowService = require('../services/escrow.service');
const notificationService = require('../services/notification.service');
const taxService = require('../services/tax.service');

async function run() {
  console.log('[CRON tranche-3] Running...');

  // Wave 1 — read T3 timing from payment_config (admin-controllable).
  // Defaults: 30 days after triggered_at, IST clock time 03:00:00.
  // Cron schedule changed from daily-06:00-UTC to hourly so the configured
  // time-of-day is honored within ~1h. Defensive: tax.service falls back
  // to 30 days / 03:00 IST on read failure (pre-M074 columns missing).
  const releaseAfterDays = await taxService.getTrancheReleaseAfterDays();
  const releaseTimeIst   = await taxService.getTrancheReleaseTimeIst();
  console.log(`[CRON tranche-3] Config: ${releaseAfterDays}d after content_live, release at ${releaseTimeIst} IST`);

  const { rows: due } = await db.query(
    `SELECT ee.id, ee.net_to_influencer, ee.campaign_influencer_id,
            ci.influencer_id, ci.set_id,
            cs.campaign_id,
            c.brand_id,
            i.user_id AS influencer_user_id,
            u_inf.fcm_token AS inf_fcm_token,
            u_inf.phone AS inf_phone,
            u_inf.name AS inf_name,
            u_brand.id AS brand_user_id,
            u_brand.fcm_token AS brand_fcm_token
     FROM escrow_entries ee
     JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u_inf ON u_inf.id = i.user_id
     JOIN brands b ON b.id = c.brand_id
     JOIN users u_brand ON u_brand.id = b.user_id
     WHERE ee.trigger_event = 'day_30_post_live'
       AND ee.status = 'queued'
       -- (a) N days have elapsed since triggered_at (admin-configurable)
       AND ee.triggered_at <= NOW() - ($1 || ' days')::interval
       -- (b) AND the IST clock has crossed the configured release time
       --     today. So if admin sets release_time='02:30:00 IST', the
       --     row only fires at the first hourly cron tick at or after
       --     02:30 IST on the boundary day.
       AND (NOW() AT TIME ZONE 'Asia/Kolkata')::time >= $2::time`,
    [String(releaseAfterDays), releaseTimeIst]
  );

  if (due.length === 0) {
    console.log('[CRON tranche-3] No tranches due.');
    return { released: 0, total_amount: 0 };
  }

  let totalAmount = 0;
  let successCount = 0;
  let failCount = 0;

  for (const entry of due) {
    try {
      await escrowService.processTrancheReleaseStandalone(entry.id);

      const netAmount = parseFloat(entry.net_to_influencer);
      totalAmount += netAmount;
      successCount++;

      // Notify influencer (net_to_influencer already in rupees)
      await notificationService.send({
        userId: entry.influencer_user_id,
        type: 'tranche.released',
        title: 'Payment Released',
        body: `\u20B9${netAmount.toFixed(2)} credited. Campaign complete!`,
        data: { screen: 'earnings', campaign_id: entry.campaign_id },
        fcmToken: entry.inf_fcm_token,
        sendSms: true,
        phone: entry.inf_phone,
      });

      // Notify brand
      await notificationService.send({
        userId: entry.brand_user_id,
        type: 'tranche.released',
        title: 'Tranche 3 Released',
        body: `Tranche 3 released to ${entry.inf_name}`,
        data: { screen: 'campaign_detail', campaign_id: entry.campaign_id },
        fcmToken: entry.brand_fcm_token,
        sendSms: false,
      });

      // Check if ALL escrow_entries for this campaign_influencer are released → mark completed
      const { rows: ciEntries } = await db.query(
        `SELECT status FROM escrow_entries WHERE campaign_influencer_id = $1`,
        [entry.campaign_influencer_id]
      );
      const allReleased = ciEntries.every(e => e.status === 'released');
      if (allReleased) {
        await db.query(
          `UPDATE campaign_influencers SET status = 'completed' WHERE id = $1 AND status != 'completed'`,
          [entry.campaign_influencer_id]
        );

        // Check if ALL campaign_influencers for this campaign are completed → mark campaign completed
        const { rows: allCIs } = await db.query(
          `SELECT ci.status FROM campaign_influencers ci
           JOIN campaign_sets cs ON cs.id = ci.set_id
           WHERE cs.campaign_id = $1`,
          [entry.campaign_id]
        );
        const allCIsCompleted = allCIs.length > 0 && allCIs.every(ci => ci.status === 'completed');
        if (allCIsCompleted) {
          await db.query(
            `UPDATE campaigns SET status = 'completed', completed_at = NOW()
             WHERE id = $1 AND status != 'completed'`,
            [entry.campaign_id]
          );
          console.log(`[CRON tranche-3] Campaign ${entry.campaign_id} marked completed.`);
        }
      }
    } catch (err) {
      failCount++;
      console.error(`[CRON tranche-3] Failed to release entry ${entry.id}:`, err.message);
    }
  }

  if (failCount > 0) {
    console.warn(`[CRON tranche-3] ${failCount} of ${due.length} tranches failed to release.`);
  }
  console.log(`[CRON tranche-3] Released ${successCount} tranches totalling \u20B9${totalAmount.toFixed(2)}`);
  return { released: successCount, failed: failCount, total_due: due.length, total_amount: totalAmount };
}

module.exports = { run };
