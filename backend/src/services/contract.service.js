'use strict';

/**
 * contract.service.js
 * Phase 3 — Block A
 *
 * autoCreate — called after influencer accepts offer; inserts a contract row
 */

const db = require('../config/db');
const notificationService = require('./notification.service');

/**
 * Auto-create a contract for an accepted campaign_influencer.
 * Idempotent: skips creation if contract already exists (ON CONFLICT DO NOTHING).
 *
 * Records its own success/failure on campaign_influencers so callers and
 * operators can see whether a contract actually exists for an accepted offer.
 *
 * @param {string} campaignInfluencerId
 * @returns {object|null} — created contract row, or null if already existed
 */
async function autoCreate(campaignInfluencerId) {
  try {
    const result = await _autoCreateInner(campaignInfluencerId);
    // Record success — clear any prior error
    await db.query(
      `UPDATE campaign_influencers
       SET contract_create_error = NULL,
           contract_create_attempt_at = now()
       WHERE id = $1`,
      [campaignInfluencerId]
    ).catch(() => {}); // ignore if columns not yet migrated
    return result;
  } catch (err) {
    console.error(`[CONTRACT] autoCreate FAILED for CI ${campaignInfluencerId}:`, err.message);
    // Persist the error on the CI row so retry UI can surface it
    await db.query(
      `UPDATE campaign_influencers
       SET contract_create_error = $2,
           contract_create_attempt_at = now()
       WHERE id = $1`,
      [campaignInfluencerId, err.message]
    ).catch(() => {});
    throw err;
  }
}

async function _autoCreateInner(campaignInfluencerId) {
  // Fetch CI with all data needed for the contract
  // Brief can live at either the set level (campaign_sets.brief) or the
  // campaign level (campaigns.brief). Coalesce so content_requirements is
  // populated as long as at least one of them is set. The PDF generator
  // also re-falls back at render time for contracts that were already
  // created when only one of the two was populated.
  const { rows } = await db.query(
    `SELECT
       ci.id,
       ci.agreed_fee,
       ci.influencer_budget,
       ci.posting_date,
       ci.influencer_id,
       cs.campaign_id,
       cs.per_influencer_budget,
       cs.set_budget,
       cs.goal,
       c.name                                AS campaign_name,
       COALESCE(NULLIF(cs.brief, ''), NULLIF(c.brief, '')) AS content_requirements,
       c.brand_id,
       b.business_name                       AS brand_name,
       b.platform_fee_pct,
       u_inf.phone                           AS influencer_phone,
       inf.instagram_handle                  AS influencer_handle
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

  // Conversion contracts are created just like engagement / hybrid. They
  // capture the agreed commission %, offer_type, coupon, custom clauses and
  // content requirements. What they DON'T get is any upfront fee or tranche
  // schedule — that's gated separately in brandSign (`if (effectiveFee > 0)`).
  // Fallback chain: agreed_fee → influencer_budget → per_influencer_budget → 0
  const effectiveFee = ci.agreed_fee || ci.influencer_budget || ci.per_influencer_budget || 0;

  // Build influencer display name from phone (formatted) or handle
  const influencerName = ci.influencer_handle || ci.influencer_phone || 'Influencer';

  // Insert as 'draft' — brand has to review + Approve & Send before the
  // influencer can sign. ON CONFLICT handles re-runs gracefully.
  const { rows: contractRows } = await db.query(
    `INSERT INTO contracts
       (campaign_influencer_id, influencer_fee, revision_limit, posting_date,
        content_requirements, brand_name, influencer_name, campaign_name, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
     ON CONFLICT (campaign_influencer_id) DO NOTHING
     RETURNING *`,
    [
      campaignInfluencerId,
      effectiveFee,
      2,
      ci.posting_date || null,
      ci.content_requirements || null,
      ci.brand_name,
      influencerName,
      ci.campaign_name,
    ]
  );

  if (contractRows[0]) {
    console.log(`[CONTRACT] Created DRAFT contract ${contractRows[0].id} for CI ${campaignInfluencerId}`);

    // Notify the BRAND (not the influencer) that a contract draft is ready
    // for their review. The influencer is notified later when the brand
    // taps "Approve & Send" (see contract.controller.approveContract).
    try {
      const { rows: brandUserRows } = await db.query(
        `SELECT u.id AS user_id, u.fcm_token
         FROM   campaign_influencers ci2
         JOIN   campaign_sets cs ON cs.id = ci2.set_id
         JOIN   campaigns c ON c.id = cs.campaign_id
         JOIN   brands b ON b.id = c.brand_id
         JOIN   users u ON u.id = b.user_id
         WHERE  ci2.id = $1`,
        [campaignInfluencerId]
      );
      if (brandUserRows[0]) {
        await notificationService.send({
          userId:   brandUserRows[0].user_id,
          type:     'contract.draft_ready',
          title:    'Contract Draft Ready for Review',
          body:     `An influencer accepted your offer for "${ci.campaign_name}". Review the contract draft and send it to them for signing.`,
          data:     { screen: 'contract_review', campaign_influencer_id: campaignInfluencerId },
          fcmToken: brandUserRows[0].fcm_token,
          sendSms:  false,
        });
      }
    } catch (notifErr) {
      console.error('[NOTIFICATION] contract.draft_ready send failed:', notifErr.message);
    }

    return contractRows[0];
  }

  // Already existed (ON CONFLICT skipped insert)
  return null;
}

module.exports = { autoCreate };
