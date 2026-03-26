'use strict';

/**
 * contract.service.js
 * Phase 3 — Block A
 *
 * autoCreate — called after influencer accepts offer; inserts a contract row
 */

const db = require('../config/db');

/**
 * Auto-create a contract for an accepted campaign_influencer.
 * Idempotent: skips creation if contract already exists (ON CONFLICT DO NOTHING).
 *
 * @param {string} campaignInfluencerId
 * @returns {object|null} — created contract row, or null if already existed
 */
async function autoCreate(campaignInfluencerId) {
  // Fetch CI with all data needed for the contract
  const { rows } = await db.query(
    `SELECT
       ci.id,
       ci.agreed_fee,
       ci.posting_date,
       ci.influencer_id,
       cs.campaign_id,
       c.name                AS campaign_name,
       c.brief               AS content_requirements,
       c.brand_id,
       b.business_name       AS brand_name,
       b.platform_fee_pct,
       u_inf.phone           AS influencer_phone,
       inf.instagram_handle  AS influencer_handle
     FROM campaign_influencers ci
     JOIN campaign_sets  cs  ON cs.id  = ci.set_id
     JOIN campaigns      c   ON c.id   = cs.campaign_id
     JOIN brands         b   ON b.id   = c.brand_id
     JOIN influencers    inf ON inf.id  = ci.influencer_id
     JOIN users          u_inf ON u_inf.id = inf.user_id
     WHERE ci.id = $1`,
    [campaignInfluencerId]
  );

  if (!rows[0]) {
    console.error(`[CONTRACT] autoCreate: CI not found: ${campaignInfluencerId}`);
    return null;
  }

  const ci = rows[0];

  // Build influencer display name from phone (formatted) or handle
  const influencerName = ci.influencer_handle || ci.influencer_phone || 'Influencer';

  // Insert — ON CONFLICT handles re-runs gracefully
  const { rows: contractRows } = await db.query(
    `INSERT INTO contracts
       (campaign_influencer_id, influencer_fee, revision_limit, posting_date,
        content_requirements, brand_name, influencer_name, campaign_name, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_influencer')
     ON CONFLICT (campaign_influencer_id) DO NOTHING
     RETURNING *`,
    [
      campaignInfluencerId,
      ci.agreed_fee,
      2,
      ci.posting_date || null,
      ci.content_requirements || null,
      ci.brand_name,
      influencerName,
      ci.campaign_name,
    ]
  );

  if (contractRows[0]) {
    console.log(`[CONTRACT] Created contract ${contractRows[0].id} for CI ${campaignInfluencerId}`);
    return contractRows[0];
  }

  // Already existed (ON CONFLICT skipped insert)
  return null;
}

module.exports = { autoCreate };
