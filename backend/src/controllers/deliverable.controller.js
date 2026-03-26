'use strict';

/**
 * deliverable.controller.js
 * Phase 3 — Blocks C & D
 *
 * Block C:
 *   POST /v1/deliverables/:id/submit        — influencer submits content URL
 *   POST /v1/deliverables/:id/review        — brand approves or requests revision
 *
 * Block D:
 *   POST /v1/deliverables/:id/submit-live   — influencer submits public live URL
 *   POST /v1/deliverables/:id/confirm-live  — brand confirms content is live → T2 release
 */

const db                  = require('../config/db');
const { success }         = require('../utils/response');
const AppError            = require('../utils/AppError');
const asyncHandler        = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');
const escrowService       = require('../services/escrow.service');

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Fetch a deliverable with joined auth data.
 * Returns null if not found.
 */
async function getDeliverableOrThrow(deliverableId) {
  const { rows } = await db.query(
    `SELECT
       d.*,
       ci.influencer_id,
       ci.id              AS ci_id,
       cs.campaign_id,
       c.brand_id,
       u_inf.id           AS influencer_user_id,
       u_inf.fcm_token    AS influencer_fcm_token,
       u_inf.phone        AS influencer_phone,
       u_br.id            AS brand_user_id,
       u_br.fcm_token     AS brand_fcm_token,
       u_br.phone         AS brand_phone
     FROM deliverables d
     JOIN campaign_influencers ci ON ci.id  = d.campaign_influencer_id
     JOIN campaign_sets        cs ON cs.id  = ci.set_id
     JOIN campaigns            c  ON c.id   = cs.campaign_id
     JOIN brands               b  ON b.id   = c.brand_id
     JOIN influencers          inf ON inf.id = ci.influencer_id
     JOIN users                u_inf ON u_inf.id = inf.user_id
     JOIN users                u_br  ON u_br.id  = b.user_id
     WHERE d.id = $1`,
    [deliverableId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Deliverable not found', 404);
  return rows[0];
}

// Strip internal join columns before returning to client
function stripInternal(d) {
  const {
    influencer_user_id, influencer_fcm_token, influencer_phone,
    brand_user_id,      brand_fcm_token,      brand_phone,
    influencer_id,      ci_id,                campaign_id,    brand_id,
    ...deliverable
  } = d;
  return deliverable;
}

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /v1/deliverables/:id/submit  (influencer)
// ─────────────────────────────────────────────────────────────────────────────

const submit = asyncHandler(async (req, res) => {
  if (req.user.role !== 'influencer') {
    throw new AppError('FORBIDDEN', 'Only influencers can submit deliverables', 403);
  }

  const d = await getDeliverableOrThrow(req.params.id);

  // Verify ownership
  if (d.influencer_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'This deliverable does not belong to you', 403);
  }

  // Can only submit from pending or revision_requested
  if (!['pending', 'revision_requested'].includes(d.status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot submit deliverable in '${d.status}' status. Must be pending or revision_requested.`,
      422
    );
  }

  // Validate submitted_url
  const submitted_url = (req.body.submitted_url || '').trim();
  if (!submitted_url) {
    throw new AppError('VALIDATION_ERROR', 'submitted_url is required', 422, 'submitted_url');
  }

  const notes_to_brand = (req.body.notes_to_brand || '').trim() || null;

  const { rows } = await db.query(
    `UPDATE deliverables
     SET status        = 'submitted',
         submitted_url = $2,
         submitted_at  = now(),
         notes_to_brand = $3
     WHERE id = $1
     RETURNING *`,
    [d.id, submitted_url, notes_to_brand]
  );

  // Notify brand
  await notificationService.send({
    userId:   d.brand_user_id,
    type:     'deliverable.submitted',
    title:    'Content Submitted for Review',
    body:     `An influencer has submitted content for your review.`,
    data:     { screen: 'deliverable_review', deliverable_id: d.id, campaign_id: d.campaign_id },
    fcmToken: d.brand_fcm_token,
    sendSms:  false,
  });

  return success(res, { deliverable: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /v1/deliverables/:id/review  (brand)
// ─────────────────────────────────────────────────────────────────────────────

const VALID_REVIEW_ACTIONS = ['approve', 'request_revision'];

const review = asyncHandler(async (req, res) => {
  if (req.user.role !== 'brand') {
    throw new AppError('FORBIDDEN', 'Only brands can review deliverables', 403);
  }

  const d = await getDeliverableOrThrow(req.params.id);

  // Verify ownership
  if (d.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this deliverable', 403);
  }

  // Can only review from submitted status
  if (d.status !== 'submitted') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot review deliverable in '${d.status}' status. Must be submitted.`,
      422
    );
  }

  const { action, feedback } = req.body;

  if (!action || !VALID_REVIEW_ACTIONS.includes(action)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `action must be one of: ${VALID_REVIEW_ACTIONS.join(', ')}`,
      422,
      'action'
    );
  }

  let updated;

  if (action === 'approve') {
    const { rows } = await db.query(
      `UPDATE deliverables SET status = 'approved' WHERE id = $1 RETURNING *`,
      [d.id]
    );
    updated = rows[0];

    // Notify influencer
    await notificationService.send({
      userId:   d.influencer_user_id,
      type:     'deliverable.approved',
      title:    'Content Approved!',
      body:     `Your content submission has been approved. Please post it live and submit the live URL.`,
      data:     { screen: 'deliverable_detail', deliverable_id: d.id },
      fcmToken: d.influencer_fcm_token,
      sendSms:  true,
      phone:    d.influencer_phone,
    });

  } else {
    // request_revision — check limit first
    if (d.revision_count >= d.revision_limit) {
      throw new AppError(
        'REVISION_LIMIT_EXCEEDED',
        `Revision limit of ${d.revision_limit} has been reached for this deliverable.`,
        422
      );
    }

    const { rows } = await db.query(
      `UPDATE deliverables
       SET status         = 'revision_requested',
           revision_count = revision_count + 1,
           brand_feedback = $2
       WHERE id = $1
       RETURNING *`,
      [d.id, (feedback || '').trim() || null]
    );
    updated = rows[0];

    // Notify influencer
    await notificationService.send({
      userId:   d.influencer_user_id,
      type:     'deliverable.revision_requested',
      title:    'Revision Requested',
      body:     `The brand has requested a revision on your content. Feedback: ${feedback || 'No specific feedback.'}`,
      data:     { screen: 'deliverable_detail', deliverable_id: d.id },
      fcmToken: d.influencer_fcm_token,
      sendSms:  false,
    });
  }

  return success(res, { deliverable: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block D — POST /v1/deliverables/:id/submit-live  (influencer)
// ─────────────────────────────────────────────────────────────────────────────

const submitLive = asyncHandler(async (req, res) => {
  if (req.user.role !== 'influencer') {
    throw new AppError('FORBIDDEN', 'Only influencers can submit live URLs', 403);
  }

  const d = await getDeliverableOrThrow(req.params.id);

  // Verify ownership
  if (d.influencer_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'This deliverable does not belong to you', 403);
  }

  // Can only submit live from approved status
  if (d.status !== 'approved') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot submit live URL in '${d.status}' status. Must be approved.`,
      422
    );
  }

  // Validate live_url
  const live_url = (req.body.live_url || '').trim();
  if (!live_url) {
    throw new AppError('VALIDATION_ERROR', 'live_url is required', 422, 'live_url');
  }

  const { rows } = await db.query(
    `UPDATE deliverables SET live_url = $2 WHERE id = $1 RETURNING *`,
    [d.id, live_url]
  );

  // Notify brand to confirm live
  await notificationService.send({
    userId:   d.brand_user_id,
    type:     'deliverable.live_submitted',
    title:    'Content is Live — Please Confirm',
    body:     `An influencer has published their content. Please verify it is live and confirm.`,
    data:     { screen: 'deliverable_detail', deliverable_id: d.id, live_url },
    fcmToken: d.brand_fcm_token,
    sendSms:  false,
  });

  return success(res, { deliverable: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block D — POST /v1/deliverables/:id/confirm-live  (brand)
// ─────────────────────────────────────────────────────────────────────────────

const confirmLive = asyncHandler(async (req, res) => {
  if (req.user.role !== 'brand') {
    throw new AppError('FORBIDDEN', 'Only brands can confirm content live', 403);
  }

  const d = await getDeliverableOrThrow(req.params.id);

  // Verify ownership
  if (d.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this deliverable', 403);
  }

  // Must be in approved status with a live_url
  if (d.status !== 'approved') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot confirm live in '${d.status}' status. Must be approved.`,
      422
    );
  }

  if (!d.live_url) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Influencer has not submitted a live URL yet. Ask them to post it live first.',
      422
    );
  }

  let updatedDeliverable;
  let t2Result;

  await db.withTransaction(async (client) => {
    // 1. Mark deliverable as live
    const { rows: delivRows } = await client.query(
      `UPDATE deliverables
       SET status = 'live', live_confirmed_at = now()
       WHERE id = $1
       RETURNING *`,
      [d.id]
    );
    updatedDeliverable = delivRows[0];

    // 2. Mark campaign_influencer as active
    await client.query(
      `UPDATE campaign_influencers SET status = 'active' WHERE id = $1`,
      [d.ci_id]
    );

    // 3. Get T2 escrow entry
    const { rows: t2Rows } = await client.query(
      `SELECT id FROM escrow_entries
       WHERE campaign_influencer_id = $1 AND tranche_number = 2 AND status = 'locked'`,
      [d.ci_id]
    );
    if (!t2Rows[0]) throw new AppError('INTERNAL_ERROR', 'T2 escrow entry not found', 500);

    // 4. Release T2
    t2Result = await escrowService.processTrancheRelease(
      client,
      t2Rows[0].id,
      d.influencer_id,
      d.brand_id,
      d.campaign_id
    );
  });

  // 5. Notify influencer
  try {
    await notificationService.send({
      userId:   d.influencer_user_id,
      type:     'deliverable.live_confirmed',
      title:    'Content Confirmed Live — T2 Payment Initiated',
      body:     `Your content has been confirmed live. Tranche 2 payment of ₹${t2Result.netAmount.toFixed(2)} has been initiated.`,
      data:     { screen: 'deliverable_detail', deliverable_id: d.id },
      fcmToken: d.influencer_fcm_token,
      sendSms:  true,
      phone:    d.influencer_phone,
    });
  } catch (notifErr) {
    console.error('[DELIVERABLE] Notification failed (non-fatal):', notifErr.message);
  }

  return success(res, {
    deliverable:  updatedDeliverable,
    t2_released:  true,
    t2_amount:    t2Result.netAmount,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { submit, review, submitLive, confirmLive };
