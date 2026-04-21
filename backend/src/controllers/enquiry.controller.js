'use strict';

/**
 * enquiry.controller.js
 * Phase 4 — Block E
 *
 * POST  /follower/enquiry
 * GET   /brands/me/enquiries
 * PATCH /brands/me/enquiries/:id
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');

async function getFollowerByUserId(userId) {
  const { rows } = await db.query(
    `SELECT f.*, u.name, u.phone FROM followers f JOIN users u ON u.id = f.user_id WHERE f.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

// ── POST /follower/enquiry ────────────────────────────────────────────────────

const submitEnquiry = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { brand_id, campaign_id, set_id, campaign_influencer_id, form_data } = req.body;
  if (!brand_id) throw new AppError('VALIDATION_ERROR', 'brand_id is required', 422, 'brand_id');

  const { rows } = await db.query(
    `INSERT INTO enquiry_leads
       (follower_id, brand_id, campaign_influencer_id, form_data_json, status)
     VALUES ($1, $2, $3, $4, 'submitted')
     RETURNING id, status`,
    [follower.id, brand_id, campaign_influencer_id || null, form_data ? JSON.stringify(form_data) : null]
  );

  // Notify brand
  const { rows: brandRows } = await db.query(
    `SELECT b.user_id, u_b.fcm_token FROM brands b JOIN users u_b ON u_b.id = b.user_id WHERE b.id = $1`,
    [brand_id]
  );
  if (brandRows[0]) {
    const influencerName = campaign_influencer_id
      ? await db.query(
          `SELECT u.name FROM campaign_influencers ci
           JOIN influencers i ON i.id = ci.influencer_id
           JOIN users u ON u.id = i.user_id
           WHERE ci.id = $1`,
          [campaign_influencer_id]
        ).then(r => r.rows[0]?.name || 'an influencer')
      : 'an influencer';

    notificationService.send({
      userId: brandRows[0].user_id,
      type: 'enquiry.submitted',
      title: 'New enquiry!',
      body: `${follower.name} sent an enquiry via ${influencerName}'s recommendation`,
      fcmToken: brandRows[0].fcm_token,
    }).catch(e => console.error('[NOTIFY] enquiry.submitted failed:', e.message));
  }

  return success(res, { enquiry_id: rows[0].id, status: rows[0].status }, 201);
});

// ── GET /brands/me/enquiries ──────────────────────────────────────────────────

const listEnquiries = asyncHandler(async (req, res) => {
  const { rows: brandRows } = await db.query(
    `SELECT id FROM brands WHERE user_id = $1`,
    [req.user.sub]
  );
  if (!brandRows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const brandId = brandRows[0].id;

  const { status } = req.query;

  let sql = `
    SELECT el.*,
      u_f.name  AS follower_name,
      u_f.phone AS follower_phone,
      ci.coupon_code,
      u_i.name  AS influencer_name
    FROM enquiry_leads el
    JOIN followers f    ON f.id    = el.follower_id
    JOIN users u_f      ON u_f.id  = f.user_id
    LEFT JOIN campaign_influencers ci ON ci.id = el.campaign_influencer_id
    LEFT JOIN influencers inf          ON inf.id = ci.influencer_id
    LEFT JOIN users u_i                ON u_i.id = inf.user_id
    WHERE el.brand_id = $1
  `;
  const params = [brandId];

  if (status) {
    sql += ` AND el.status = $2`;
    params.push(status);
  }

  sql += ` ORDER BY el.created_at DESC`;

  const { rows } = await db.query(sql, params);
  return success(res, { enquiries: rows });
});

// ── PATCH /brands/me/enquiries/:id ───────────────────────────────────────────

const updateEnquiry = asyncHandler(async (req, res) => {
  const { rows: brandRows } = await db.query(
    `SELECT id FROM brands WHERE user_id = $1`,
    [req.user.sub]
  );
  if (!brandRows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const brandId = brandRows[0].id;

  const { id } = req.params;
  const { status, deal_value } = req.body;

  // Verify ownership
  const { rows: existing } = await db.query(
    `SELECT el.*, f.user_id AS follower_user_id, u_f.fcm_token AS follower_fcm,
            ci.influencer_id, ci.commission_pct
     FROM enquiry_leads el
     JOIN followers f ON f.id = el.follower_id
     JOIN users u_f   ON u_f.id = f.user_id
     LEFT JOIN campaign_influencers ci ON ci.id = el.campaign_influencer_id
     WHERE el.id = $1 AND el.brand_id = $2`,
    [id, brandId]
  );
  if (!existing[0]) throw new AppError('NOT_FOUND', 'Enquiry not found', 404);

  const enquiry = existing[0];
  const updates = { status };

  let commissionTriggered = enquiry.commission_triggered;
  let commissionAmount = null;

  // If converting with deal_value, trigger influencer commission.
  // deal_value comes in RUPEES post-migration-021; commission_pct is a percent.
  if (status === 'converted' && deal_value && enquiry.influencer_id && !enquiry.commission_triggered) {
    const dealValueRupees = parseFloat(deal_value);
    commissionAmount = parseFloat((dealValueRupees * parseFloat(enquiry.commission_pct || 0) / 100).toFixed(2));

    if (commissionAmount > 0) {
      await db.query(
        `UPDATE influencers SET pending_balance = pending_balance + $1, total_earned = total_earned + $1 WHERE id = $2`,
        [commissionAmount, enquiry.influencer_id]
      );
    }
    commissionTriggered = true;
  }

  const { rows } = await db.query(
    `UPDATE enquiry_leads SET
       status               = COALESCE($1, status),
       deal_value           = COALESCE($2, deal_value),
       commission_triggered = $3
     WHERE id = $4
     RETURNING *`,
    [status || null, deal_value ? parseFloat(deal_value) : null, commissionTriggered, id]
  );

  // Notify follower when responded
  if (status === 'responded') {
    const { rows: brandNameRows } = await db.query(
      `SELECT business_name FROM brands WHERE id = $1`,
      [brandId]
    );
    notificationService.send({
      userId: enquiry.follower_user_id,
      type: 'enquiry.responded',
      title: 'Enquiry update',
      body: `${brandNameRows[0]?.business_name} responded to your enquiry`,
      fcmToken: enquiry.follower_fcm,
    }).catch(e => console.error('[NOTIFY] enquiry.responded failed:', e.message));
  }

  return success(res, { enquiry: rows[0] });
});

module.exports = { submitEnquiry, listEnquiries, updateEnquiry };
