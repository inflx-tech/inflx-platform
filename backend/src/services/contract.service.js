'use strict';

/**
 * contract.service.js
 * Phase 3 — Block A
 *
 * autoCreate — called after influencer accepts offer; inserts a contract row
 */

const db = require('../config/db');
// The three working styles an agreement can settle on.
const { MODES } = require('./productionMode.model');
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
async function autoCreate(campaignInfluencerId, opts = {}) {
  try {
    const result = await _autoCreateInner(campaignInfluencerId, opts);
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

async function _autoCreateInner(campaignInfluencerId, opts = {}) {
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
       inf.instagram_handle                  AS influencer_handle,
       -- Where she works, settled at the handshake. Written onto the contract here so the
       -- shoot does not have to guess it later — it used to, and guessed 'remote' on a
       -- collaboration whose agreement plainly said 'visit'.
       -- Contract: features/shoot-starts-where-the-agreement-left-it
       ag.terms_json->>'mode'                AS agreed_mode
     FROM campaign_influencers ci
     JOIN campaign_sets  cs  ON cs.id  = ci.set_id
     JOIN campaigns      c   ON c.id   = cs.campaign_id
     JOIN brands         b   ON b.id   = c.brand_id
     JOIN influencers    inf ON inf.id  = ci.influencer_id
     JOIN users          u_inf ON u_inf.id = inf.user_id
     LEFT JOIN collab_agreements ag ON ag.id = ci.agreement_id
     WHERE ci.id = $1`,
    [campaignInfluencerId]
  );

  if (!rows[0]) {
    // Item 7 (approval 4.3): "the invitation is not there" and "a contract is
    // already there" used to return the same null, so a silent failure looked
    // exactly like success. They are distinguishable now.
    console.error(`[CONTRACT] autoCreate: CI not found: ${campaignInfluencerId}`);
    return { contract: null, created: false, reason: 'invitation_not_found' };
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

  // 'draft' — the brand reviews and presses Approve & Send before she can sign.
  //
  // 'pending_influencer' — READY TO SIGN, used when a creator is briefed from an agreement she
  // has already accepted. Founder, 2026-08-28. Briefing her IS the approval: the brand chose
  // her, set what she may sell, set her offer and pressed Publish. Asking them to approve a
  // contract afterwards is a fourth confirmation of one decision, and it leaves her waiting on
  // a step she cannot see.
  //
  // Only ever used where the terms did NOT move from the agreement — see campaign.controller.
  const initialStatus = opts.ready ? 'pending_influencer' : 'draft';

  // Insert as 'draft' — brand has to review + Approve & Send before the
  // influencer can sign. ON CONFLICT handles re-runs gracefully.
  const { rows: contractRows } = await db.query(
    `INSERT INTO contracts
       (campaign_influencer_id, influencer_fee, revision_limit, posting_date,
        content_requirements, brand_name, influencer_name, campaign_name, status,
        production_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      initialStatus,
      // NULL when nothing was agreed — the brand still picks a mode at Approve & Send,
      // exactly as before. resolveProductionMode is deliberately NOT used here: this column
      // records what was AGREED, and storing an invented default would make a guess look
      // like a decision. The guess belongs at read time, where it can be labelled as one.
      MODES.includes(String(ci.agreed_mode || '').toLowerCase())
        ? String(ci.agreed_mode).toLowerCase()
        : null,
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

    return { contract: contractRows[0], created: true, reason: null };
  }

  // Already existed — ON CONFLICT skipped the insert. Not a failure.
  const { rows: existing } = await db.query(
    `SELECT * FROM contracts WHERE campaign_influencer_id = $1`, [campaignInfluencerId]
  );
  return { contract: existing[0] || null, created: false, reason: 'already_exists' };
}

module.exports = { autoCreate };
