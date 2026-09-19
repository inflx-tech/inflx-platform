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
const { resolveAvatars } = require('../utils/avatarResolver');
// registration-and-profile — verifying is approving, so it refuses an incomplete profile.
const completeness = require('../services/profileCompleteness.service');

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
       cp.profile_pic_url, cp.profile_pic_r2_key,
       cp.followers_count, cp.follower_tier,
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
  await resolveAvatars(rows);
  // creator-handle-change-review: the row leads with what is to be verified NOW — the creator's
  // current accounts — and says plainly when they differ from the handles she claimed with.
  for (const r of rows) {
    r.current_accounts = [];
    r.changed = [];
    if (!r.influencer_row_id) continue;
    const { rows: acc } = await db.query(
      `SELECT platform, handle_raw, handle_norm, channel_url, state, ownership
         FROM creator_social_accounts WHERE influencer_id = $1 AND replaced_at IS NULL ORDER BY platform`, [r.influencer_row_id]);
    r.current_accounts = acc.map(a => ({ platform: a.platform, handle: a.handle_raw, handle_norm: a.handle_norm, url: a.channel_url, state: a.state, ownership: a.ownership }));
    r.changed = changedSinceClaim(r);
  }
  return success(res, { verifications: rows });
});

/** Instagram / YouTube handles she has now versus the ones on the claimed profile. */
function changedSinceClaim(r) {
  const norm = (v) => (v == null ? null : String(v).trim().replace(/^@+/, '').toLowerCase() || null);
  const out = [];
  const pairs = [['instagram', r.ig_handle, r.influencer_ig], ['youtube', r.youtube_handle, r.influencer_yt]];
  for (const [platform, from, to] of pairs) {
    if (norm(from) !== norm(to)) out.push({ platform, from: from || null, to: to || null });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/admin/creator-verifications/:id/verify
// Marks one creator_profile as verified; auto-rejects conflict-cluster siblings.
// ─────────────────────────────────────────────────────────────────────────────

const verify = asyncHandler(async (req, res) => {
  const adminId = req.user.sub;
  const profileId = req.params.id;

  // Fetch the target profile + its claim cluster
  const { rows: target } = await db.query(
    `SELECT id, claim_user_id, linked_influencer_id, verification_status FROM creator_profiles WHERE id = $1`,
    [profileId]
  );
  if (target.length === 0) throw new AppError('NOT_FOUND', 'Creator profile not found', 404);
  if (target[0].verification_status !== 'claimed') {
    throw new AppError('CONFLICT',
      `Cannot verify: current status is ${target[0].verification_status}`, 409);
  }

  // registration-and-profile §6: verifying here IS the creator's approval, so it refuses an
  // incomplete profile and names what is missing (spec §6.2 creator checklist).
  if (target[0].linked_influencer_id) {
    const summary = await completeness.forCreator(target[0].linked_influencer_id);
    if (summary && !summary.complete) throw completeness.incompleteError(AppError, summary, 'admin');
  }

  let recordRenamed = null;
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

    // features/admin-people-pipeline (01-spec.md resolution): verifying here is now
    // the ONLY remaining path to an influencer's 'approved' status — closing the
    // previous 3-way duplicate (this queue / Approvals / the influencer detail
    // page). Mirror onto the linked influencers row (same rejection_reason /
    // approved_at / approved_by bookkeeping admin.controller.updateInfluencerStatus
    // already uses) and the underlying users row, which is the field every admin
    // list actually reads for the status badge (neither `brands` nor `influencers`
    // has its own `status` column — verify-twice against 001_initial_schema.sql).
    // Conflict-cluster siblings never carry their own linked_influencer_id (only
    // the single-match / stub-claim paths in influencer.controller.js set it), so
    // only the winning row's influencer/user status ever changes here.
    if (target[0].linked_influencer_id) {
      const { rows: infRows } = await db.query(
        `UPDATE influencers
            SET rejection_reason = NULL, approved_at = NOW(), approved_by = $1
          WHERE id = $2
          RETURNING user_id`,
        [adminId, target[0].linked_influencer_id]
      );
      if (infRows[0]) {
        await db.query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infRows[0].user_id]);
      }
      // creator-handle-change-review: the record admin approved names the channels admin looked
      // at. Renamed to the creator's CURRENT handles; skipped (and reported) when another scraped
      // profile already carries that Instagram handle (ig_handle is UNIQUE) — the old handle then
      // stays on the record, the accounts are still confirmed and measured below.
      const { rows: cur } = await db.query(`SELECT instagram_handle, youtube_handle FROM influencers WHERE id = $1`, [target[0].linked_influencer_id]);
      if (cur[0]) {
        const wantIg = cur[0].instagram_handle || null;
        const wantYt = cur[0].youtube_handle || null;
        const { rows: clash } = wantIg
          ? await db.query(`SELECT 1 FROM creator_profiles WHERE ig_handle = $1 AND id <> $2`, [wantIg, profileId])
          : { rows: [] };
        if (clash.length) {
          recordRenamed = false;
          await db.query(`UPDATE creator_profiles SET youtube_handle = COALESCE($2, youtube_handle) WHERE id = $1`, [profileId, wantYt]);
        } else {
          await db.query(
            `UPDATE creator_profiles SET ig_handle = COALESCE($2, ig_handle), youtube_handle = COALESCE($3, youtube_handle) WHERE id = $1`,
            [profileId, wantIg, wantYt]);
          recordRenamed = true;
        }
      }
    }

    await db.query('COMMIT');

    // Item 3b (rules v1.12 §2A): approval is the moment measuring starts. Every handle she
    // registered with is now hers (ownership confirmed) and a full run is due at once.
    // Contract: features/item3b-social-numbers
    if (target[0].linked_influencer_id) {
      const socialAccounts = require('../services/socialAccounts.service');
      const socialMeasure = require('../services/socialMeasure.service');
      const env = require('../config/env');
      const started = await socialAccounts.onCreatorApproved(target[0].linked_influencer_id, adminId);
      if (process.env.NODE_ENV !== 'test') for (const a of started) socialMeasure.kick(a.id, 'full', 'approval');
    }
    const { rows: after } = await db.query(`SELECT * FROM creator_profiles WHERE id = $1`, [profileId]);
    return success(res, { verified: after[0] || verifiedRows[0], record_renamed: recordRenamed });
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
  const profileId = req.params.id;

  const { rows: target } = await db.query(
    `SELECT id, linked_influencer_id, verification_status FROM creator_profiles WHERE id = $1`,
    [profileId]
  );
  if (target.length === 0 || target[0].verification_status !== 'claimed') {
    throw new AppError('NOT_FOUND', 'Profile not found or not in claimed state', 404);
  }

  await db.query('BEGIN');
  try {
    const { rows: rejectedRows } = await db.query(
      `UPDATE creator_profiles
          SET verification_status = 'rejected',
              rejection_reason    = $1
        WHERE id = $2
        RETURNING *`,
      [reason, profileId]
    );

    // features/admin-people-pipeline (01-spec.md resolution): a rejected identity
    // check means the account doesn't go live — it must not stay dangling in
    // 'pending' on the influencers/users side. Same rejection_reason mirrored to
    // both rows; same linked_influencer_id gate as verify() above.
    if (target[0].linked_influencer_id) {
      const { rows: infRows } = await db.query(
        `UPDATE influencers
            SET rejection_reason = $1, approved_at = NULL, approved_by = NULL
          WHERE id = $2
          RETURNING user_id`,
        [reason, target[0].linked_influencer_id]
      );
      if (infRows[0]) {
        await db.query(`UPDATE users SET status = 'rejected' WHERE id = $1`, [infRows[0].user_id]);
        // Item 3 (rules v1.11 §5A, founder Q11): a rejected creator leaves every brand's group.
        await db.query(`DELETE FROM influencer_group_members WHERE influencer_id = $1`, [target[0].linked_influencer_id]);
      }
    }

    await db.query('COMMIT');
    return success(res, { rejected: rejectedRows[0] });
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
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
