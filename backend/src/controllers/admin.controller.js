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

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/withdrawals?status=all|initiated|processing|completed|failed
// ─────────────────────────────────────────────────────────────────────────────

const getWithdrawals = asyncHandler(async (req, res) => {
  const { status = 'all', search = '', page: rawPage, limit: rawLimit } = req.query;
  const validStatuses = ['all', 'initiated', 'processing', 'completed', 'failed'];
  if (!validStatuses.includes(status)) {
    throw new AppError('VALIDATION_ERROR', 'status must be all, initiated, processing, completed, or failed', 422, 'status');
  }

  const page = Math.max(1, parseInt(rawPage || '1', 10));
  const limit = Math.min(100, parseInt(rawLimit || '50', 10));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (status !== 'all') {
    params.push(status);
    conditions.push(`iw.status = $${params.length}`);
  }

  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const idx = params.length;
    conditions.push(`(LOWER(u.name) LIKE $${idx} OR LOWER(u.phone) LIKE $${idx} OR LOWER(i.instagram_handle) LIKE $${idx})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT
       iw.id, iw.influencer_id, iw.amount_requested, iw.tds_deducted, iw.net_paid,
       iw.method, iw.upi_id, iw.bank_account_no, iw.bank_ifsc,
       iw.razorpay_payout_id, iw.status, iw.created_at, iw.completed_at,
       u.name AS influencer_name, u.phone AS influencer_phone,
       i.instagram_handle
     FROM influencer_withdrawals iw
     JOIN influencers i ON i.id = iw.influencer_id
     JOIN users u ON u.id = i.user_id
     ${where}
     ORDER BY iw.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total
     FROM influencer_withdrawals iw
     JOIN influencers i ON i.id = iw.influencer_id
     JOIN users u ON u.id = i.user_id
     ${where}`,
    params
  );

  // Summary stats
  const { rows: summaryRows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'initiated')  AS pending_count,
       COALESCE(SUM(amount_requested) FILTER (WHERE status = 'initiated'), 0) AS pending_amount,
       COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
       COALESCE(SUM(net_paid) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE), 0) AS today_paid,
       COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) AS today_count
     FROM influencer_withdrawals`
  );

  return success(res, {
    withdrawals: rows,
    summary: summaryRows[0],
  }, 200, { page, limit, total: parseInt(countRows[0].total, 10) });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/withdrawals/:id/process  { action: 'approve' | 'reject', reason? }
// ─────────────────────────────────────────────────────────────────────────────

const processWithdrawal = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('VALIDATION_ERROR', 'action must be approve or reject', 422, 'action');
  }
  if (action === 'reject' && (!reason || !reason.trim())) {
    throw new AppError('VALIDATION_ERROR', 'reason is required when rejecting', 422, 'reason');
  }

  const { rows: wRows } = await db.query(
    `SELECT iw.*, i.user_id, i.wallet_balance, u.name AS influencer_name, u.phone, u.fcm_token
     FROM influencer_withdrawals iw
     JOIN influencers i ON i.id = iw.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE iw.id = $1`,
    [req.params.id]
  );
  if (!wRows[0]) throw new AppError('NOT_FOUND', 'Withdrawal not found', 404);
  const withdrawal = wRows[0];

  if (withdrawal.status !== 'initiated') {
    throw new AppError('CONFLICT', `Cannot ${action} a withdrawal with status "${withdrawal.status}"`, 409);
  }

  if (action === 'reject') {
    // Refund wallet balance
    await db.query(
      `UPDATE influencers SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
      [withdrawal.amount_requested, withdrawal.influencer_id]
    );

    await db.query(
      `UPDATE influencer_withdrawals SET status = 'failed', completed_at = now() WHERE id = $1`,
      [withdrawal.id]
    );

    await notificationService.send({
      userId:   withdrawal.user_id,
      type:     'withdrawal.rejected',
      title:    'Withdrawal Rejected',
      body:     `Your withdrawal of ₹${(parseFloat(withdrawal.amount_requested) / 100).toFixed(2)} was rejected. Reason: ${reason}. Amount returned to wallet.`,
      data:     { screen: 'withdrawals', withdrawal_id: withdrawal.id },
      fcmToken: withdrawal.fcm_token,
      sendSms:  true,
      phone:    withdrawal.phone,
    });

    const { rows: updated } = await db.query(`SELECT * FROM influencer_withdrawals WHERE id = $1`, [withdrawal.id]);
    return success(res, { withdrawal: updated[0], action: 'rejected' });
  }

  // action === 'approve' — trigger payout
  await db.query(
    `UPDATE influencer_withdrawals SET status = 'processing' WHERE id = $1`,
    [withdrawal.id]
  );

  const env = require('../config/env');
  if (env.RAZORPAY_MOCK) {
    const mockPayoutId = `mock_payout_${Date.now()}`;
    await db.query(
      `UPDATE influencer_withdrawals SET status = 'completed', razorpay_payout_id = $1, completed_at = now() WHERE id = $2`,
      [mockPayoutId, withdrawal.id]
    );
    console.log(`[ADMIN][RAZORPAY MOCK] Payout ${mockPayoutId} approved for withdrawal ${withdrawal.id}`);
  } else {
    // In production, the actual payout is handled via Razorpay webhook callback
    // For now, mark as processing — webhook will update to completed/failed
    console.log(`[ADMIN] Withdrawal ${withdrawal.id} approved — awaiting Razorpay payout`);
  }

  await notificationService.send({
    userId:   withdrawal.user_id,
    type:     'withdrawal.approved',
    title:    'Withdrawal Approved',
    body:     `Your withdrawal of ₹${(parseFloat(withdrawal.net_paid) / 100).toFixed(2)} has been approved and is being processed.`,
    data:     { screen: 'withdrawals', withdrawal_id: withdrawal.id },
    fcmToken: withdrawal.fcm_token,
    sendSms:  true,
    phone:    withdrawal.phone,
  });

  const { rows: updated } = await db.query(`SELECT * FROM influencer_withdrawals WHERE id = $1`, [withdrawal.id]);
  return success(res, { withdrawal: updated[0], action: 'approved' });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/brands — full brand directory with filters
