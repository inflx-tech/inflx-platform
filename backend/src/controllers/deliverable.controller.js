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
const storageService      = require('../services/storage.service');
// collab-phase0 — step 5 history. Only the LATEST change request used to survive.
const events              = require('../services/collabEvents.service');

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
// GET /v1/deliverables/:id  (influencer or brand)
// ─────────────────────────────────────────────────────────────────────────────

const getById = asyncHandler(async (req, res) => {
  const d = await getDeliverableOrThrow(req.params.id);

  // Verify ownership (brand or influencer)
  if (req.user.role === 'brand' && d.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this deliverable', 403);
  }
  if (req.user.role === 'influencer' && d.influencer_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'This deliverable does not belong to you', 403);
  }

  // Also fetch engagement stats if available
  let stats = null;
  try {
    const { rows: statsRows } = await db.query(
      `SELECT reach, impressions, likes, comments, saves, shares, engagement_rate, scraped_at
       FROM deliverable_stats WHERE deliverable_id = $1`,
      [d.id]
    );
    stats = statsRows[0] || null;
  } catch (e) {
    // Stats table may not exist yet — non-critical
  }

  return success(res, { deliverable: stripInternal(d), stats });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /v1/deliverables/:id/submit  (influencer)
// ─────────────────────────────────────────────────────────────────────────────

/** collab-phase0 — one helper so every step-5 entry is shaped the same way. */
async function recordGoLive(d, actorRole, actorUserId, action, note) {
  await events.record({
    campaignInfluencerId: d.campaign_influencer_id || null,
    step: events.STEP.GO_LIVE,
    actorRole,
    actorUserId,
    action,
    note: note || null,
  });
}

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

  // Accept either URL or media upload
  const submitted_url = (req.body.submitted_url || req.body.submission_url || '').trim();
  const media_key = (req.body.media_key || '').trim();
  const media_type = (req.body.media_type || '').trim();

  if (!submitted_url && !media_key) {
    throw new AppError('VALIDATION_ERROR', 'Either submitted_url or media_key is required', 422, 'submitted_url');
  }

  const notes_to_brand = (req.body.notes_to_brand || '').trim() || null;

  const { rows } = await db.query(
    `UPDATE deliverables
     SET status         = 'submitted',
         submitted_url  = COALESCE($2, submitted_url),
         submitted_at   = now(),
         notes_to_brand = $3,
         media_key      = COALESCE($4, media_key),
         media_type     = COALESCE($5, media_type)
     WHERE id = $1
     RETURNING *`,
    [d.id, submitted_url || null, notes_to_brand, media_key || null, media_type || null]
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

  await recordGoLive(d, 'creator', req.user.sub, 'submitted', notes_to_brand || null);

  return success(res, { deliverable: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block C — POST /v1/deliverables/:id/review  (brand)
// ─────────────────────────────────────────────────────────────────────────────

const VALID_REVIEW_ACTIONS = ['approve', 'request_revision', 'revision'];

const review = asyncHandler(async (req, res) => {
  if (req.user.role !== 'brand') {
    throw new AppError('FORBIDDEN', 'Only brands can review deliverables', 403);
  }

  const d = await getDeliverableOrThrow(req.params.id);

  // Verify ownership
  if (d.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this deliverable', 403);
  }

  // Can only review from submitted or under_review status
  if (!['submitted', 'under_review'].includes(d.status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot review deliverable in '${d.status}' status. Must be submitted or under_review.`,
      422
    );
  }

  const { action, feedback } = req.body;

  if (!action || !VALID_REVIEW_ACTIONS.includes(action)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `action must be one of: approve, request_revision`,
      422,
      'action'
    );
  }

  let updated;

  // Normalize action name
  const normalizedAction = (action === 'revision') ? 'request_revision' : action;

  if (normalizedAction === 'approve') {
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

  } else if (normalizedAction === 'request_revision') {
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

  await recordGoLive(
    d, 'brand', req.user.sub,
    updated && updated.status === 'revision_requested' ? 'changes_asked' : 'approved',
    (feedback || '').trim() || null);

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

  await recordGoLive(d, 'creator', req.user.sub, 'posted', live_url);

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
  let t2Result = null;
  let liveCount = 0;
  let totalCount = 0;

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

    // 2. Mark campaign_influencer as active (idempotent)
    await client.query(
      `UPDATE campaign_influencers SET status = 'active' WHERE id = $1`,
      [d.ci_id]
    );

    // 3. Count all deliverables for this contract vs. ones now live.
    //    T2 releases only when every deliverable for this campaign_influencer
    //    is in status 'live'. This prevents the "T2 already released" error
    //    when a contract has multiple deliverables (e.g. reel + post + story).
    const { rows: countRows } = await client.query(
      `SELECT
         COUNT(*)::int                                              AS total,
         COUNT(*) FILTER (WHERE status = 'live')::int               AS live
       FROM deliverables
       WHERE campaign_influencer_id = $1`,
      [d.ci_id]
    );
    totalCount = countRows[0].total;
    liveCount  = countRows[0].live;

    if (liveCount < totalCount) return; // wait for remaining confirmations

    // 4. All deliverables live — release T2 if still locked. FOR UPDATE guards
    //    against a race when two confirm-live calls land concurrently.
    //    Conversion-only contracts have no escrow entries at all (no upfront
    //    fee → brandSign skipped wallet-lock and tranche creation). In that
    //    case there's nothing to release; the live confirmation itself is the
    //    end state for the deliverable.
    const { rows: t2Rows } = await client.query(
      `SELECT id, status FROM escrow_entries
       WHERE campaign_influencer_id = $1 AND tranche_number = 2
       FOR UPDATE`,
      [d.ci_id]
    );
    if (!t2Rows[0]) return; // conversion-only contract — no tranche to release
    if (t2Rows[0].status !== 'locked') return; // already released (idempotent)

    t2Result = await escrowService.processTrancheRelease(
      client,
      t2Rows[0].id,
      d.influencer_id,
      d.brand_id,
      d.campaign_id
    );

    // 5. Arm T3's 30-day clock. The tranche-3 cron only releases entries in
    //    status 'queued' with a triggered_at timestamp; without this hand-off
    //    the final 50% never releases (contract:
    //    features/backend-defect-tranche3-never-queued). Guarded by
    //    status='locked' so a concurrent confirm-live can't double-arm it.
    await client.query(
      `UPDATE escrow_entries
       SET status = 'queued', triggered_at = now()
       WHERE campaign_influencer_id = $1
         AND tranche_number = 3
         AND status = 'locked'`,
      [d.ci_id]
    );
  });

  // 6. Notify influencer when all deliverables on this contract are now live.
  //    For engagement/hybrid → also mention the T2 payment that just released.
  //    For conversion-only → just confirm the live state (no tranche exists).
  if (liveCount === totalCount && totalCount > 0) {
    try {
      const hasTranche = !!t2Result;
      await notificationService.send({
        userId:   d.influencer_user_id,
        type:     'deliverable.live_confirmed',
        title:    hasTranche ? 'All Content Confirmed Live — T2 Payment Initiated' : 'All Content Confirmed Live',
        body:     hasTranche
          ? `Your content has been confirmed live. Tranche 2 payment of ₹${t2Result.netAmount.toFixed(2)} has been initiated.`
          : `Your content has been confirmed live. Your tracking link is active — commissions will land in your pending balance as conversions come in.`,
        data:     { screen: 'deliverable_detail', deliverable_id: d.id },
        fcmToken: d.influencer_fcm_token,
        sendSms:  true,
        phone:    d.influencer_phone,
      });
    } catch (notifErr) {
      console.error('[DELIVERABLE] Notification failed (non-fatal):', notifErr.message);
    }
  }

  await recordGoLive(d, 'brand', req.user.sub, 'confirmed_live', null);

  return success(res, {
    deliverable:     updatedDeliverable,
    t2_released:     !!t2Result,
    t2_amount:       t2Result ? t2Result.netAmount : null,
    live_count:      liveCount,
    total_count:     totalCount,
    pending_count:   Math.max(0, totalCount - liveCount),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/deliverables/:id/upload-url  (influencer — get presigned upload URL)
// ─────────────────────────────────────────────────────────────────────────────

const getUploadUrl = asyncHandler(async (req, res) => {
  if (req.user.role !== 'influencer') {
    throw new AppError('FORBIDDEN', 'Only influencers can upload content', 403);
  }

  const d = await getDeliverableOrThrow(req.params.id);
  if (d.influencer_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'This deliverable does not belong to you', 403);
  }

  if (!['pending', 'revision_requested'].includes(d.status)) {
    throw new AppError('VALIDATION_ERROR', `Cannot upload in '${d.status}' status`, 422);
  }

  const { filename, content_type } = req.body;
  if (!filename || !content_type) {
    throw new AppError('VALIDATION_ERROR', 'filename and content_type are required', 422);
  }

  // Validate content type
  const allowed = ['video/mp4', 'video/quicktime', 'video/mov', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (!allowed.some(t => content_type.startsWith(t.split('/')[0]))) {
    throw new AppError('VALIDATION_ERROR', 'Only video and image files are allowed', 422);
  }

  // Generate storage key
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `content/deliverables/${d.id}/${Date.now()}_${safeName}`;

  const result = await storageService.generateUploadUrl(key, content_type);

  return success(res, result);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/deliverables/:id/media-url  (influencer or brand — get download URL)
// ─────────────────────────────────────────────────────────────────────────────

const getMediaUrl = asyncHandler(async (req, res) => {
  const d = await getDeliverableOrThrow(req.params.id);

  // Verify ownership
  if (req.user.role === 'brand' && d.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this deliverable', 403);
  }
  if (req.user.role === 'influencer' && d.influencer_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'This deliverable does not belong to you', 403);
  }

  if (!d.media_key) {
    throw new AppError('NOT_FOUND', 'No media file uploaded for this deliverable', 404);
  }

  const url = await storageService.generateDownloadUrl(d.media_key);

  return success(res, { url, content_type: d.media_type, key: d.media_key });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/deliverables/bulk-review  (brand)
// Body: { deliverable_ids: [..], action: 'approve' | 'request_revision', feedback?: string }
//
// Loops through deliverables, applies review() logic per-row, ignores rows that
// don't belong to the brand or are not in a reviewable state, and returns a
// summary { ok: [ids], skipped: [{id, reason}] }.
// ─────────────────────────────────────────────────────────────────────────────
const bulkReview = asyncHandler(async (req, res) => {
  if (req.user.role !== 'brand') {
    throw new AppError('FORBIDDEN', 'Only brands can review deliverables', 403);
  }

  const { deliverable_ids, action, feedback } = req.body || {};
  if (!Array.isArray(deliverable_ids) || deliverable_ids.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'deliverable_ids must be a non-empty array', 422, 'deliverable_ids');
  }
  if (!VALID_REVIEW_ACTIONS.includes(action)) {
    throw new AppError('VALIDATION_ERROR', `action must be one of: ${VALID_REVIEW_ACTIONS.join(', ')}`, 422, 'action');
  }
  const normalisedAction = action === 'revision' ? 'request_revision' : action;

  const ok = [];
  const skipped = [];

  for (const id of deliverable_ids) {
    try {
      const d = await getDeliverableOrThrow(id);
      if (d.brand_user_id !== req.user.sub) {
        skipped.push({ id, reason: 'not your deliverable' });
        continue;
      }
      if (!['submitted', 'under_review'].includes(d.status)) {
        skipped.push({ id, reason: `status=${d.status}` });
        continue;
      }
      if (normalisedAction === 'approve') {
        await db.query(`UPDATE deliverables SET status = 'approved' WHERE id = $1`, [d.id]);
        await notificationService.send({
          userId:   d.influencer_user_id,
          type:     'deliverable.approved',
          title:    'Content Approved!',
          body:     `Your content submission has been approved. Please post it live and submit the live URL.`,
          data:     { screen: 'deliverable_detail', deliverable_id: d.id },
          fcmToken: d.influencer_fcm_token,
          sendSms:  false,
        }).catch(e => console.error('[NOTIFICATION]', e.message));
      } else {
        if (d.revision_count >= d.revision_limit) {
          skipped.push({ id, reason: 'revision limit reached' });
          continue;
        }
        await db.query(
          `UPDATE deliverables
           SET status = 'revision_requested',
               revision_count = revision_count + 1,
               brand_feedback = $2
           WHERE id = $1`,
          [d.id, (feedback || '').trim() || null]
        );
        await notificationService.send({
          userId:   d.influencer_user_id,
          type:     'deliverable.revision_requested',
          title:    'Revision Requested',
          body:     `The brand has requested a revision on your content.${feedback ? ` Feedback: ${feedback}` : ''}`,
          data:     { screen: 'deliverable_detail', deliverable_id: d.id },
          fcmToken: d.influencer_fcm_token,
          sendSms:  false,
        }).catch(e => console.error('[NOTIFICATION]', e.message));
      }
      ok.push(id);
    } catch (e) {
      skipped.push({ id, reason: e.message });
    }
  }

  return success(res, { ok, skipped });
});

module.exports = { getById, submit, review, bulkReview, submitLive, confirmLive, getUploadUrl, getMediaUrl };
