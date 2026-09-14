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
// Item 6 — counter / accept / decline / move request live in one service; these routes wrap it.
const negotiation = require('../services/negotiation.service');

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
  // Item 6 — the legacy door to the move request. It used to end the invitation on the spot
  // (status 'deferred' the moment she asked); now it only records the request and the brand
  // answers (agree / keep / decline). One service, two doors (APPROVAL §3.1, §4.8).
  const influencer = await getInfluencerOrThrow(req.user.sub);
  const ctx = await negotiation.loadContext(req.params.id, { influencerId: influencer.id });
  if (!ctx) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  const row = await negotiation.moveRequest({ ctx, goLiveDate: req.body?.go_live_date, shootMode: req.body?.shoot_mode, note: req.body?.note });
  return success(res, { campaign_influencer: row });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /offers/:id/negotiate
// Only influencer can initiate. Offer must be in 'invited' status.
// ─────────────────────────────────────────────────────────────────────────────

const negotiate = asyncHandler(async (req, res) => {
  // Item 6 — the legacy door to a creator's first counter: the body's proposed_fee /
  // proposed_commission_pct are merged over the invitation's terms into a full snapshot and
  // held to the same rules as the new endpoint (rounds, cutoff, switch, validator, no-change).
  // No 48-hour clock; the platform commission gate is retired (APPROVAL Q5).
  const influencer = await getInfluencerOrThrow(req.user.sub);
  const ctx = await negotiation.loadContext(req.params.id, { influencerId: influencer.id });
  if (!ctx) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  if (ctx.neg_id) throw new AppError('CONFLICT', 'A negotiation already exists for this offer', 409);
  const negId = await negotiation.counter({ ctx, by: 'influencer', terms: req.body || {}, note: req.body?.note, actorUserId: req.user.sub, legacy: true });
  const { rows: negRows } = await db.query(`SELECT * FROM negotiations WHERE id = $1`, [negId]);
  const { rows: turnRows } = await db.query(`SELECT * FROM negotiation_turns WHERE negotiation_id = $1 ORDER BY created_at DESC LIMIT 1`, [negId]);
  return success(res, { negotiation: negRows[0], turn: turnRows[0] }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /negotiations/:id/respond
// Brand or influencer responds. WRONG_TURN enforced.
// ─────────────────────────────────────────────────────────────────────────────

const respond = asyncHandler(async (req, res) => {
  // Item 6 — the legacy door for both sides: counter / accept / walkaway → the one service.
  // A brand walk-away is a decline with an optional note; a creator walk-away needs one of the
  // five reasons (legacy bodies without one read as 'other').
  const { rows: negRows } = await db.query(
    `SELECT n.campaign_influencer_id, ci.influencer_id, c.brand_id FROM negotiations n
       JOIN campaign_influencers ci ON ci.id = n.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id WHERE n.id = $1`,
    [req.params.id]
  );
  if (!negRows[0]) throw new AppError('NOT_FOUND', 'Negotiation not found', 404);
  const ref = negRows[0];
  let by, ctx;
  if (req.user.role === 'brand') {
    const brand = await getBrandOrThrow(req.user.sub);
    if (brand.id !== ref.brand_id) throw new AppError('FORBIDDEN', 'You do not own this campaign', 403);
    by = 'brand'; ctx = await negotiation.loadContext(ref.campaign_influencer_id, { brandId: brand.id });
  } else if (req.user.role === 'influencer') {
    const influencer = await getInfluencerOrThrow(req.user.sub);
    if (influencer.id !== ref.influencer_id) throw new AppError('FORBIDDEN', 'This negotiation does not belong to you', 403);
    by = 'influencer'; ctx = await negotiation.loadContext(ref.campaign_influencer_id, { influencerId: influencer.id });
  } else {
    throw new AppError('FORBIDDEN', 'Only brand or influencer can respond to negotiations', 403);
  }
  if (!ctx) throw new AppError('NOT_FOUND', 'Negotiation not found', 404);
  if (ctx.outcome) throw new AppError('VALIDATION_ERROR', `Negotiation is already closed (status: ${ctx.neg_status})`, 422);
  const { action } = req.body || {};
  if (!VALID_ACTIONS.includes(action)) {
    throw new AppError('VALIDATION_ERROR', `action must be one of: ${VALID_ACTIONS.join(', ')}`, 422, 'action');
  }
  let contractError = null;
  if (action === 'counter') {
    await negotiation.counter({ ctx, by, terms: req.body || {}, note: req.body?.note, actorUserId: req.user.sub, legacy: true });
  } else if (action === 'accept') {
    ({ contractError } = await negotiation.accept({ ctx, by, actorUserId: req.user.sub }));
  } else {
    await negotiation.decline({ ctx, by, reason: by === 'influencer' ? (req.body?.reason || 'other') : undefined, note: req.body?.note, actorUserId: req.user.sub });
  }
  const { rows: n2 } = await db.query(`SELECT * FROM negotiations WHERE id = $1`, [req.params.id]);
  const { rows: c2 } = await db.query(`SELECT * FROM campaign_influencers WHERE id = $1`, [ref.campaign_influencer_id]);
  return success(res, { negotiation: n2[0], campaign_influencer: c2[0], contract_pending: !!contractError, contract_error: contractError });
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
