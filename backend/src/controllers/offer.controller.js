'use strict';

/**
 * Offer + Negotiation controller
 * Block B: offer inbox, accept, decline
 * Block C: start negotiation (influencer only), respond, get thread
 */

const db = require('../config/db');
const notificationService = require('../services/notification.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the influencer row for the authenticated user, or throw 404.
 */
async function getInfluencerOrThrow(userId) {
  const { rows } = await db.query(
    `SELECT i.id, i.user_id FROM influencers i WHERE i.user_id = $1`,
    [userId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0];
}

/**
 * Fetch the brand row for the authenticated user, or throw 404.
 */
async function getBrandOrThrow(userId) {
  const { rows } = await db.query(
    `SELECT id, user_id FROM brands WHERE user_id = $1`,
    [userId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0];
}

/**
 * Fetch a campaign_influencer (offer) by ID.
 * Returns null if not found.
 */
async function getCampaignInfluencer(id) {
  const { rows } = await db.query(
    `SELECT ci.*,
            cs.campaign_id,
            cs.name AS set_name,
            cs.goal,
            c.brand_id
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     WHERE ci.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Valid decline reasons from spec
const VALID_DECLINE_REASONS = [
  'not_relevant',
  'fee_too_low',
  'schedule_conflict',
  'already_partnered',
  'other',
];

// Valid negotiation respond actions
const VALID_ACTIONS = ['counter', 'accept', 'walkaway'];

// ─────────────────────────────────────────────────────────────────────────────
// Block B — GET /influencers/me/offers
// ─────────────────────────────────────────────────────────────────────────────

const getMyOffers = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerOrThrow(req.user.sub);
  const { status } = req.query;

  const conditions = [`ci.influencer_id = $1`];
  const params = [influencer.id];

  if (status) {
    // Support comma-separated statuses: ?status=invited,negotiating
    const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      params.push(statuses[0]);
      conditions.push(`ci.status = $${params.length}`);
    } else if (statuses.length > 1) {
      const placeholders = statuses.map((s, i) => `$${params.length + i + 1}`);
      params.push(...statuses);
      conditions.push(`ci.status IN (${placeholders.join(', ')})`);
    }
  }

  const { rows } = await db.query(
    `SELECT ci.*,
            cs.name AS set_name,
            cs.goal,
            cs.budget AS set_budget,
            cs.per_influencer_budget,
            c.name AS campaign_name,
            b.business_name AS brand_name
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ci.created_at DESC`,
    params
  );

  return success(res, { offers: rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block B — POST /offers/:id/accept
// ─────────────────────────────────────────────────────────────────────────────

const accept = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerOrThrow(req.user.sub);
  const ci = await getCampaignInfluencer(req.params.id);

  if (!ci) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  if (ci.influencer_id !== influencer.id) {
    throw new AppError('FORBIDDEN', 'This offer does not belong to you', 403);
  }
  if (ci.status !== 'invited') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot accept offer in '${ci.status}' status. Must be in 'invited' status.`,
      422
    );
  }

  // Set agreed_fee from influencer_budget if not already set
  await db.query(
    `UPDATE campaign_influencers
     SET status = 'accepted',
         agreed_fee = COALESCE(agreed_fee, influencer_budget)
     WHERE id = $1`,
    [ci.id]
  );

  const { rows } = await db.query(
    `SELECT * FROM campaign_influencers WHERE id = $1`,
    [ci.id]
  );

  // Notify brand that influencer accepted the offer
  try {
    const { rows: brandNotifRows } = await db.query(
      `SELECT u.id AS user_id, u.fcm_token, c.name AS campaign_name,
              inf.instagram_handle
       FROM campaigns c
       JOIN brands b ON b.id = c.brand_id
       JOIN users u ON u.id = b.user_id
       JOIN influencers inf ON inf.id = $2
       WHERE c.id = $1`,
      [ci.campaign_id, ci.influencer_id]
    );
    if (brandNotifRows[0]) {
      const handle = brandNotifRows[0].instagram_handle || 'An influencer';
      await notificationService.send({
        userId:   brandNotifRows[0].user_id,
        type:     'offer.accepted',
        title:    'Offer Accepted!',
        body:     `@${handle} accepted your offer for ${brandNotifRows[0].campaign_name}`,
        data:     { screen: 'campaign_detail', campaign_id: ci.campaign_id },
        fcmToken: brandNotifRows[0].fcm_token,
        sendSms:  false,
      });
    }
  } catch (notifErr) {
    console.error('[NOTIFICATION] offer.accepted send failed:', notifErr.message);
  }

  // Auto-create contract (Phase 3). Non-fatal for the accept itself, but the
  // failure is now persisted on the CI (contract.service.autoCreate) and we
  // tell the client so the UI can show "contract pending — retry".
  let contractError = null;
  try {
    const contractService = require('../services/contract.service');
    await contractService.autoCreate(ci.id);
  } catch (contractErr) {
    console.error('[CONTRACT] Auto-create failed on accept:', contractErr.message);
    contractError = contractErr.message;
  }

  return success(res, {
    campaign_influencer: rows[0],
    contract_pending: !!contractError,
    contract_error:   contractError,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block B — POST /offers/:id/decline
// ─────────────────────────────────────────────────────────────────────────────

const decline = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerOrThrow(req.user.sub);
  const ci = await getCampaignInfluencer(req.params.id);

  if (!ci) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  if (ci.influencer_id !== influencer.id) {
    throw new AppError('FORBIDDEN', 'This offer does not belong to you', 403);
  }

  const { reason } = req.body;

  if (!reason) {
    throw new AppError('VALIDATION_ERROR', 'reason is required', 422, 'reason');
  }
  if (!VALID_DECLINE_REASONS.includes(reason)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `reason must be one of: ${VALID_DECLINE_REASONS.join(', ')}`,
      422,
      'reason'
    );
  }

  if (!['invited', 'negotiating'].includes(ci.status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot decline offer in '${ci.status}' status`,
      422
    );
  }

  await db.query(
    `UPDATE campaign_influencers SET status = 'declined', declined_reason = $2 WHERE id = $1`,
    [ci.id, reason]
  );

  const { rows } = await db.query(
    `SELECT * FROM campaign_influencers WHERE id = $1`,
    [ci.id]
  );

  // Notify brand that influencer declined
  const { rows: brandUserRows } = await db.query(
    `SELECT u.id AS user_id, u.fcm_token, c.name AS campaign_name
     FROM campaigns c
     JOIN brands b ON b.id = c.brand_id
     JOIN users u ON u.id = b.user_id
     WHERE c.id = $1`,
    [ci.campaign_id]
  );
  if (brandUserRows[0]) {
    await notificationService.send({
      userId: brandUserRows[0].user_id,
      type:   'offer.declined',
      title:  'Offer Declined',
      body:   `An influencer declined your offer for campaign "${brandUserRows[0].campaign_name}".`,
      data:   { screen: 'campaign_detail', campaign_id: ci.campaign_id },
      fcmToken: brandUserRows[0].fcm_token,
      sendSms:  false,
    }).catch(err => console.error('[NOTIFICATION] offer.declined send failed:', err.message));
  }

  return success(res, { campaign_influencer: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /offers/:id/negotiate
// Only influencer can initiate. Offer must be in 'invited' status.
// ─────────────────────────────────────────────────────────────────────────────

const negotiate = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerOrThrow(req.user.sub);
  const ci = await getCampaignInfluencer(req.params.id);

  if (!ci) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  if (ci.influencer_id !== influencer.id) {
    throw new AppError('FORBIDDEN', 'This offer does not belong to you', 403);
  }

  // Check for duplicate negotiation BEFORE status check — returns 409 if already exists
  const { rows: existingNeg } = await db.query(
    `SELECT id FROM negotiations WHERE campaign_influencer_id = $1`,
    [ci.id]
  );
  if (existingNeg[0]) {
    throw new AppError('CONFLICT', 'A negotiation already exists for this offer', 409);
  }

  if (ci.status !== 'invited') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Can only negotiate offers in 'invited' status. Current: '${ci.status}'`,
      422
    );
  }

  const { proposed_fee, proposed_deadline, note } = req.body;

  // Create negotiation + first turn atomically. SLA = 48h from now to next response.
  let negotiation, turn;
  await db.withTransaction(async (client) => {
    // Create negotiation thread (brand's turn to respond)
    const { rows: negRows } = await client.query(
      `INSERT INTO negotiations
         (campaign_influencer_id, initiated_by, status, current_turn, expires_at)
       VALUES ($1, $2, 'awaiting_brand', 'brand', now() + interval '48 hours')
       RETURNING *`,
      [ci.id, req.user.sub]
    );
    negotiation = negRows[0];

    // Record first turn (influencer's opening)
    const { rows: turnRows } = await client.query(
      `INSERT INTO negotiation_turns
         (negotiation_id, sent_by, proposed_fee, proposed_deadline, note)
       VALUES ($1, 'influencer', $2, $3, $4)
       RETURNING *`,
      [negotiation.id, proposed_fee || null, proposed_deadline || null, note || null]
    );
    turn = turnRows[0];

    // Move campaign_influencer to negotiating
    await client.query(
      `UPDATE campaign_influencers SET status = 'negotiating' WHERE id = $1`,
      [ci.id]
    );
  });

  // Notify brand that influencer started negotiation (their turn to respond)
  const { rows: brandNotifRows } = await db.query(
    `SELECT u.id AS user_id, u.fcm_token, c.name AS campaign_name
     FROM campaigns c
     JOIN brands b ON b.id = c.brand_id
     JOIN users u ON u.id = b.user_id
     WHERE c.id = $1`,
    [ci.campaign_id]
  );
  if (brandNotifRows[0]) {
    await notificationService.send({
      userId: brandNotifRows[0].user_id,
      type:   'negotiation.turn',
      title:  'Negotiation Round',
      body:   `An influencer has countered your offer on "${brandNotifRows[0].campaign_name}". Your turn to respond.`,
      data:   { screen: 'negotiation', negotiation_id: negotiation.id },
      fcmToken: brandNotifRows[0].fcm_token,
      sendSms:  false,
    }).catch(err => console.error('[NOTIFICATION] negotiation.turn send failed:', err.message));
  }

  return success(res, { negotiation, turn }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /negotiations/:id/respond
// Brand or influencer responds. WRONG_TURN enforced.
// ─────────────────────────────────────────────────────────────────────────────

const respond = asyncHandler(async (req, res) => {
  const { rows: negRows } = await db.query(
    `SELECT n.*,
            ci.influencer_id,
            ci.id AS ci_id,
            c.brand_id
     FROM negotiations n
     JOIN campaign_influencers ci ON ci.id = n.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     WHERE n.id = $1`,
    [req.params.id]
  );

  if (!negRows[0]) throw new AppError('NOT_FOUND', 'Negotiation not found', 404);
  const neg = negRows[0];

  // Only allow open negotiations
  if (neg.status === 'agreed' || neg.status === 'walked_away') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Negotiation is already closed (status: ${neg.status})`,
      422
    );
  }

  // Determine which party the requester is
  const userRole = req.user.role; // 'brand' or 'influencer'
  let userTurn;

  if (userRole === 'brand') {
    // Verify requester owns the campaign's brand
    const brand = await getBrandOrThrow(req.user.sub);
    if (brand.id !== neg.brand_id) {
      throw new AppError('FORBIDDEN', 'You do not own this campaign', 403);
    }
    userTurn = 'brand';
  } else if (userRole === 'influencer') {
    // Verify requester is the influencer on this offer
    const influencer = await getInfluencerOrThrow(req.user.sub);
    if (influencer.id !== neg.influencer_id) {
      throw new AppError('FORBIDDEN', 'This negotiation does not belong to you', 403);
    }
    userTurn = 'influencer';
  } else {
    throw new AppError('FORBIDDEN', 'Only brand or influencer can respond to negotiations', 403);
  }

  // Enforce turn
  if (neg.current_turn !== userTurn) {
    throw new AppError(
      'WRONG_TURN',
      `It is not your turn. Waiting for ${neg.current_turn} to respond.`,
      422
    );
  }

  const { action, proposed_fee, proposed_deadline, note } = req.body;

  if (!action || !VALID_ACTIONS.includes(action)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `action must be one of: ${VALID_ACTIONS.join(', ')}`,
      422,
      'action'
    );
  }

  let updatedNeg, updatedCi;

  await db.withTransaction(async (client) => {
    if (action === 'counter') {
      // Add turn record
      await client.query(
        `INSERT INTO negotiation_turns (negotiation_id, sent_by, proposed_fee, proposed_deadline, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [neg.id, userTurn, proposed_fee || null, proposed_deadline || null, note || null]
      );

      // Flip turn — SLA clock resets to 48h for the next responder.
      const nextTurn = userTurn === 'brand' ? 'influencer' : 'brand';
      const nextStatus = nextTurn === 'brand' ? 'awaiting_brand' : 'awaiting_influencer';

      const { rows } = await client.query(
        `UPDATE negotiations
         SET current_turn = $2,
             status       = $3,
             expires_at   = now() + interval '48 hours'
         WHERE id = $1 RETURNING *`,
        [neg.id, nextTurn, nextStatus]
      );
      updatedNeg = rows[0];

      const { rows: ciRows } = await client.query(
        `SELECT * FROM campaign_influencers WHERE id = $1`,
        [neg.ci_id]
      );
      updatedCi = ciRows[0];

    } else if (action === 'accept') {
      // Mark negotiation as agreed — clear SLA clock
      const { rows } = await client.query(
        `UPDATE negotiations
         SET status       = 'agreed',
             current_turn = NULL,
             expires_at   = NULL
         WHERE id = $1 RETURNING *`,
        [neg.id]
      );
      updatedNeg = rows[0];

      // Mark offer as accepted — use last proposed_fee as agreed_fee if available
      const lastProposedFee = (req.body.proposed_fee || updatedNeg.proposed_fee) || null;
      const { rows: ciRows } = await client.query(
        `UPDATE campaign_influencers
         SET status = 'accepted',
             agreed_fee = COALESCE($2, agreed_fee, influencer_budget)
         WHERE id = $1 RETURNING *`,
        [neg.ci_id, lastProposedFee]
      );
      updatedCi = ciRows[0];

    } else if (action === 'walkaway') {
      // Mark negotiation as walked_away — clear SLA clock
      const { rows } = await client.query(
        `UPDATE negotiations
         SET status       = 'walked_away',
             current_turn = NULL,
             expires_at   = NULL
         WHERE id = $1 RETURNING *`,
        [neg.id]
      );
      updatedNeg = rows[0];

      // Mark offer as declined
      const { rows: ciRows } = await client.query(
        `UPDATE campaign_influencers SET status = 'declined', declined_reason = 'other'
         WHERE id = $1 RETURNING *`,
        [neg.ci_id]
      );
      updatedCi = ciRows[0];
    }
  });

  // Auto-create contract when negotiation is agreed (Phase 3) — error tracked on CI
  let negContractError = null;
  if (action === 'accept' && updatedCi) {
    try {
      const contractService = require('../services/contract.service');
      await contractService.autoCreate(updatedCi.id);
    } catch (contractErr) {
      console.error('[CONTRACT] Auto-create failed on negotiate accept:', contractErr.message);
      negContractError = contractErr.message;
    }
  }

  // Notify the OTHER party when counter is sent
  if (action === 'counter' && updatedNeg) {
    const nextTurn = updatedNeg.current_turn; // 'brand' or 'influencer'
    let notifyUserId, notifyFcmToken, notifyName;

    if (nextTurn === 'brand') {
      const { rows: br } = await db.query(
        `SELECT u.id, u.fcm_token FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
        [neg.brand_id]
      );
      if (br[0]) { notifyUserId = br[0].id; notifyFcmToken = br[0].fcm_token; }
      notifyName = 'Brand';
    } else {
      const { rows: ir } = await db.query(
        `SELECT u.id, u.fcm_token FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
        [neg.influencer_id]
      );
      if (ir[0]) { notifyUserId = ir[0].id; notifyFcmToken = ir[0].fcm_token; }
      notifyName = 'Influencer';
    }

    if (notifyUserId) {
      await notificationService.send({
        userId: notifyUserId,
        type:   'negotiation.turn',
        title:  'Counter Offer Received',
        body:   `A counter offer has been made. Your turn to respond.`,
        data:   { screen: 'negotiation', negotiation_id: neg.id },
        fcmToken: notifyFcmToken,
        sendSms: false,
      }).catch(err => console.error('[NOTIFICATION] negotiation.turn counter failed:', err.message));
    }
  }

  return success(res, {
    negotiation: updatedNeg,
    campaign_influencer: updatedCi,
    contract_pending: !!negContractError,
    contract_error:   negContractError,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — GET /negotiations/:id
// Both brand and influencer can view their negotiation thread.
// ─────────────────────────────────────────────────────────────────────────────

const getNegotiation = asyncHandler(async (req, res) => {
  const { rows: negRows } = await db.query(
    `SELECT n.*,
            ci.influencer_id,
            c.brand_id
     FROM negotiations n
     JOIN campaign_influencers ci ON ci.id = n.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     WHERE n.id = $1`,
    [req.params.id]
  );

  if (!negRows[0]) throw new AppError('NOT_FOUND', 'Negotiation not found', 404);
  const neg = negRows[0];

  // Verify requester is a party to this negotiation
  const userRole = req.user.role;
  if (userRole === 'brand') {
    const brand = await getBrandOrThrow(req.user.sub);
    if (brand.id !== neg.brand_id) {
      throw new AppError('FORBIDDEN', 'You do not own this campaign', 403);
    }
  } else if (userRole === 'influencer') {
    const influencer = await getInfluencerOrThrow(req.user.sub);
    if (influencer.id !== neg.influencer_id) {
      throw new AppError('FORBIDDEN', 'This negotiation does not belong to you', 403);
    }
  } else {
    throw new AppError('FORBIDDEN', 'Access denied', 403);
  }

  // Fetch all turns
  const { rows: turns } = await db.query(
    `SELECT * FROM negotiation_turns WHERE negotiation_id = $1 ORDER BY created_at ASC`,
    [neg.id]
  );

  return success(res, { negotiation: neg, turns });
});

const getNegotiationByCampaignInfluencer = asyncHandler(async (req, res) => {
  const ciId = req.params.ciId;
  const { rows: negRows } = await db.query(
    `SELECT n.*,
            ci.influencer_id,
            c.brand_id
     FROM negotiations n
     JOIN campaign_influencers ci ON ci.id = n.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     WHERE n.campaign_influencer_id = $1
     ORDER BY n.created_at DESC
     LIMIT 1`,
    [ciId]
  );

  if (!negRows[0]) throw new AppError('NOT_FOUND', 'No negotiation found for this assignment', 404);
  const neg = negRows[0];

  const userRole = req.user.role;
  if (userRole === 'brand') {
    const brand = await getBrandOrThrow(req.user.sub);
    if (brand.id !== neg.brand_id) {
      throw new AppError('FORBIDDEN', 'You do not own this campaign', 403);
    }
  } else if (userRole === 'influencer') {
    const influencer = await getInfluencerOrThrow(req.user.sub);
    if (influencer.id !== neg.influencer_id) {
      throw new AppError('FORBIDDEN', 'This negotiation does not belong to you', 403);
    }
  } else {
    throw new AppError('FORBIDDEN', 'Access denied', 403);
  }

  const { rows: turns } = await db.query(
    `SELECT * FROM negotiation_turns WHERE negotiation_id = $1 ORDER BY created_at ASC`,
    [neg.id]
  );

  return success(res, { negotiation: neg, turns });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block D — POST /campaigns/:id/sets/:sid/publish-open
// Publish an open-group set; notify eligible approved influencers via push + in-app.
// ─────────────────────────────────────────────────────────────────────────────

const publishOpenGroup = asyncHandler(async (req, res) => {
  // Verify brand ownership
  const brand = await getBrandOrThrow(req.user.sub);

  // Verify campaign belongs to brand
  const { rows: campaignRows } = await db.query(
    `SELECT * FROM campaigns WHERE id = $1`,
    [req.params.id]
  );
  if (!campaignRows[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  if (campaignRows[0].brand_id !== brand.id) {
    throw new AppError('FORBIDDEN', 'You do not own this campaign', 403);
  }

  // Get the set
  const { rows: setRows } = await db.query(
    `SELECT * FROM campaign_sets WHERE id = $1 AND campaign_id = $2`,
    [req.params.sid, req.params.id]
  );
  if (!setRows[0]) throw new AppError('NOT_FOUND', 'Campaign set not found', 404);
  const set = setRows[0];

  // Validate set is open_group
  if (set.assignment_mode !== 'open_group') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Only sets with assignment_mode 'open_group' can be published via this endpoint. Current: '${set.assignment_mode}'`,
      422
    );
  }

  // Notify all approved influencers (push + in-app only — no SMS per spec Section 6.2)
  const { rows: influencers } = await db.query(
    `SELECT u.id, u.fcm_token FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE u.status = 'approved'`
  );

  // Send notifications in parallel (fire-and-forget — don't block response)
  const notifyAll = influencers.map(inf =>
    notificationService.send({
      userId: inf.id,
      type: 'offer.open_group',
      title: 'New Open Campaign Available',
      body: `A new open campaign is looking for influencers. Apply now!`,
      data: {
        screen: 'open_offers',
        set_id: set.id,
        campaign_id: req.params.id,
      },
      fcmToken: inf.fcm_token,
      sendSms: false, // open-group: push + in-app only, no SMS
    })
  );
  await Promise.all(notifyAll);

  return success(res, {
    set,
    notified_count: influencers.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /offers/:id — Influencer offer detail (full campaign + deliverable info)
// ─────────────────────────────────────────────────────────────────────────────

const getOfferDetail = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerOrThrow(req.user.sub);

  const { rows } = await db.query(
    `SELECT ci.*,
            cs.name          AS set_name,
            cs.goal,
            cs.budget        AS set_budget,
            cs.per_influencer_budget,
            cs.content_start_date,
            cs.content_end_date,
            c.name           AS campaign_name,
            c.brief          AS campaign_brief,
            c.total_budget,
            c.start_date     AS campaign_start_date,
            c.end_date       AS campaign_end_date,
            c.status         AS campaign_status,
            b.id             AS brand_id,
            b.business_name  AS brand_name,
            b.logo_url       AS brand_logo_url,
            b.category       AS brand_category,
            b.address_line   AS brand_city
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
     WHERE ci.id = $1 AND ci.influencer_id = $2`,
    [req.params.id, influencer.id]
  );

  if (!rows[0]) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  const offer = rows[0];

  // Fetch deliverables for this campaign_influencer
  const { rows: deliverables } = await db.query(
    `SELECT id, type, quantity, status, submission_deadline, revision_limit
     FROM deliverables
     WHERE campaign_influencer_id = $1
     ORDER BY type ASC`,
    [offer.id]
  );

  // Fetch negotiation thread if exists
  const { rows: negRows } = await db.query(
    `SELECT id, status, current_turn, created_at
     FROM negotiations
     WHERE campaign_influencer_id = $1`,
    [offer.id]
  );

  return success(res, {
    offer: {
      ...offer,
      deliverables,
      negotiation: negRows[0] || null,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getMyOffers,
  getOfferDetail,
  accept,
  decline,
  negotiate,
  respond,
  getNegotiation,
  getNegotiationByCampaignInfluencer,
  publishOpenGroup,
};
