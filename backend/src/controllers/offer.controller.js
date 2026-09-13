'use strict';

/**
 * Offer + Negotiation controller
 * Block B: offer inbox, accept, decline
 * Block C: start negotiation (influencer only), respond, get thread
 */

const db = require('../config/db');
const notificationService = require('../services/notification.service');
const paymentConfigSvc    = require('../services/paymentConfig.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
// Item 5 — accept and decline are shared with the new invitation endpoints.
const invitationAnswer = require('../services/invitationAnswer.service');

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
            cs.influencer_mode,
            cs.max_cap,
            c.brand_id,
            c.allow_negotiation
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     WHERE ci.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Decline reasons: item 5's five (invitationCopy.DECLINE_REASONS) plus the legacy
// 'already_partnered', which this legacy door still accepts. Kept for readers of this file.
const VALID_DECLINE_REASONS = [...invitationAnswer.REASON_CODES, ...invitationAnswer.LEGACY_REASON_CODES];

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

  // Item 5 (APPROVAL.md Q7): the set's and campaign's budgets never reach a creator. Also gone
  // from the row: the brand's picker group and who sent it (privacy, prompt D14).
  const { rows } = await db.query(
    `SELECT ci.*,
            NULL::uuid AS source_group_id, NULL::uuid AS invited_by,
            cs.name AS set_name,
            cs.goal,
            cs.formats_json,
            cs.influencer_mode,
            cs.max_cap,
            c.name AS campaign_name,
            c.allow_negotiation,
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

  // Item 5 — the answer itself lives in invitationAnswer.service (shared with
  // /influencers/me/invitations/:id/accept): handpick → accepted + draft contract, open group →
  // applied; answered_at written; refused after the set's cutoff and on a second answer.
  const row = await invitationAnswer.loadForCreator(ci.id, influencer.id);
  const { ci: updated, contractError } = await invitationAnswer.accept(row);

  return success(res, {
    campaign_influencer: updated,
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

  // Item 5 — the five reasons on the mockup (the legacy code 'already_partnered' stays readable
  // and, on this legacy door, still accepted), the note capped at 200, an unsigned contract
  // deleted, answered_at written, and the brand told the reason AND the note (founder Q3).
  // Shared with /influencers/me/invitations/:id/decline through invitationAnswer.service.
  const row = await invitationAnswer.loadForCreator(ci.id, influencer.id);
  const { ci: updated } = await invitationAnswer.decline(row, { reason: req.body?.reason, note: req.body?.note, legacyCodes: true });

  return success(res, { campaign_influencer: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
// stage-a — the deferred pool. Founder, 2026-09-02: "we need to make in single
// button... she [picks] date and mode of work... reaches brand... brand wants he
// create another set for those deferred or reservations candidates."
//
// NOT a negotiation. She is not proposing a number to a person who replies; she is
// saying the set's fixed day or shoot does not work for her, with what would. The
// brand acts on it later, in bulk, from the campaign builder (SB-24) — there is no
// back-and-forth here to thread. Migration 167.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /offers/:id/defer
 * Take herself out of the set, with what she'd actually prefer.
 */
const defer = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerOrThrow(req.user.sub);
  const ci = await getCampaignInfluencer(req.params.id);

  if (!ci) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  if (ci.influencer_id !== influencer.id) {
    throw new AppError('FORBIDDEN', 'This offer does not belong to you', 403);
  }

  // Same stage as decline: before she has settled in. Once accepted, the fixed
  // day/mode were part of what she just agreed to — raising a reservation on them
  // then is a different conversation, not this button.
  if (!['invited', 'negotiating'].includes(ci.status)) {
    throw new AppError('VALIDATION_ERROR', `Cannot raise a reservation on an offer in '${ci.status}' status`, 422);
  }

  const { go_live_date, shoot_mode, note } = req.body;

  if (!go_live_date && !shoot_mode) {
    throw new AppError('VALIDATION_ERROR', 'Say what you would prefer instead — a day, a shoot mode, or both.', 422, 'go_live_date');
  }

  // Same picker rule the brand's own set-basics step is held to — she cannot
  // propose a day the server would refuse a brand for building a set around either.
  const setShape = require('../services/setShape.model');
  if (go_live_date) {
    const shape = setShape.validateSetShape({ go_live_date }, { offeredOnly: false });
    if (!shape.ok) throw new AppError('VALIDATION_ERROR', shape.error, 422, 'go_live_date');
  }
  if (shoot_mode && !setShape.SHOOT_MODES.includes(shoot_mode)) {
    throw new AppError('VALIDATION_ERROR', `shoot_mode must be one of: ${setShape.SHOOT_MODES.join(', ')}`, 422, 'shoot_mode');
  }

  const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 1000) : null;

  const { rows } = await db.query(
    `UPDATE campaign_influencers
        SET status = 'deferred',
            deferred_at = now(),
            deferred_go_live_date = $2,
            deferred_shoot_mode = $3,
            deferred_note = $4
      WHERE id = $1
      RETURNING *`,
    [ci.id, go_live_date || null, shoot_mode || null, trimmedNote]
  );

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
      type:   'offer.deferred',
      title:  'A creator has a reservation',
      body:   `A creator in "${brandUserRows[0].campaign_name}" can't make the set's day or shoot — she's told you what would work.`,
      data:   { screen: 'campaign_builder', campaign_id: ci.campaign_id },
      fcmToken: brandUserRows[0].fcm_token,
      sendSms:  false,
    }).catch(err => console.error('[NOTIFICATION] offer.deferred send failed:', err.message));
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

  // collab-part2 W19 — negotiate once, then one click. A collaboration briefed from a
  // handshake agreement carries agreement_id, which means money, time and the rest were
  // already negotiated and settled BEFORE the campaign existed. Re-opening negotiation
  // here would mean the handshake bought nothing. Accept (which generates the contract,
  // as it always has) and Decline both remain — nobody is trapped, but settled is
  // settled. A cold invite (agreement_id NULL) keeps full negotiation below.
  if (ci.agreement_id) {
    throw new AppError(
      'FORBIDDEN',
      'You already agreed these terms with the brand — accept to generate your contract, or decline.',
      403
    );
  }

  // Brand can disable negotiation per-campaign — fixed terms, take-it-or-leave-it.
  if (ci.allow_negotiation === false) {
    throw new AppError(
      'FORBIDDEN',
      'This brand has set fixed terms — please Accept or Decline.',
      403
    );
  }

  // Open-group flow has no negotiation step. Influencer either applies and
  // the brand picks them, or they reject. Negotiation would muddle the
  // brand's selection process.
  if (ci.influencer_mode === 'open_group') {
    throw new AppError(
      'FORBIDDEN',
      'This is an open call. Influencers apply or pass — there is no negotiation step.',
      403
    );
  }

  const { proposed_fee, proposed_commission_pct, proposed_deadline, note } = req.body;

  // Validate at least one numeric proposal was provided
  if ((proposed_fee == null || proposed_fee === '') &&
      (proposed_commission_pct == null || proposed_commission_pct === '')) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Provide either proposed_fee or proposed_commission_pct',
      422
    );
  }

  // Gate commission negotiation behind admin flag
  if (proposed_commission_pct != null && proposed_commission_pct !== '') {
    const cfg = await paymentConfigSvc.getConfig();
    if (!cfg.allowCommissionNegotiation) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Commission negotiation is currently disabled by the platform',
        422,
        'proposed_commission_pct'
      );
    }
  }

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
         (negotiation_id, sent_by, proposed_fee, proposed_commission_pct, proposed_deadline, note)
       VALUES ($1, 'influencer', $2, $3, $4, $5)
       RETURNING *`,
      [
        negotiation.id,
        proposed_fee || null,
        proposed_commission_pct != null && proposed_commission_pct !== '' ? proposed_commission_pct : null,
        proposed_deadline || null,
        note || null,
      ]
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
            cs.goal,
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

  const { action, proposed_fee, proposed_commission_pct, proposed_deadline, note } = req.body;

  if (!action || !VALID_ACTIONS.includes(action)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `action must be one of: ${VALID_ACTIONS.join(', ')}`,
      422,
      'action'
    );
  }

  // Gate commission counters behind admin flag
  if (proposed_commission_pct != null && proposed_commission_pct !== '') {
    const cfgGate = await paymentConfigSvc.getConfig();
    if (!cfgGate.allowCommissionNegotiation) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Commission negotiation is currently disabled by the platform',
        422,
        'proposed_commission_pct'
      );
    }
  }

  let updatedNeg, updatedCi;

  await db.withTransaction(async (client) => {
    if (action === 'counter') {
      // Add turn record (fee, commission, or both)
      await client.query(
        `INSERT INTO negotiation_turns
           (negotiation_id, sent_by, proposed_fee, proposed_commission_pct, proposed_deadline, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          neg.id,
          userTurn,
          proposed_fee || null,
          proposed_commission_pct != null && proposed_commission_pct !== '' ? proposed_commission_pct : null,
          proposed_deadline || null,
          note || null,
        ]
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

      // Pick the LAST proposed values from the thread (the values the
      // accepting party is agreeing to). Fall back to whatever was passed
      // in this body for back-compat.
      const { rows: lastTurnRows } = await client.query(
        `SELECT proposed_fee, proposed_commission_pct
         FROM   negotiation_turns
         WHERE  negotiation_id = $1
         ORDER  BY created_at DESC
         LIMIT  1`,
        [neg.id]
      );
      const lastTurn = lastTurnRows[0] || {};
      const lastProposedFee        = req.body.proposed_fee            ?? lastTurn.proposed_fee            ?? null;
      const lastProposedCommission = req.body.proposed_commission_pct ?? lastTurn.proposed_commission_pct ?? null;

      // Persist whichever fields were negotiated. COALESCE keeps existing
      // values for fields that weren't part of this negotiation.
      // Every goal flows through the full contract state machine. Conversion
      // contracts skip tranches inside brandSign via the effectiveFee gate.
      const { rows: ciRows } = await client.query(
        `UPDATE campaign_influencers
         SET status         = 'accepted',
             agreed_fee     = COALESCE($2, agreed_fee, influencer_budget),
             commission_pct = COALESCE($3, commission_pct)
         WHERE id = $1 RETURNING *`,
        [neg.ci_id, lastProposedFee, lastProposedCommission]
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

  // Auto-create contract when negotiation is agreed — runs for every goal.
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
            ci.agreed_fee         AS ci_agreed_fee,
            ci.influencer_budget  AS ci_influencer_budget,
            ci.commission_pct     AS ci_commission_pct,
            cs.goal               AS goal,
            c.brand_id,
            c.name                AS campaign_name,
            b.business_name       AS brand_name
     FROM negotiations n
     JOIN campaign_influencers ci ON ci.id = n.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
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

  // Derive original/current proposals so the UI doesn't have to recompute.
  //
  // "Original" = the brand's INITIAL offer (before any negotiation began).
  // That's the per-influencer budget the brand set when inviting, which
  // lives on campaign_influencers.influencer_budget (or agreed_fee if it
  // was already set). The first turn in negotiation_turns is the influencer's
  // OPENING COUNTER — NOT the brand's original — so we must not use it
  // for "original".
  //
  // "Current" = whatever the most recent turn proposed. If no turns yet,
  // fall back to the brand's original.
  const firstTurn = turns[0] || {};
  const lastTurn  = turns[turns.length - 1] || {};
  const enriched = {
    ...neg,
    original_fee:            neg.ci_influencer_budget || neg.ci_agreed_fee || firstTurn.proposed_fee || null,
    original_commission_pct: neg.ci_commission_pct || firstTurn.proposed_commission_pct || null,
    current_fee:             lastTurn.proposed_fee || firstTurn.proposed_fee || neg.ci_agreed_fee || neg.ci_influencer_budget || null,
    current_commission_pct:  lastTurn.proposed_commission_pct || firstTurn.proposed_commission_pct || neg.ci_commission_pct || null,
  };

  return success(res, { negotiation: enriched, turns });
});