// ─────────────────────────────────────────────────────────────────────────────

const getBrands = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit  = Math.min(50, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || 'all';
  const search = (req.query.search || '').trim();

  const conditions = [];
  const params     = [];
  let paramIdx     = 1;

  if (status !== 'all') {
    conditions.push(`u.status = $${paramIdx++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(
      b.business_name ILIKE $${paramIdx} OR
      u.name ILIKE $${paramIdx} OR
      u.phone ILIKE $${paramIdx} OR
      u.city ILIKE $${paramIdx} OR
      b.category ILIKE $${paramIdx}
    )`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Summary counts (unfiltered by search, just by status)
  const { rows: summaryRows } = await db.query(`
    SELECT
      COUNT(*)                                    AS total,
      COUNT(*) FILTER (WHERE u.status = 'approved')  AS approved,
      COUNT(*) FILTER (WHERE u.status = 'pending')   AS pending,
      COUNT(*) FILTER (WHERE u.status = 'rejected')  AS rejected,
      COUNT(*) FILTER (WHERE u.status = 'suspended') AS suspended
    FROM brands b JOIN users u ON u.id = b.user_id
  `);
  const summary = {
    total:     parseInt(summaryRows[0].total, 10),
    approved:  parseInt(summaryRows[0].approved, 10),
    pending:   parseInt(summaryRows[0].pending, 10),
    rejected:  parseInt(summaryRows[0].rejected, 10),
    suspended: parseInt(summaryRows[0].suspended, 10),
  };

  // Count for current filter
  const countQuery = `SELECT COUNT(*) AS total FROM brands b JOIN users u ON u.id = b.user_id ${where}`;
  const { rows: countRows } = await db.query(countQuery, params);
  const total = parseInt(countRows[0].total, 10);

  // Paginated list
  const dataQuery = `
    SELECT b.id, b.business_name, b.category, b.wallet_balance, b.platform_fee_pct,
           b.logo_url, b.created_at,
           u.name AS contact_name, u.phone, u.city, u.status
    FROM brands b
    JOIN users u ON u.id = b.user_id
    ${where}
    ORDER BY b.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;
  const { rows: brands } = await db.query(dataQuery, [...params, limit, offset]);

  return success(res, { brands, summary }, 200, { page, limit, total });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics?days=30
// Time-series, top campaigns/influencers, category breakdown, funnel
// ─────────────────────────────────────────────────────────────────────────────

const getAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(180, Math.max(1, parseInt(req.query.days || '30', 10)));
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  const sinceISO = since.toISOString();

  // Previous period for comparison (same duration before `since`)
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - days);
  const prevSinceISO = prevSince.toISOString();

  // ── 1. Daily signups (brands + influencers) ──────────────────────────────
  const { rows: dailySignups } = await db.query(
    `SELECT
       d::date AS day,
       (SELECT COUNT(*) FROM users u JOIN brands b ON b.user_id = u.id WHERE u.created_at::date = d::date) AS brands,
       (SELECT COUNT(*) FROM users u JOIN influencers i ON i.user_id = u.id WHERE u.created_at::date = d::date) AS influencers
     FROM generate_series($1::date, CURRENT_DATE, '1 day') AS d
     ORDER BY d`,
    [sinceISO]
  );

  // ── 2. Daily transactions & revenue ──────────────────────────────────────
  const { rows: dailyTransactions } = await db.query(
    `SELECT
       d::date AS day,
       (SELECT COUNT(*) FROM follower_transactions WHERE status = 'completed' AND created_at::date = d::date) AS transactions,
       (SELECT COALESCE(SUM(platform_fee), 0) FROM follower_transactions WHERE status = 'completed' AND created_at::date = d::date) +
       (SELECT COALESCE(SUM(platform_fee_amount), 0) FROM escrow_entries WHERE status = 'released' AND released_at::date = d::date) AS revenue
     FROM generate_series($1::date, CURRENT_DATE, '1 day') AS d
     ORDER BY d`,
    [sinceISO]
  );

  // ── 3. Period comparison: current vs previous ────────────────────────────
  const { rows: periodRows } = await db.query(
    `SELECT
       -- Current period
       (SELECT COUNT(*) FROM users WHERE created_at >= $1) AS current_users,
       (SELECT COUNT(*) FROM follower_transactions WHERE status = 'completed' AND created_at >= $1) AS current_transactions,
       (SELECT COALESCE(SUM(platform_fee), 0) FROM follower_transactions WHERE status = 'completed' AND created_at >= $1) +
       (SELECT COALESCE(SUM(platform_fee_amount), 0) FROM escrow_entries WHERE status = 'released' AND released_at >= $1) AS current_revenue,
       (SELECT COUNT(*) FROM campaigns WHERE status IN ('active','live') AND created_at >= $1) AS current_active_campaigns,
       -- Previous period
       (SELECT COUNT(*) FROM users WHERE created_at >= $2 AND created_at < $1) AS prev_users,
       (SELECT COUNT(*) FROM follower_transactions WHERE status = 'completed' AND created_at >= $2 AND created_at < $1) AS prev_transactions,
       (SELECT COALESCE(SUM(platform_fee), 0) FROM follower_transactions WHERE status = 'completed' AND created_at >= $2 AND created_at < $1) +
       (SELECT COALESCE(SUM(platform_fee_amount), 0) FROM escrow_entries WHERE status = 'released' AND released_at >= $2 AND released_at < $1) AS prev_revenue,
       (SELECT COUNT(*) FROM campaigns WHERE status IN ('active','live') AND created_at >= $2 AND created_at < $1) AS prev_active_campaigns`,
    [sinceISO, prevSinceISO]
  );

  const p = periodRows[0];

  function pctChange(cur, prev) {
    const c = parseFloat(cur) || 0;
    const v = parseFloat(prev) || 0;
    if (v === 0) return c > 0 ? 100 : 0;
    return Math.round(((c - v) / v) * 100);
  }

  const comparison = {
    users:            { current: parseInt(p.current_users), previous: parseInt(p.prev_users), change: pctChange(p.current_users, p.prev_users) },
    transactions:     { current: parseInt(p.current_transactions), previous: parseInt(p.prev_transactions), change: pctChange(p.current_transactions, p.prev_transactions) },
    revenue:          { current: parseFloat(p.current_revenue), previous: parseFloat(p.prev_revenue), change: pctChange(p.current_revenue, p.prev_revenue) },
    active_campaigns: { current: parseInt(p.current_active_campaigns), previous: parseInt(p.prev_active_campaigns), change: pctChange(p.current_active_campaigns, p.prev_active_campaigns) },
  };

  // ── 4. Top campaigns ────────────────────────────────────────────────────
  const { rows: topCampaigns } = await db.query(
    `SELECT
       c.id, c.name, c.status, c.category,
       u.name AS brand_name,
       COUNT(ft.id) AS follower_transactions,
       COALESCE(SUM(ft.platform_fee), 0) AS revenue
     FROM campaigns c
     JOIN brands b ON b.id = c.brand_id
     JOIN users u ON u.id = b.user_id
     LEFT JOIN campaign_sets cs ON cs.campaign_id = c.id
     LEFT JOIN campaign_influencers ci ON ci.set_id = cs.id
     LEFT JOIN follower_transactions ft ON ft.campaign_id = c.id AND ft.status = 'completed'
     WHERE c.created_at >= $1
     GROUP BY c.id, c.name, c.status, c.category, u.name
     ORDER BY follower_transactions DESC, revenue DESC
     LIMIT 10`,
    [sinceISO]
  );

  // ── 5. Top influencers ───────────────────────────────────────────────────
  const { rows: topInfluencers } = await db.query(
    `SELECT
       i.id, i.instagram_handle, i.followers_count,
       u.name,
       COUNT(DISTINCT ci.id) FILTER (WHERE ci.status = 'completed') AS campaigns_completed,
       COALESCE(SUM(ft.influencer_commission), 0) AS total_earnings
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     LEFT JOIN campaign_influencers ci ON ci.influencer_id = i.id
     LEFT JOIN follower_transactions ft ON ft.influencer_id = i.id AND ft.status = 'completed'
     WHERE u.status = 'approved'
     GROUP BY i.id, i.instagram_handle, i.followers_count, u.name
     ORDER BY total_earnings DESC
     LIMIT 10`
  );

  // ── 6. Category breakdown ────────────────────────────────────────────────
  const { rows: categories } = await db.query(
    `SELECT COALESCE(category, 'uncategorized') AS category, COUNT(*) AS count
     FROM campaigns
     WHERE created_at >= $1
     GROUP BY category
     ORDER BY count DESC`,
    [sinceISO]
  );

  // ── 7. Campaign funnel ───────────────────────────────────────────────────
  const { rows: funnelRows } = await db.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'draft') AS draft,
       COUNT(*) FILTER (WHERE status IN ('pending_wallet','published')) AS published,
       COUNT(*) FILTER (WHERE status IN ('active','live')) AS active,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
     FROM campaigns`
  );

  const f = funnelRows[0];
  const funnel = {
    total: parseInt(f.total),
    draft: parseInt(f.draft),
    published: parseInt(f.published),
    active: parseInt(f.active),
    completed: parseInt(f.completed),
    cancelled: parseInt(f.cancelled),
  };

  // ── 8. Overall totals for overview cards ─────────────────────────────────
  const { rows: totalsRows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM users) AS total_users,
       (SELECT COUNT(*) FROM campaigns WHERE status IN ('active','live')) AS total_active_campaigns,
       (SELECT COALESCE(SUM(platform_fee), 0) FROM follower_transactions WHERE status = 'completed') +
       (SELECT COALESCE(SUM(platform_fee_amount), 0) FROM escrow_entries WHERE status = 'released') AS total_revenue`
  );
  const totals = totalsRows[0];

  // Conversion rate: completed campaigns / total campaigns
  const conversionRate = funnel.total > 0
    ? Math.round((funnel.completed / funnel.total) * 100)
    : 0;

  return success(res, {
    days,
    overview: {
      total_revenue: parseFloat(totals.total_revenue),
      active_campaigns: parseInt(totals.total_active_campaigns),
      total_users: parseInt(totals.total_users),
      conversion_rate: conversionRate,
    },
    comparison,
    daily_signups: dailySignups.map(r => ({
      day: r.day, brands: parseInt(r.brands), influencers: parseInt(r.influencers),
    })),
    daily_transactions: dailyTransactions.map(r => ({
      day: r.day, transactions: parseInt(r.transactions), revenue: parseFloat(r.revenue),
    })),
    top_campaigns: topCampaigns.map(r => ({
      id: r.id, name: r.name, status: r.status, category: r.category,
      brand_name: r.brand_name,
      follower_transactions: parseInt(r.follower_transactions),
      revenue: parseFloat(r.revenue),
    })),
    top_influencers: topInfluencers.map(r => ({
      id: r.id, name: r.name, handle: r.instagram_handle,
      followers: parseInt(r.followers_count),
      campaigns_completed: parseInt(r.campaigns_completed),
      total_earnings: parseFloat(r.total_earnings),
    })),
    categories,
    funnel,
  });
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
  getWithdrawals,
  processWithdrawal,
  getBrands,
  getAnalytics,
};
