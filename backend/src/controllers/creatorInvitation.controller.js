'use strict';

/**
 * Brand-driven outreach to UNCLAIMED scraped creators.
 *
 * Brand flow:
 *   POST   /v1/brands/me/creator-invitations           — invite a scraped creator
 *   GET    /v1/brands/me/creator-invitations           — list this brand's invitations
 *   DELETE /v1/brands/me/creator-invitations/:id       — withdraw a pending invite
 *
 * Admin flow (separate controller below):
 *   GET    /v1/admin/creator-invitations               — full queue
 *   POST   /v1/admin/creator-invitations/:id/contacted — mark outreach run
 *   POST   /v1/admin/creator-invitations/:id/expire    — give up on this one
 *
 * Auto-conversion: when an influencer registers and their handle matches a
 * creator_profile, all open invitations for that profile are flipped to
 * status='converted' inside the register handler.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { resolveAvatars } = require('../utils/avatarResolver');

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/brands/me/creator-invitations
// Body: { ig_handle, brand_message?, proposed_fee?, campaign_id?, set_id? }
// ─────────────────────────────────────────────────────────────────────────────

const createInvitation = asyncHandler(async (req, res) => {
  const brandId = req.user.brand_id;
  if (!brandId) {
    throw new AppError('FORBIDDEN', 'Brand profile required', 403);
  }

  const igHandle = String(req.body.ig_handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!igHandle) {
    throw new AppError('VALIDATION_ERROR', 'ig_handle is required', 422, 'ig_handle');
  }

  const { rows: profiles } = await db.query(
    `SELECT id, verification_status, linked_influencer_id
       FROM creator_profiles
      WHERE ig_handle = $1`,
    [igHandle]
  );
  if (profiles.length === 0) {
    throw new AppError('NOT_FOUND', `No creator profile for @${igHandle}`, 404);
  }
  const profile = profiles[0];

  if (profile.linked_influencer_id) {
    throw new AppError('ALREADY_ON_INFLX',
      'This creator is already on Inflx — invite via the regular campaign flow instead', 409);
  }

  const message    = req.body.brand_message != null ? String(req.body.brand_message).slice(0, 2000) : null;
  const proposedFee = req.body.proposed_fee != null ? Number(req.body.proposed_fee) : null;
  if (proposedFee != null && (Number.isNaN(proposedFee) || proposedFee < 0)) {
    throw new AppError('VALIDATION_ERROR', 'proposed_fee must be a non-negative number', 422, 'proposed_fee');
  }

  const campaignId = req.body.campaign_id || null;
  const setId      = req.body.set_id || null;

  try {
    const { rows } = await db.query(
      `INSERT INTO creator_invitations
         (creator_profile_id, brand_id, campaign_id, set_id, brand_message, proposed_fee)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [profile.id, brandId, campaignId, setId, message, proposedFee]
    );
    return success(res, { invitation: rows[0] }, 201);
  } catch (e) {
    // unique violation — duplicate (brand, creator, campaign) tuple
    if (e.code === '23505') {
      throw new AppError('CONFLICT',
        'You have already invited this creator for this campaign', 409);
    }
    throw e;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/creator-invitations
// Query: status, page, limit
// ─────────────────────────────────────────────────────────────────────────────

const listMyInvitations = asyncHandler(async (req, res) => {
  const brandId = req.user.brand_id;
  if (!brandId) throw new AppError('FORBIDDEN', 'Brand profile required', 403);

  const conditions = ['ci.brand_id = $1'];
  const params = [brandId];

  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`ci.status = $${params.length}`);
  }

  const pageNum = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset  = (pageNum - 1) * limit;

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM creator_invitations ci WHERE ${conditions.join(' AND ')}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT
       ci.id, ci.status, ci.brand_message, ci.proposed_fee,
       ci.invited_at, ci.contacted_at, ci.converted_at, ci.declined_at, ci.expires_at,
       ci.campaign_id, ci.set_id,
       cp.ig_handle, cp.full_name, cp.profile_pic_url, cp.followers_count, cp.follower_tier
     FROM creator_invitations ci
     JOIN creator_profiles cp ON cp.id = ci.creator_profile_id
     WHERE ${conditions.slice(0, -0).join(' AND ')}
     ORDER BY ci.invited_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return success(res, { invitations: rows }, 200, { page: pageNum, limit, total: countRows[0].c });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /v1/brands/me/creator-invitations/:id  (withdraw a pending invite)
// ─────────────────────────────────────────────────────────────────────────────

const withdrawInvitation = asyncHandler(async (req, res) => {
  const brandId = req.user.brand_id;
  if (!brandId) throw new AppError('FORBIDDEN', 'Brand profile required', 403);

  const { rowCount } = await db.query(
    `DELETE FROM creator_invitations
      WHERE id = $1 AND brand_id = $2 AND status IN ('pending','contacted')`,
    [req.params.id, brandId]
  );
  if (rowCount === 0) {
    throw new AppError('NOT_FOUND',
      'Invitation not found or already converted/declined', 404);
  }
  return success(res, { withdrawn: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: GET /v1/admin/creator-invitations
// ─────────────────────────────────────────────────────────────────────────────

const adminListInvitations = asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending,contacted';
  const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);

  const { rows } = await db.query(
    `SELECT
       ci.id, ci.status, ci.brand_message, ci.proposed_fee,
       ci.invited_at, ci.contacted_at, ci.expires_at, ci.contacted_by,
       cp.ig_handle, cp.full_name, cp.profile_pic_url, cp.profile_pic_r2_key,
       cp.followers_count,
       cp.follower_tier, cp.bio_email, cp.bio_phone,
       b.business_name AS brand_name, b.id AS brand_id
     FROM creator_invitations ci
     JOIN creator_profiles cp ON cp.id = ci.creator_profile_id
     JOIN brands b ON b.id = ci.brand_id
     WHERE ci.status = ANY($1::text[])
     ORDER BY ci.invited_at ASC`,
    [statuses]
  );
  await resolveAvatars(rows);
  return success(res, { invitations: rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: POST /v1/admin/creator-invitations/:id/contacted
// ─────────────────────────────────────────────────────────────────────────────

const adminMarkContacted = asyncHandler(async (req, res) => {
  const adminId = req.user.sub;
  const { rows } = await db.query(
    `UPDATE creator_invitations
        SET status = 'contacted',
            contacted_at = NOW(),
            contacted_by = $1
      WHERE id = $2 AND status = 'pending'
      RETURNING *`,
    [adminId, req.params.id]
  );
  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Invitation not found or not in pending state', 404);
  }
  return success(res, { invitation: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: POST /v1/admin/creator-invitations/:id/expire
// ─────────────────────────────────────────────────────────────────────────────

const adminExpire = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `UPDATE creator_invitations
        SET status = 'expired'
      WHERE id = $1 AND status IN ('pending','contacted')
      RETURNING *`,
    [req.params.id]
  );
  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Invitation not found or already terminal', 404);
  }
  return success(res, { invitation: rows[0] });
});

module.exports = {
  createInvitation,
  listMyInvitations,
  withdrawInvitation,
  adminListInvitations,
  adminMarkContacted,
  adminExpire,
};