const getNegotiationByCampaignInfluencer = asyncHandler(async (req, res) => {
  const ciId = req.params.ciId;
  const { rows: negRows } = await db.query(
    `SELECT n.*,
            ci.influencer_id,
            ci.agreed_fee         AS ci_agreed_fee,
            ci.influencer_budget  AS ci_influencer_budget,
            ci.commission_pct     AS ci_commission_pct,
            cs.goal               AS goal,
            c.brand_id,
            c.name                AS campaign_name,
            b.business_name       AS brand_name
     FROM negotiations n
     JOIN campaign_influencers ci ON ci.id = n.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
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

  // See getNegotiation above for the full reasoning. Same logic here.
  // Original = brand's initial budget; Latest = most recent counter from either party.
  const firstTurn = turns[0] || {};
  const lastTurn  = turns[turns.length - 1] || {};
  const enriched = {
    ...neg,
    original_fee:            neg.ci_influencer_budget || neg.ci_agreed_fee || firstTurn.proposed_fee || null,
    original_commission_pct: neg.ci_commission_pct || firstTurn.proposed_commission_pct || null,
    current_fee:             lastTurn.proposed_fee || firstTurn.proposed_fee || neg.ci_agreed_fee || neg.ci_influencer_budget || null,
    current_commission_pct:  lastTurn.proposed_commission_pct || firstTurn.proposed_commission_pct || neg.ci_commission_pct || null,
  };

  return success(res, { negotiation: enriched, turns });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block D — POST /campaigns/:id/sets/:sid/publish-open
// Publish an open-group set; notify eligible approved influencers via push + in-app.
// ─────────────────────────────────────────────────────────────────────────────

const publishOpenGroup = asyncHandler(async (req, res) => {
  // Verify brand ownership
  const brand = await getBrandOrThrow(req.user.sub);

  // Phase A12.4 — bulk_outreach feature gate. Publishing an open-group set
  // materializes campaign_influencer rows for every matching influencer in
  // one shot — the bulk-outreach action. Throws 422 FEATURE_NOT_AVAILABLE
  // with upgrade_to payload if brand's plan doesn't include the feature.
  // Fail-open if feature not yet enforced (entitlementsService default).
  const entitlementsService = require('../services/entitlements.service');
  await entitlementsService.requireFeature(db, brand.id, 'bulk_outreach', {
    label: 'Bulk influencer outreach',
  });

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

  // Validate set is open_group. campaign_sets.influencer_mode is the
  // canonical mode column (createSet writes it; all open-group logic
  // reads it — campaign.controller.js:66/1300/1435). The legacy
  // assignment_mode ENUM is never written by the API (always NULL).
  if (set.influencer_mode !== 'open_group') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Only sets with influencer_mode 'open_group' can be published via this endpoint. Current: '${set.influencer_mode}'`,
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

  // Item 5 (APPROVAL.md Q7): the campaign description, the budgets and the coupon prefix are
  // the brand's business, never the creator's (rules §7A "Creators never see…"). Stripped here
  // and never selected by the new /influencers/me/invitations endpoints.
  const { rows } = await db.query(
    `SELECT ci.*,
            NULL::uuid AS source_group_id, NULL::uuid AS invited_by,
            cs.name           AS set_name,
            cs.goal,
            cs.formats_json,
            cs.influencer_mode,
            cs.max_cap,
            cs.content_start_date,
            cs.content_end_date,
            c.allow_negotiation,
            c.name            AS campaign_name,
            c.start_date      AS campaign_start_date,
            c.end_date        AS campaign_end_date,
            c.status          AS campaign_status,
            b.id              AS brand_id,
            b.business_name   AS brand_name,
            b.logo_url        AS brand_logo_url,
            b.category        AS brand_category,
            b.address_line    AS brand_city
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

  // Read platform-level toggle so the mobile screen knows whether to enable
  // the commission counter input on the negotiation form.
  const cfg = await paymentConfigSvc.getConfig();

  return success(res, {
    offer: {
      ...offer,
      deliverables,
      negotiation: negRows[0] || null,
      allow_commission_negotiation: cfg.allowCommissionNegotiation,
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
  defer,
  negotiate,
  respond,
  getNegotiation,
  getNegotiationByCampaignInfluencer,
  publishOpenGroup,
};
