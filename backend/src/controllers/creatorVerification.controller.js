'use strict';

/**
 * Admin verification queue for claimed creator_profiles.
 *
 * State machine (creator_profiles.verification_status):
 *   unclaimed → claimed       (set by influencer.controller.register on handle match)
 *   claimed   → verified      (admin confirms identity)
 *   claimed   → rejected      (admin denies)
 *   rejected  → unclaimed     (admin reset, allows re-claim)
 *
 * Conflict cluster:
 *   When a single user matches multiple creator_profiles rows (because
 *   ig_handle hits one but youtube_handle hits another, etc.), all
 *   candidates carry the same claim_user_id. Verifying one auto-rejects
 *   the others in the cluster.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/admin/creator-verifications
// Lists all profiles awaiting verification. Includes conflict clusters.
// ─────────────────────────────────────────────────────────────────────────────

const listQueue = asyncHandler(async (req, res) => {
  const status = String(req.query.status || 'claimed');
  const statuses = status.split(',').map(s => s.trim()).filter(Boolean);

  const { rows } = await db.query(
    `SELECT
       cp.id, cp.ig_handle, cp.youtube_handle, cp.full_name,
       cp.profile_pic_url, cp.followers_count, cp.follower_tier,
       cp.verification_status, cp.claim_requested_at, cp.rejection_reason,
       cp.bio_email, cp.bio_phone,
       cp.linked_influencer_id,
       u.id   AS claim_user_id,
       u.name AS claim_user_name,
       u.phone AS claim_user_phone,
       i.id            AS influencer_row_id,
       i.instagram_handle AS influencer_ig,
       i.youtube_handle AS influencer_yt,
       -- Cluster size = how many rows share this claim_user_id
       (SELECT COUNT(*)::int FROM creator_profiles cp2
         WHERE cp2.claim_user_id = cp.claim_user_id) AS cluster_size
     FROM creator_profiles cp
     LEFT JOIN users u       ON u.id = cp.claim_user_id
     LEFT JOIN influencers i ON i.user_id = cp.claim_user_id
     WHERE cp.verification_status = ANY($1::text[])
     ORDER BY cp.claim_requested_at ASC NULLS LAST, cp.ig_handle ASC`,
    [statuses]
  );
  return success(res, { verifications: rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/admin/creator-verifications/:id/verify
// Marks one creator_profile as verified; auto-rejects conflict-cluster siblings.
// ─────────────────────────────────────────────────────────────────────────────

const verify = asyncHandler(async (req, res) => {
  const adminId = req.user.sub;
  const profileId = req.params.id;

  // Fetch the target profile + its claim cluster
  const { rows: target } = await db.query(
    `SELECT id, claim_user_id, verification_status FROM creator_profiles WHERE id = $1`,
    [profileId]
  );
  if (target.length === 0) throw new AppError('NOT_FOUND', 'Creator profile not found', 404);
  if (target[0].verification_status !== 'claimed') {
    throw new AppError('CONFLICT',
      `Cannot verify: current status is ${target[0].verification_status}`, 409);
  }

  await db.query('BEGIN');
  try {
    // Verify the target
    const { rows: verifiedRows } = await db.query(
      `UPDATE creator_profiles
          SET verification_status = 'verified',
              verified_at         = NOW(),
              verified_by         = $1
        WHERE id = $2
        RETURNING *`,
      [adminId, profileId]
    );

    // Auto-reject any sibling rows in the same claim cluster
    if (target[0].claim_user_id) {
      await db.query(
        `UPDATE creator_profiles
            SET verification_status = 'rejected',
                rejection_reason    = 'Auto-rejected: another profile in the conflict cluster was verified'
          WHERE claim_user_id = $1
            AND id <> $2
            AND verification_status = 'claimed'`,
        [target[0].claim_user_id, profileId]
      );
    }

    // Sync user.status to 'approved' for the claiming user (their account is now confirmed)
    if (target[0].claim_user_id) {
      await db.query(
        `UPDATE users SET status = 'approved' WHERE id = $1 AND status = 'pending'`,
        [target[0].claim_user_id]
      );
    }

    await db.query('COMMIT');
    return success(res, { verified: verifiedRows[0] });
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/admin/creator-verifications/:id/reject
// Body: { reason }
// ─────────────────────────────────────────────────────────────────────────────

const reject = asyncHandler(async (req, res) => {
  const reason = req.body?.reason ? String(req.body.reason).slice(0, 1000) : null;

  const { rows } = await db.query(
    `UPDATE creator_profiles
        SET verification_status = 'rejected',
            rejection_reason    = $1
      WHERE id = $2 AND verification_status = 'claimed'
      RETURNING *`,
    [reason, req.params.id]
  );
  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Profile not found or not in claimed state', 404);
  }
  return success(res, { rejected: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/admin/creator-verifications/:id/reset
// Move a rejected profile back to unclaimed so a different user can try
// to claim it again later.
// ─────────────────────────────────────────────────────────────────────────────

const reset = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `UPDATE creator_profiles
        SET verification_status = 'unclaimed',
            claim_user_id        = NULL,
            claim_requested_at   = NULL,
            rejection_reason     = NULL,
            linked_influencer_id = NULL
      WHERE id = $1 AND verification_status IN ('rejected','claimed')
      RETURNING *`,
    [req.params.id]
  );
  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Profile not found or not eligible for reset', 404);
  }
  return success(res, { reset: rows[0] });
});

module.exports = { listQueue, verify, reject, reset };
