'use strict';

/**
 * tranche-3-release — the final 50%, hourly at :00 (J1).
 * Contract: features/item12-content · approval §3.5, Q4, Q5, Q10 · checks 18, 19, 20, 33, 36
 *
 * Item 12 rebuilt this job rather than adding a second one, so there is ONE place that pays a
 * tranche 3:
 *
 *   · THE DUE IS STAMPED. A row carries `release_due_at`, written when the brand confirmed the
 *     content live (contentMoney.releaseSecond). A later change to final_payment_wait_days never
 *     moves it (finding 2). A row queued before item 12 with no stamp keeps the old rule —
 *     triggered_at + the number, after the release time — and production had none queued.
 *   · ONE TRANSACTION PER ROW, taken FOR UPDATE SKIP LOCKED (contentMoney.releaseFinal), with the
 *     collaboration's completion INSIDE it. Notifications go after commit and can never lose it.
 *   · A BRAND REPORT HOLDS IT (Q10): a row whose collaboration carries a brand's report is skipped.
 *   · No SMS. Push and the in-app bell, as items 5–11 do it.
 */

const db = require('../config/db');
const contentMoney = require('../services/contentMoney.service');
const notificationService = require('../services/notification.service');
const taxService = require('../services/tax.service');
const events = require('../services/collabEvents.service');
const { NOTIFY12 } = require('../services/contentCopy');

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

async function run({ now = new Date() } = {}) {
  const releaseAfterDays = await taxService.getTrancheReleaseAfterDays();
  const releaseTimeIst = await taxService.getTrancheReleaseTimeIst();

  const { rows: due } = await db.query(
    `SELECT ee.id
       FROM escrow_entries ee
      WHERE ee.trigger_event = 'day_30_post_live' AND ee.status = 'queued'
        AND (
          (ee.release_due_at IS NOT NULL AND ee.release_due_at <= $3)
          OR (ee.release_due_at IS NULL
              AND ee.triggered_at <= $3::timestamptz - ($1 || ' days')::interval
              AND ($3::timestamptz AT TIME ZONE 'Asia/Kolkata')::time >= $2::time)
        )
      ORDER BY COALESCE(ee.release_due_at, ee.triggered_at)`,
    [String(releaseAfterDays), releaseTimeIst, now]
  );
  if (due.length === 0) return { released: 0, skipped: 0, failed: 0, total_due: 0, total_amount: 0 };

  let released = 0; let skipped = 0; let failed = 0; let total = 0;
  for (const { id } of due) {
    let out = null;
    try {
      out = await db.withTransaction((client) => contentMoney.releaseFinal(client, id, { now }));
    } catch (err) {
      failed += 1;
      console.error(`[CRON tranche-3] release failed for ${id}:`, err.message);
      continue;
    }
    if (!out) continue;                                   // taken by another runner, or already paid
    if (out.skipped) { skipped += 1; console.log(`[CRON tranche-3] ${out.ciId} held: ${out.skipped}`); continue; }
    released += 1; total += out.amount;

    // After commit: the telling. Never able to undo or skip the completion above.
    try {
      const { rows: [p] } = await db.query(
        `SELECT u.id AS creator_user_id, bu.id AS brand_user_id, COALESCE(i.full_name, u.name) AS creator_name,
                cs.id AS set_id
           FROM campaign_influencers ci
           JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
           JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id
           JOIN brands b ON b.id = c.brand_id JOIN users bu ON bu.id = b.user_id
          WHERE ci.id = $1`, [out.ciId]);
      if (p) {
        const creatorData = { screen: out.hasContent ? 'my_content' : 'earnings', campaign_influencer_id: out.ciId };
        const brandData = { screen: out.hasContent ? 'brand_content' : 'campaign_detail', campaign_influencer_id: out.ciId, campaign_id: out.campaignId, set_id: p.set_id };
        await notificationService.send({ userId: p.creator_user_id, type: NOTIFY12.FINAL_PAID.type, title: NOTIFY12.FINAL_PAID.title,
          body: `${rupees(out.amount)} is in your wallet.${out.completed ? ' The collaboration is complete.' : ''}`, data: creatorData, sendSms: false })
          .catch((e) => console.error('[NOTIFICATION] final paid failed:', e.message));
        if (out.completed) {
          await notificationService.send({ userId: p.brand_user_id, type: NOTIFY12.COMPLETED.type, title: NOTIFY12.COMPLETED.title,
            body: `${p.creator_name} has been paid in full. The collaboration is complete.`, data: brandData, sendSms: false })
            .catch((e) => console.error('[NOTIFICATION] completed failed:', e.message));
          await events.record({ campaignInfluencerId: out.ciId, step: events.STEP.COMPLETE, actorRole: 'system', action: 'completed', meta: { final_paid: out.amount } });
        }
      }
    } catch (e) {
      console.error(`[CRON tranche-3] telling failed for ${out.ciId} (money and completion already committed):`, e.message);
    }
  }
  console.log(`[CRON tranche-3] released ${released}, held ${skipped}, failed ${failed}, ${rupees(total)}`);
  return { released, skipped, failed, total_due: due.length, total_amount: total };
}

module.exports = { run };
