'use strict';

const db = require('../config/db');

async function run() {
  console.log('[CRON campaign-status] Running...');

  const { rows: campaigns } = await db.query(
    `SELECT c.id, c.name
     FROM campaigns c
     WHERE c.end_date < CURRENT_DATE
       AND c.status IN ('live', 'active', 'published')`
  );

  if (campaigns.length === 0) {
    console.log('[CRON campaign-status] No campaigns to check.');
    return { checked: 0, completed: 0 };
  }

  let completed = 0;

  for (const campaign of campaigns) {
    // Check if all campaign_influencers have status=completed
    const { rows: cis } = await db.query(
      `SELECT ci.status FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       WHERE cs.campaign_id = $1`,
      [campaign.id]
    );

    if (cis.length === 0) {
      // No influencers assigned — mark completed
      await db.query(
        `UPDATE campaigns SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [campaign.id]
      );
      completed++;
      continue;
    }

    const allCompleted = cis.every(ci => ci.status === 'completed');
    if (!allCompleted) {
      // Check if all escrow_entries are also released
      const { rows: escrowRows } = await db.query(
        `SELECT ee.status FROM escrow_entries ee
         JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
         JOIN campaign_sets cs ON cs.id = ci.set_id
         WHERE cs.campaign_id = $1`,
        [campaign.id]
      );
      const allEscrowReleased = escrowRows.length === 0 || escrowRows.every(e => e.status === 'released');
      if (!allEscrowReleased) {
        console.log(`[CRON campaign-status] Campaign ${campaign.id} (${campaign.name}) has pending tranches — skipping auto-complete`);
        continue;
      }
    }

    if (allCompleted) {
      await db.query(
        `UPDATE campaigns SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [campaign.id]
      );
      completed++;
    }
  }

  console.log(`[CRON campaign-status] Checked ${campaigns.length} campaigns, completed ${completed}`);
  return { checked: campaigns.length, completed };
}

module.exports = { run };
