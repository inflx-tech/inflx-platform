'use strict';

const db                  = require('../config/db');
const multer              = require('multer');
const { parse }           = require('csv-parse/sync');
const notificationService = require('../services/notification.service');
const paymentConfigSvc    = require('../services/paymentConfig.service');
const { success }         = require('../utils/response');
const AppError            = require('../utils/AppError');
const asyncHandler        = require('../utils/asyncHandler');

// Multer: memory storage, CSV/Excel only, max 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new AppError('VALIDATION_ERROR', 'Only CSV files are supported', 422, 'file'));
    }
  },
});
// Export multer middleware for use in route
const uploadMiddleware = upload.single('file');

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/queue/brands
// ─────────────────────────────────────────────────────────────────────────────

const getBrandQueue = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  const { rows: brands } = await db.query(
    `SELECT b.*, u.status AS user_status, u.phone, u.name, u.created_at AS user_created_at
     FROM brands b
     JOIN users u ON u.id = b.user_id
     WHERE u.status = 'pending'
     ORDER BY b.created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total FROM brands b JOIN users u ON u.id = b.user_id WHERE u.status = 'pending'`
  );

  return success(
    res,
    { brands },
    200,
    { page, limit, total: parseInt(countRows[0].total, 10) }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/queue/influencers
// ─────────────────────────────────────────────────────────────────────────────

const getInfluencerQueue = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  const { rows: influencers } = await db.query(
    `SELECT i.id, i.instagram_handle, i.followers_count, i.engagement_rate,
            i.niche, i.language, i.content_style, i.created_at,
            u.status AS user_status, u.phone, u.name
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE u.status = 'pending'
     ORDER BY i.created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total FROM influencers i JOIN users u ON u.id = i.user_id WHERE u.status = 'pending'`
  );

  return success(
    res,
    { influencers },
    200,
    { page, limit, total: parseInt(countRows[0].total, 10) }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/brands/:id/status
// ─────────────────────────────────────────────────────────────────────────────

const updateBrandStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const adminUserId = req.user.sub;

  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    throw new AppError('VALIDATION_ERROR', 'status must be approved, rejected, or suspended', 422, 'status');
  }
  if (status === 'rejected' && !reason) {
    throw new AppError('VALIDATION_ERROR', 'reason is required when rejecting', 422, 'reason');
  }

  const { rows: brandRows } = await db.query(
    `SELECT b.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM brands b JOIN users u ON u.id = b.user_id
     WHERE b.id = $1`,
    [req.params.id]
  );
  if (!brandRows.length) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  const brand = brandRows[0];

  if (status === 'approved') {
    await db.query(
      `UPDATE brands SET rejection_reason = NULL, approved_at = now(), approved_by = $2 WHERE id = $1`,
      [brand.id, adminUserId]
    );
  } else {
    await db.query(
      `UPDATE brands SET rejection_reason = $2, approved_at = NULL, approved_by = NULL WHERE id = $1`,
      [brand.id, reason || null]
    );
  }

  await db.query(`UPDATE users SET status = $1 WHERE id = $2`, [status, brand.user_id]);

  const { rows: updated } = await db.query(
    `SELECT b.*, u.status AS user_status FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [brand.id]
  );

  const templates = {
    approved: { type: 'account.approved', title: 'Account Approved', body: 'Your brand account is approved. Start creating campaigns!' },
    rejected: { type: 'account.rejected', title: 'Account Needs More Info', body: `Your account needs more info. Reason: ${reason}` },
    suspended: { type: 'account.suspended', title: 'Account Suspended', body: 'Your account has been suspended. Please contact support.' },
  };
  const tpl = templates[status];

  await notificationService.send({
    userId: brand.user_id,
    type: tpl.type,
    title: tpl.title,
    body: tpl.body,
    data: { screen: 'brand_dashboard' },
    fcmToken: brand.fcm_token,
    sendSms: true,
    phone: brand.phone,
  });

  return success(res, { brand: updated[0], notification_sent: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/influencers/:id/status
// ─────────────────────────────────────────────────────────────────────────────

const updateInfluencerStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const adminUserId = req.user.sub;

  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    throw new AppError('VALIDATION_ERROR', 'status must be approved, rejected, or suspended', 422, 'status');
  }
  if (status === 'rejected' && !reason) {
    throw new AppError('VALIDATION_ERROR', 'reason is required when rejecting', 422, 'reason');
  }

  const { rows: infRows } = await db.query(
    `SELECT i.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM influencers i JOIN users u ON u.id = i.user_id
     WHERE i.id = $1`,
    [req.params.id]
  );
  if (!infRows.length) throw new AppError('NOT_FOUND', 'Influencer not found', 404);
  const influencer = infRows[0];

  if (status === 'approved') {
    await db.query(
      `UPDATE influencers SET rejection_reason = NULL, approved_at = now(), approved_by = $2 WHERE id = $1`,
      [influencer.id, adminUserId]
    );
  } else {
    await db.query(
      `UPDATE influencers SET rejection_reason = $2, approved_at = NULL, approved_by = NULL WHERE id = $1`,
      [influencer.id, reason || null]
    );
  }

  await db.query(`UPDATE users SET status = $1 WHERE id = $2`, [status, influencer.user_id]);

  const { rows: updated } = await db.query(
    `SELECT i.*, u.status AS user_status FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
    [influencer.id]
  );

  const templates = {
    approved: { type: 'account.approved', title: 'Account Approved', body: "You're on INFLX! Check your pending offer invites." },
    rejected: { type: 'account.rejected', title: 'Account Needs More Info', body: `Your account needs more info. Reason: ${reason}` },
    suspended: { type: 'account.suspended', title: 'Account Suspended', body: 'Your account has been suspended.' },
  };
  const tpl = templates[status];

  await notificationService.send({
    userId: influencer.user_id,
    type: tpl.type,
    title: tpl.title,
    body: tpl.body,
    data: { screen: 'influencer_home' },
    fcmToken: influencer.fcm_token,
    sendSms: true,
    phone: influencer.phone,
  });

  return success(res, { influencer: updated[0], notification_sent: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/stats  (Phase 5 — replaces Phase 1 version)
// ─────────────────────────────────────────────────────────────────────────────

const getStats = asyncHandler(async (req, res) => {
  const { rows: counts } = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM users u JOIN brands b ON b.user_id = u.id WHERE u.status = 'pending')      AS pending_brands,
      (SELECT COUNT(*) FROM users u JOIN influencers i ON i.user_id = u.id WHERE u.status = 'pending')  AS pending_influencers,
      (SELECT COUNT(*) FROM brands)                                                                      AS total_brands,
      (SELECT COUNT(*) FROM influencers)                                                                 AS total_influencers,
      (SELECT COUNT(*) FROM followers)                                                                   AS total_followers,
      (SELECT COUNT(*) FROM campaigns WHERE status = 'live')                                             AS live_campaigns,
      (SELECT COUNT(*) FROM campaigns)                                                                   AS total_campaigns,
      (SELECT COUNT(*) FROM users u JOIN brands b ON b.user_id = u.id WHERE u.status = 'approved')      AS active_brands,
      (SELECT COUNT(*) FROM users u JOIN influencers i ON i.user_id = u.id WHERE u.status = 'approved') AS active_influencers,
      (SELECT COUNT(*) FROM campaigns WHERE status IN ('active', 'live'))                                AS active_campaigns,
      (SELECT COUNT(*) FROM follower_transactions WHERE status = 'completed')                            AS total_follower_transactions,
      (SELECT COALESCE(SUM(influencer_commission), 0) FROM follower_transactions
       WHERE status = 'completed' AND commission_confirmed_at IS NOT NULL)                               AS total_commission_paid,
      (SELECT COALESCE(SUM(amount), 0) FROM escrow_entries WHERE status = 'locked')                     AS escrow_locked,
      (SELECT COALESCE(SUM(amount), 0) FROM escrow_entries WHERE status = 'queued')                     AS escrow_queued
  `);

  const r = counts[0];

  // Platform revenue this month: follower platform fees + released escrow platform fees
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const { rows: revenueRows } = await db.query(
    `SELECT
       (SELECT COALESCE(SUM(platform_fee), 0) FROM follower_transactions
        WHERE created_at >= $1 AND status = 'completed') +
       (SELECT COALESCE(SUM(platform_fee_amount), 0) FROM escrow_entries
        WHERE released_at >= $1 AND status = 'released') AS platform_revenue_this_month`,
    [thisMonthStart.toISOString()]
  );

  // Flat stats object (Phase 1 shape — kept for backward compat)
  const stats = {};
  ['pending_brands', 'pending_influencers', 'total_brands', 'total_influencers',
   'total_followers', 'live_campaigns', 'total_campaigns', 'active_brands',
   'active_influencers', 'active_campaigns', 'total_follower_transactions'].forEach(k => {
    stats[k] = parseInt(r[k], 10);
  });

  return success(res, {
    // Phase 1 backward-compatible wrapper
    stats,
    // Phase 5 additions (also at top level for new consumers)
    pending_approvals: {
      brands: parseInt(r.pending_brands),
      influencers: parseInt(r.pending_influencers),
    },
    active_brands:   parseInt(r.active_brands),
    active_influencers: parseInt(r.active_influencers),
    active_campaigns: parseInt(r.active_campaigns),
    platform_revenue_this_month: parseFloat(revenueRows[0].platform_revenue_this_month),
    total_follower_transactions: parseInt(r.total_follower_transactions),
    total_commission_paid: parseFloat(r.total_commission_paid),
    escrow_locked: parseFloat(r.escrow_locked),
    escrow_queued: parseFloat(r.escrow_queued),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/escrow
// ─────────────────────────────────────────────────────────────────────────────

const getEscrowOverview = asyncHandler(async (req, res) => {
  const { status = 'all' } = req.query;
  const validStatuses = ['queued', 'locked', 'released', 'all'];
  if (!validStatuses.includes(status)) {
    throw new AppError('VALIDATION_ERROR', 'status must be queued, locked, released, or all', 422, 'status');
  }

  const conditions = [];
  const params = [];
  if (status !== 'all') {
    params.push(status);
    conditions.push(`ee.status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT
       ee.id, ee.tranche_number, ee.amount, ee.net_to_influencer,
       ee.platform_fee_amount, ee.status, ee.trigger_event,
       ee.triggered_at, ee.released_at, ee.razorpay_payout_id,
       c.name AS campaign_name,
       u_inf.name AS influencer_name,
       u_brand.name AS brand_name
     FROM escrow_entries ee
     JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u_inf ON u_inf.id = i.user_id
     JOIN brands b ON b.id = c.brand_id
     JOIN users u_brand ON u_brand.id = b.user_id
     ${where}
     ORDER BY ee.triggered_at DESC NULLS LAST, ee.tranche_number ASC`,
    params
  );

  return success(res, { escrow_entries: rows, count: rows.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/escrow/:id/release
// ─────────────────────────────────────────────────────────────────────────────

const adminReleaseEscrow = asyncHandler(async (req, res) => {
  const { override_reason } = req.body;
  if (!override_reason || !override_reason.trim()) {
    throw new AppError('VALIDATION_ERROR', 'override_reason is required', 422, 'override_reason');
  }

  const { rows: entryRows } = await db.query(
    `SELECT ee.*, ci.influencer_id, cs.campaign_id, c.brand_id
     FROM escrow_entries ee
     JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     WHERE ee.id = $1`,
    [req.params.id]
  );
  if (!entryRows[0]) throw new AppError('NOT_FOUND', 'Escrow entry not found', 404);
  const entry = entryRows[0];

  if (entry.status === 'released') {
    throw new AppError('CONFLICT', 'Escrow entry already released', 409);
  }

  const escrowService = require('../services/escrow.service');
  await escrowService.processTrancheReleaseStandalone(entry.id);

  console.log(`[ADMIN] Manual escrow release: entry ${entry.id} by admin ${req.user.sub}. Reason: ${override_reason}`);

  const { rows: updated } = await db.query(
    `SELECT * FROM escrow_entries WHERE id = $1`,
    [entry.id]
  );

  return success(res, { escrow_entry: updated[0], override_reason });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users  (superadmin only)
// ─────────────────────────────────────────────────────────────────────────────

const getAdminUsers = asyncHandler(async (req, res) => {
  const { rows: admin_users } = await db.query(
    `SELECT u.id, u.phone, u.name, u.status, u.created_at, ap.admin_role
     FROM users u
     JOIN admin_profiles ap ON ap.user_id = u.id
     WHERE u.role = 'admin'
     ORDER BY u.created_at ASC`
  );

  return success(res, { admin_users });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/users  (superadmin only)
// ─────────────────────────────────────────────────────────────────────────────

const createAdminUser = asyncHandler(async (req, res) => {
  const { phone, name, admin_role } = req.body;

  if (!phone) throw new AppError('VALIDATION_ERROR', 'phone is required', 422, 'phone');
  if (!name || !name.trim()) throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  if (!['superadmin', 'reviewer', 'finance'].includes(admin_role)) {
    throw new AppError('VALIDATION_ERROR', 'admin_role must be superadmin, reviewer, or finance', 422, 'admin_role');
  }

  const { rows: userRows } = await db.query(
    `INSERT INTO users (phone, role, name, status)
     VALUES ($1, 'admin', $2, 'approved')
     RETURNING *`,
    [phone, name.trim()]
  );
  const user = userRows[0];

  await db.query(
    `INSERT INTO admin_profiles (user_id, admin_role, created_by)
     VALUES ($1, $2, $3)`,
    [user.id, admin_role, req.user.sub]
  );

  return success(res, {
    admin_user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      admin_role,
      status: user.status,
      created_at: user.created_at,
    },
  }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/influencers/bulk-upload  (reviewer+)
// Accepts a CSV file with columns:
//   full_name*, phone*, instagram_handle*, tier, city, state, gender,
//   niche, secondary_niche, followers_count, engagement_rate, platform,
//   avg_views, avg_likes, avg_comments, verified, language
// Returns { created, updated, failed, errors[] }
// ─────────────────────────────────────────────────────────────────────────────

const bulkUploadInfluencers = [
  uploadMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('VALIDATION_ERROR', 'CSV file is required (field name: file)', 422, 'file');
    }

    let records;
    try {
      records = parse(req.file.buffer.toString('utf8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e) {
      throw new AppError('VALIDATION_ERROR', `CSV parse error: ${e.message}`, 422, 'file');
    }

    if (!records.length) {
      throw new AppError('VALIDATION_ERROR', 'CSV file is empty', 422, 'file');
    }

    const VALID_TIERS    = ['nano', 'micro', 'macro', 'mega'];
    const VALID_GENDERS  = ['male', 'female', 'other', ''];
    const VALID_PLATFORMS = ['Instagram', 'YouTube', 'Both', ''];

    let created = 0;
    let updated = 0;
    const errors = [];

    for (let rowIdx = 0; rowIdx < records.length; rowIdx++) {
      const row = records[rowIdx];
      const rowNum = rowIdx + 2; // 1-indexed + header

      // Required field validation
      const full_name = (row.full_name || '').trim();
      const phone     = (row.phone || '').trim();
      const handle    = (row.instagram_handle || '').trim();

      if (!full_name) { errors.push({ row: rowNum, error: 'full_name is required' }); continue; }
      if (!phone)     { errors.push({ row: rowNum, error: 'phone is required' });     continue; }
      if (!handle)    { errors.push({ row: rowNum, error: 'instagram_handle is required' }); continue; }

      const tier = (row.tier || 'micro').toLowerCase();
      if (!VALID_TIERS.includes(tier)) {
        errors.push({ row: rowNum, error: `Invalid tier "${tier}". Must be nano/micro/macro/mega` });
        continue;
      }

      const gender = (row.gender || '').toLowerCase();
      if (!VALID_GENDERS.includes(gender)) {
        errors.push({ row: rowNum, error: `Invalid gender "${gender}"` });
        continue;
      }

      const platform = (row.platform || 'Instagram');
      if (!VALID_PLATFORMS.includes(platform)) {
        errors.push({ row: rowNum, error: `Invalid platform "${platform}"` });
        continue;
      }

      // Parse array fields (comma-separated)
      const parseArr = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);
      const niche           = parseArr(row.niche);
      const secondary_niche = parseArr(row.secondary_niche);
      const language        = parseArr(row.language);

      const followers_count  = parseInt(row.followers_count, 10)  || 0;
      const engagement_rate  = parseFloat(row.engagement_rate)    || 0;
      const avg_views        = parseInt(row.avg_views, 10)        || 0;
      const avg_likes        = parseInt(row.avg_likes, 10)        || 0;
      const avg_comments     = parseInt(row.avg_comments, 10)     || 0;
      const verified         = ['true', '1', 'yes'].includes((row.verified || '').toLowerCase());

      try {
        // Upsert user row
        const { rows: userRows } = await db.query(
          `INSERT INTO users (phone, role, status, name)
           VALUES ($1, 'influencer', 'approved', $2)
           ON CONFLICT (phone) DO UPDATE
             SET name = EXCLUDED.name, status = EXCLUDED.status
           RETURNING id, xmax`,
          [phone, full_name]
        );
        const user = userRows[0];
        const isNewUser = parseInt(user.xmax, 10) === 0;

        // Upsert influencer row
        const { rows: infRows } = await db.query(
          `INSERT INTO influencers (
             user_id, instagram_handle, full_name, tier,
             followers_count, engagement_rate, niche, secondary_niche,
             city, state, gender, platform,
             avg_views, avg_likes, avg_comments, verified, language
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT (user_id) DO UPDATE SET
             instagram_handle  = EXCLUDED.instagram_handle,
             full_name         = EXCLUDED.full_name,
             tier              = EXCLUDED.tier,
             followers_count   = EXCLUDED.followers_count,
             engagement_rate   = EXCLUDED.engagement_rate,
             niche             = EXCLUDED.niche,
             secondary_niche   = EXCLUDED.secondary_niche,
             city              = EXCLUDED.city,
             state             = EXCLUDED.state,
             gender            = EXCLUDED.gender,
             platform          = EXCLUDED.platform,
             avg_views         = EXCLUDED.avg_views,
             avg_likes         = EXCLUDED.avg_likes,
             avg_comments      = EXCLUDED.avg_comments,
             verified          = EXCLUDED.verified,
             language          = EXCLUDED.language
           RETURNING xmax`,
          [
            user.id, handle, full_name, tier,
            followers_count, engagement_rate, niche, secondary_niche,
            (row.city || '').trim() || null, (row.state || '').trim() || null,
            gender || null, platform,
            avg_views, avg_likes, avg_comments, verified, language,
          ]
        );

        const isNewInfluencer = parseInt(infRows[0].xmax, 10) === 0 && isNewUser;
        if (isNewInfluencer) created++; else updated++;

      } catch (e) {
        errors.push({ row: rowNum, phone, error: e.message });
      }
    }

    return success(res, {
      total: records.length,
      created,
      updated,
      failed: errors.length,
      errors,
    }, 200);
  }),
];

// ─────────────────────────────────────────────────────────────────────────────
// GET  /admin/config/payments  — return current payment config (superadmin)
// PATCH /admin/config/payments  — update payment config (superadmin)
// ─────────────────────────────────────────────────────────────────────────────

const getPaymentConfig = asyncHandler(async (req, res) => {
  const cfg = await paymentConfigSvc.getConfig();
  // Also return raw DB row so UI can show updated_at / updated_by
  const { rows } = await db.query(
    `SELECT pc.*, u.name AS updated_by_name
     FROM payment_config pc
     LEFT JOIN users u ON u.id = pc.updated_by
     WHERE pc.id = 1`
  );
  return success(res, { config: cfg, raw: rows[0] || null });
});

const updatePaymentConfig = asyncHandler(async (req, res) => {
  const {
    platform_fee_pct, tranche_1_pct, tranche_2_pct, tranche_3_pct,
    tds_pct, offer_expiry_hours, return_window_days, min_withdrawal_inr,
  } = req.body;

  try {
    await paymentConfigSvc.updateConfig({
      platform_fee_pct, tranche_1_pct, tranche_2_pct, tranche_3_pct,
      tds_pct, offer_expiry_hours, return_window_days, min_withdrawal_inr,
    }, req.user.sub);
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  const cfg = await paymentConfigSvc.getConfig();
  return success(res, { config: cfg, message: 'Payment config updated successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/brands/:id/platform-fee  (finance+ override per-brand fee %)
// ─────────────────────────────────────────────────────────────────────────────

const setBrandPlatformFee = asyncHandler(async (req, res) => {
  const { platform_fee_pct } = req.body;
  const fee = parseFloat(platform_fee_pct);
  if (isNaN(fee) || fee < 0 || fee > 50) {
    throw new AppError('VALIDATION_ERROR', 'platform_fee_pct must be 0–50', 422, 'platform_fee_pct');
  }

  const { rows } = await db.query(
    `UPDATE brands SET platform_fee_pct = $1 WHERE id = $2 RETURNING id, platform_fee_pct`,
    [fee.toFixed(2), req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);

  return success(res, { brand_id: rows[0].id, platform_fee_pct: rows[0].platform_fee_pct });
});

module.exports = {
  getBrandQueue,
  getInfluencerQueue,
  updateBrandStatus,
  updateInfluencerStatus,
  getStats,
  getEscrowOverview,
  adminReleaseEscrow,
  getAdminUsers,
  createAdminUser,
  bulkUploadInfluencers,
  getPaymentConfig,
  updatePaymentConfig,
  setBrandPlatformFee,
};
