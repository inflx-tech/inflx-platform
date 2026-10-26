'use strict';

const db                  = require('../config/db');
const multer              = require('multer');
const { parse }           = require('csv-parse/sync');
const notificationService = require('../services/notification.service');
const paymentConfigSvc    = require('../services/paymentConfig.service');
const ledgerService       = require('../services/ledger.service');
const { success }         = require('../utils/response');
const AppError            = require('../utils/AppError');
const asyncHandler        = require('../utils/asyncHandler');
// registration-and-profile — approval refuses an incomplete profile; the queues say what is missing.
const completeness        = require('../services/profileCompleteness.service');

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
    // city/state live on users, not brands — the same shape the creator queue has.
    // The queue row shows them, so it has to ask for them.
    // Contract: features/admin-creator-review-completeness
    // registration-and-profile §6.1: submitted accounts first, then the ones still filling in.
    `SELECT b.*, u.status AS user_status, u.phone, u.name, u.email,
            u.city, u.state, u.created_at AS user_created_at
     FROM brands b
     JOIN users u ON u.id = b.user_id
     WHERE u.status = 'pending'
     ORDER BY (b.submitted_for_review_at IS NULL) ASC, b.created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  for (const b of brands) {
    delete b.bank_account_no;
    const c = await completeness.forBrand(b.id);
    b.missing_count = c.missing.length;
    b.missing_fields = c.missing_labels;
  }

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
    // The approvals queue is where the decision actually gets made, and it used to be
    // the thinnest of the three admin screens: handle, follower count, date. A creator
    // hands us five facts at signup — name, phone, city, Instagram, YouTube — and this
    // query returned one and a half of them. City and name are COALESCEd because
    // registration wrote them to the USERS row and left influencers.city NULL for every
    // creator who signed up before 2026-08-26.
    // Contract: features/admin-creator-review-completeness
    `SELECT i.id, i.instagram_handle, i.youtube_handle,
            i.followers_count, i.engagement_rate,
            i.youtube_subscribers, i.youtube_videos, i.youtube_scrape_last_run,
            i.niche, i.niche_other, i.language, i.content_style, i.created_at, i.scrape_last_run,
            i.age, i.gender, i.bio, i.submitted_for_review_at,
            COALESCE(i.full_name, u.name) AS full_name,
            COALESCE(i.city,  u.city)     AS city,
            COALESCE(i.state, u.state)    AS state,
            u.status AS user_status, u.phone, u.name, u.email
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE u.status = 'pending'
     ORDER BY (i.submitted_for_review_at IS NULL) ASC, i.created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  // registration-and-profile §9A: the queue row says how much is missing.
  for (const i of influencers) {
    const c = await completeness.forCreator(i.id);
    i.missing_count = c ? c.missing.length : null;
    i.missing_fields = c ? c.missing_labels : [];
  }

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

  // Suspend only ever applies to an already-approved brand (matches the
  // Live tab, which only ever renders Suspend on approved rows) — a pending
  // or already-rejected brand can't be "suspended". Approve is intentionally
  // left unguarded here: unlike influencers, brands have no separate
  // verification transaction, so this same status='approved' write is the
  // legitimate single path for both Pending Verification's new-signup
  // approve and the Live tab's reinstate-a-suspended-brand action.
  if (status === 'suspended' && brand.user_status !== 'approved') {
    throw new AppError('VALIDATION_ERROR', 'Only an already-approved brand can be suspended.', 422, 'status');
  }

  if (status === 'approved') {
    // Founder, 19 Sep 2026 (amending registration-and-profile §6.3): approval is the team's
    // manual check of the business, not a completeness check — the missing list stays visible
    // on the review page and the profile tab keeps nagging, but never blocks approval here.
    // Approve, or reinstate a suspended/rejected brand. Clears any prior
    // rejection/suspension note and stamps fresh approval provenance.
    await db.query(
      `UPDATE brands SET rejection_reason = NULL, approved_at = now(), approved_by = $2 WHERE id = $1`,
      [brand.id, adminUserId]
    );
  } else if (status === 'rejected') {
    // Rejected — the brand was never approved, so there is no provenance
    // worth keeping.
    await db.query(
      `UPDATE brands SET rejection_reason = $2, approved_at = NULL, approved_by = NULL WHERE id = $1`,
      [brand.id, reason || null]
    );
  } else {
    // Suspended — the brand WAS approved. Keep approved_at/approved_by so
    // the original approval trail survives and a later reinstate still has
    // history to show. Only record the suspension note.
    await db.query(
      `UPDATE brands SET rejection_reason = $2 WHERE id = $1`,
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

  // A NEW signup (user_status='pending') may only ever become 'approved'
  // through creatorVerification.controller.js's verify() — the single-gate
  // fix admin-people-pipeline shipped. This endpoint now exists only to
  // suspend an approved creator or reinstate a suspended one; reusing it to
  // approve a pending row would silently reopen the exact 3-way-duplicate
  // bug that contract closed, and would skip the transaction that keeps
  // creator_profiles.verification_status in sync with influencers/users.
  if (status === 'approved' && influencer.user_status !== 'suspended') {
    throw new AppError(
      'VALIDATION_ERROR',
      'A new signup can only be approved from Influencers → Pending Verification, not this endpoint. This route now only reinstates a suspended creator.',
      422,
      'status'
    );
  }
  if (status === 'suspended' && influencer.user_status !== 'approved') {
    throw new AppError('VALIDATION_ERROR', 'Only an already-approved creator can be suspended.', 422, 'status');
  }

  if (status === 'approved') {
    // Reinstating a suspended influencer.
    await db.query(
      `UPDATE influencers SET rejection_reason = NULL, approved_at = now(), approved_by = $2 WHERE id = $1`,
      [influencer.id, adminUserId]
    );
  } else if (status === 'rejected') {
    await db.query(
      `UPDATE influencers SET rejection_reason = $2, approved_at = NULL, approved_by = NULL WHERE id = $1`,
      [influencer.id, reason || null]
    );
    // Item 3 (rules v1.11 §5A, founder Q11): a rejected creator leaves every brand's group.
    // A SUSPENDED creator keeps her rows and is only hidden; she reappears when reinstated.
    await require('./influencerGroup.controller').dropFromAllGroups(influencer.id);
  } else {
    // Suspended — preserve the original approval provenance (see the brand
    // handler above for the rationale).
    await db.query(
      `UPDATE influencers SET rejection_reason = $2 WHERE id = $1`,
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
      (SELECT COALESCE(SUM(amount), 0) FROM escrow_entries WHERE status = 'queued')                     AS escrow_queued,
      -- Marketing verification queue: creator_profiles in 'claimed' state
      -- (signup linked them but admin hasn't confirmed identity yet).
      (SELECT COUNT(*) FROM creator_profiles WHERE verification_status = 'claimed')                     AS pending_verifications,
      -- Creator-invitation queue: brands invited unverified creators via the
      -- campaign wizard; admin needs to run cold outreach. Pending = not yet
      -- contacted; contacted = outreach run but creator hasn't signed up yet.
      (SELECT COUNT(*) FROM creator_invitations WHERE status = 'pending')                               AS pending_invitations,
      (SELECT COUNT(*) FROM creator_invitations WHERE status IN ('pending','contacted'))                AS open_invitations,
      -- product-approval-switch: products waiting for INFLX (the Product Queue badge)
      (SELECT COUNT(*) FROM brand_products WHERE approval_status = 'pending')                           AS pending_products
  `);

  const r = counts[0];

  // Platform revenue this month: follower platform fees + released escrow platform fees
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const { rows: revenueRows } = await db.query(
    `SELECT
       (SELECT COALESCE(SUM(marketplace_fee_amount), 0) FROM follower_transactions
        WHERE created_at >= $1 AND status = 'completed') +
       (SELECT COALESCE(SUM(escrow_fee_amount), 0) FROM escrow_entries
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
    pending_verifications: parseInt(r.pending_verifications || 0),
    pending_products:      parseInt(r.pending_products || 0),
    pending_invitations:   parseInt(r.pending_invitations || 0),
    open_invitations:      parseInt(r.open_invitations || 0),
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
       ee.escrow_fee_amount, ee.status, ee.trigger_event,
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

// Item 12 (approval Q13) — kept for item 18, which will settle disputes with it, but no longer a
// console-only door: the reason is REQUIRED and STORED (escrow_manual_releases, migration 192)
// in the same transaction as the release, and a disputed or refunded row is refused — nothing
// that has been taken out of the ordinary path is paid by hand.
const adminReleaseEscrow = asyncHandler(async (req, res) => {
  const { MSG: MSG12 } = require('../services/contentCopy');
  const reason = String((req.body && req.body.override_reason) || '').trim();
  if (reason.length < 5 || reason.length > 500) {
    throw new AppError('VALIDATION_ERROR', MSG12.RELEASE_REASON_REQUIRED, 422, 'override_reason');
  }

  const escrowService = require('../services/escrow.service');
  const out = await db.withTransaction(async (client) => {
    const { rows: [entry] } = await client.query(
      `SELECT ee.*, ci.influencer_id, cs.campaign_id, c.brand_id
         FROM escrow_entries ee
         JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
         JOIN campaign_sets cs ON cs.id = ci.set_id
         JOIN campaigns c ON c.id = cs.campaign_id
        WHERE ee.id = $1
        FOR UPDATE OF ee`,
      [req.params.id]
    );
    if (!entry) throw new AppError('NOT_FOUND', 'Escrow entry not found', 404);
    if (entry.status === 'released') throw new AppError('CONFLICT', 'Escrow entry already released', 409);
    if (entry.status === 'disputed' || entry.status === 'refunded') {
      throw new AppError('RELEASE_NOT_ALLOWED', MSG12.RELEASE_NOT_ALLOWED(entry.status), 422, 'status');
    }

    await escrowService.processTrancheRelease(client, entry.id, entry.influencer_id, entry.brand_id, entry.campaign_id);
    await client.query(
      `INSERT INTO escrow_manual_releases (escrow_entry_id, tranche_number, amount, admin_user_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.id, entry.tranche_number, entry.amount, req.user.sub, reason]
    );
    const { rows: [updated] } = await client.query(`SELECT * FROM escrow_entries WHERE id = $1`, [entry.id]);
    return updated;
  });

  return success(res, { escrow_entry: out, override_reason: reason });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users  (superadmin only)
// ─────────────────────────────────────────────────────────────────────────────

const getAdminUsers = asyncHandler(async (req, res) => {
  const { rows: admin_users } = await db.query(
    `SELECT u.id, u.phone, u.name, u.status, u.created_at,
            ap.admin_role, ap.capabilities, ap.active
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

// ─── Admin capability catalog (B-2) ──────────────────────────────────────────
// Owned by config/adminCapabilities.js. createAdminUser/updateAdminUser
// validate capabilities[] against it; GET /admin/capabilities exposes it so
// the UI builds checkboxes without hardcoding keys.
const adminCaps = require('../config/adminCapabilities');

// Validate a capabilities payload → cleaned, deduped, catalog-valid array.
// Throws VALIDATION_ERROR on any unknown key. Returns [] for null/undefined.
function sanitizeCapabilities(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new AppError('VALIDATION_ERROR', 'capabilities must be an array of keys', 422, 'capabilities');
  }
  const cleaned = [];
  for (const k of raw) {
    if (typeof k !== 'string') {
      throw new AppError('VALIDATION_ERROR', 'capabilities must be an array of string keys', 422, 'capabilities');
    }
    if (!adminCaps.isValidCapability(k)) {
      throw new AppError('VALIDATION_ERROR', `Unknown capability "${k}"`, 422, 'capabilities');
    }
    if (!cleaned.includes(k)) cleaned.push(k);
  }
  return cleaned;
}

const createAdminUser = asyncHandler(async (req, res) => {
  const { phone, name, admin_role = 'reviewer', capabilities } = req.body;

  if (!phone) throw new AppError('VALIDATION_ERROR', 'phone is required', 422, 'phone');
  if (!name || !name.trim()) throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  if (!['superadmin', 'reviewer', 'finance'].includes(admin_role)) {
    throw new AppError('VALIDATION_ERROR', 'admin_role must be superadmin, reviewer, or finance', 422, 'admin_role');
  }

  // If capabilities omitted, seed from the base-role defaults so the new
  // admin's section access matches the role they were given. superadmin
  // bypasses checks regardless, but we still store the full key set for an
  // honest UI.
  const caps = capabilities === undefined
    ? adminCaps.defaultCapsForRole(admin_role)
    : sanitizeCapabilities(capabilities);

  const { rows: userRows } = await db.query(
    `INSERT INTO users (phone, role, name, status)
     VALUES ($1, 'admin', $2, 'approved')
     RETURNING *`,
    [phone, name.trim()]
  );
  const user = userRows[0];

  await db.query(
    `INSERT INTO admin_profiles (user_id, admin_role, capabilities, created_by)
     VALUES ($1, $2, $3, $4)`,
    [user.id, admin_role, caps, req.user.sub]
  );

  return success(res, {
    admin_user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      admin_role,
      capabilities: caps,
      active: true,
      status: user.status,
      created_at: user.created_at,
    },
  }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/users/:id  (superadmin only)
// Change a staff admin's base role, capabilities, and/or active flag.
// Privilege escalation is structurally impossible: this route is mounted
// behind requireAdminRole('superadmin'), so only a superadmin can call it.
// Body: { admin_role?, capabilities?[], active? } — any subset.
// ─────────────────────────────────────────────────────────────────────────────

const updateAdminUser = asyncHandler(async (req, res) => {
  const { admin_role, capabilities, active } = req.body;

  const { rows: existRows } = await db.query(
    `SELECT u.id, ap.admin_role
     FROM users u JOIN admin_profiles ap ON ap.user_id = u.id
     WHERE u.id = $1 AND u.role = 'admin'`,
    [req.params.id]
  );
  if (!existRows[0]) throw new AppError('NOT_FOUND', 'Admin user not found', 404);

  const sets = [];
  const params = [];
  let idx = 1;

  if (admin_role !== undefined) {
    if (!['superadmin', 'reviewer', 'finance'].includes(admin_role)) {
      throw new AppError('VALIDATION_ERROR', 'admin_role must be superadmin, reviewer, or finance', 422, 'admin_role');
    }
    sets.push(`admin_role = $${idx++}`);
    params.push(admin_role);
  }

  if (capabilities !== undefined) {
    const caps = sanitizeCapabilities(capabilities);
    sets.push(`capabilities = $${idx++}`);
    params.push(caps);
  }

  if (active !== undefined) {
    const flag = active === true || active === 'true';
    sets.push(`active = $${idx++}`);
    params.push(flag);
  }

  if (!sets.length) {
    throw new AppError('VALIDATION_ERROR', 'Nothing to update — provide admin_role, capabilities, or active', 422);
  }

  params.push(req.params.id);
  await db.query(
    `UPDATE admin_profiles SET ${sets.join(', ')} WHERE user_id = $${idx}`,
    params
  );

  const { rows } = await db.query(
    `SELECT u.id, u.phone, u.name, u.status, u.created_at,
            ap.admin_role, ap.capabilities, ap.active
     FROM users u JOIN admin_profiles ap ON ap.user_id = u.id
     WHERE u.id = $1`,
    [req.params.id]
  );

  return success(res, { admin_user: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/me  (any admin)
// The caller's own admin_role + capabilities + active. Drives nav scoping.
// ─────────────────────────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Admin access required', 403);
  }
  const { rows } = await db.query(
    `SELECT admin_role, capabilities, active FROM admin_profiles WHERE user_id = $1`,
    [req.user.sub]
  );
  if (!rows[0]) throw new AppError('FORBIDDEN', 'Admin profile not found', 403);

  return success(res, {
    admin_role:   rows[0].admin_role,
    capabilities: Array.isArray(rows[0].capabilities) ? rows[0].capabilities : [],
    active:       rows[0].active,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/capabilities  (any admin)
// The canonical capability catalog so the UI builds checkboxes without
// hardcoding keys, plus the role → default-caps map for "apply role defaults".
// ─────────────────────────────────────────────────────────────────────────────

const getCapabilityCatalog = asyncHandler(async (req, res) => {
  return success(res, {
    capabilities:  adminCaps.CAPABILITIES,
    defaults_by_role: adminCaps.DEFAULT_CAPS_BY_ROLE,
  });
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
             niche, secondary_niche,
             city, state, gender, platform,
             avg_views, avg_likes, avg_comments, verified, language
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (user_id) DO UPDATE SET
             instagram_handle  = EXCLUDED.instagram_handle,
             full_name         = EXCLUDED.full_name,
             tier              = EXCLUDED.tier,
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
          // Item 3b (founder Q9): the import creates creators but no longer writes followers
          // or engagement — the measurement pipeline sets them after approval.
          [
            user.id, handle, full_name, tier,
            niche, secondary_niche,
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
    tds_pct, offer_expiry_hours, return_window_days, return_window_hours, min_withdrawal_inr,
    // Wave 1 — tax + identity (migration 072)
    gst_pct, tcs_pct, tcs_active, tcs_active_from_date,
    platform_gstin, platform_business_name, platform_business_address,
    platform_state_code, invoice_prefix_subscription, invoice_prefix_commerce,
    // Wave 1 — T3 release timing (migration 074). Item 12 (Q4): the waiting period moved to
    // platform_settings.final_payment_wait_days; tranche_3_release_after_days is no longer written here.
    tranche_3_release_time_ist,
    // Way-4 — attribution window (migration 120)
    attribution_window_days,
    // Delivery ETA rule (migration 121)
    delivery_ref_km, delivery_ref_days,
  } = req.body;

  try {
    await paymentConfigSvc.updateConfig({
      platform_fee_pct, tranche_1_pct, tranche_2_pct, tranche_3_pct,
      tds_pct, offer_expiry_hours, return_window_days, return_window_hours, min_withdrawal_inr,
      gst_pct, tcs_pct, tcs_active, tcs_active_from_date,
      platform_gstin, platform_business_name, platform_business_address,
      platform_state_code, invoice_prefix_subscription, invoice_prefix_commerce,
      tranche_3_release_time_ist,
      attribution_window_days,
      delivery_ref_km, delivery_ref_days,
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

/**
 * Item 9 — null CLEARS the override, exactly like the escrow one below.
 *
 * Until migration 186 this column defaulted to 8.00 and was read by nobody who
 * mattered, so "no override" was not a state anything needed. Now NULL means
 * "follow the platform-wide campaign fee", which is the ordinary case and what
 * every brand sits at — so there has to be a way back to it. Without this the
 * override was a one-way door: an admin could set a brand's fee and then never
 * return it to the default.
 */
const setBrandPlatformFee = asyncHandler(async (req, res) => {
  const raw = req.body.platform_fee_pct;
  let value = null;
  if (raw !== null && raw !== '' && raw !== undefined) {
    const fee = parseFloat(raw);
    if (isNaN(fee) || fee < 0 || fee > 50) {
      throw new AppError('VALIDATION_ERROR', 'platform_fee_pct must be 0–50, or null to follow the platform fee', 422, 'platform_fee_pct');
    }
    value = fee.toFixed(2);
  }

  const { rows } = await db.query(
    `UPDATE brands SET platform_fee_pct = $1 WHERE id = $2 RETURNING id, platform_fee_pct`,
    [value, req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);

  return success(res, { brand_id: rows[0].id, platform_fee_pct: rows[0].platform_fee_pct });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/brands/:id/escrow-fee-override  (finance+ : per-brand L2 override)
// Body: { escrow_fee_override_pct: number | null }  — null clears the override.
// ─────────────────────────────────────────────────────────────────────────────

const setBrandEscrowFeeOverride = asyncHandler(async (req, res) => {
  const raw = req.body.escrow_fee_override_pct;
  let value = null;
  if (raw !== null && raw !== '' && raw !== undefined) {
    const n = parseFloat(raw);
    if (isNaN(n) || n < 0 || n > 50) {
      throw new AppError('VALIDATION_ERROR', 'escrow_fee_override_pct must be 0–50 or null', 422, 'escrow_fee_override_pct');
    }
    value = n.toFixed(2);
  }

  const { rows } = await db.query(
    `UPDATE brands SET escrow_fee_override_pct = $1 WHERE id = $2
     RETURNING id, escrow_fee_override_pct`,
    [value, req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);

  return success(res, {
    brand_id: rows[0].id,
    escrow_fee_override_pct: rows[0].escrow_fee_override_pct,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/brands/:id/commerce-commission-override  (finance+ : per-brand L3 override)
// Wave 1 commit 2 — admin UI surface for brands.commerce_commission_override_pct.
// Mirrors setBrandEscrowFeeOverride exactly but writes to the L3 column.
// Body: { commerce_commission_override_pct: number | null }  — null clears the override.
// ─────────────────────────────────────────────────────────────────────────────

const setBrandCommerceCommissionOverride = asyncHandler(async (req, res) => {
  const raw = req.body.commerce_commission_override_pct;
  let value = null;
  if (raw !== null && raw !== '' && raw !== undefined) {
    const n = parseFloat(raw);
    if (isNaN(n) || n < 0 || n > 50) {
      throw new AppError('VALIDATION_ERROR', 'commerce_commission_override_pct must be 0–50 or null', 422, 'commerce_commission_override_pct');
    }
    value = n.toFixed(2);
  }

  const { rows } = await db.query(
    `UPDATE brands SET commerce_commission_override_pct = $1 WHERE id = $2
     RETURNING id, commerce_commission_override_pct`,
    [value, req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);

  return success(res, {
    brand_id: rows[0].id,
    commerce_commission_override_pct: rows[0].commerce_commission_override_pct,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/influencers/:id/tax-controls  (finance+ : per-influencer TDS)
// Wave 1 commit 2 — admin UI surface for influencers.tds_override_pct + tds_exempt.
// Body: { tds_override_pct: number | null, tds_exempt: boolean }
//   - tds_override_pct = null → uses global payment_config.tds_pct (default)
//   - tds_exempt = true → 0 TDS deducted on withdrawals (e.g. exemption cert on file)
// ─────────────────────────────────────────────────────────────────────────────

const setInfluencerTaxControls = asyncHandler(async (req, res) => {
  const raw = req.body.tds_override_pct;
  let overrideValue = null;
  if (raw !== null && raw !== '' && raw !== undefined) {
    const n = parseFloat(raw);
    if (isNaN(n) || n < 0 || n > 30) {
      throw new AppError('VALIDATION_ERROR', 'tds_override_pct must be 0–30 or null', 422, 'tds_override_pct');
    }
    overrideValue = n.toFixed(2);
  }
  const exempt = req.body.tds_exempt === true || req.body.tds_exempt === 'true';

  const { rows } = await db.query(
    `UPDATE influencers SET tds_override_pct = $1, tds_exempt = $2 WHERE id = $3
     RETURNING id, tds_override_pct, tds_exempt`,
    [overrideValue, exempt, req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer not found', 404);

  return success(res, {
    influencer_id:    rows[0].id,
    tds_override_pct: rows[0].tds_override_pct,
    tds_exempt:       rows[0].tds_exempt,
  });
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
    const { rows: revRows } = await db.query(
      `UPDATE influencers SET wallet_balance = wallet_balance + $1 WHERE id = $2
       RETURNING wallet_balance`,
      [withdrawal.amount_requested, withdrawal.influencer_id]
    );
    // G-5 ledger: admin-rejected withdrawal → wallet refund (once; guarded by
    // the status='initiated' check above).
    await ledgerService.appendInfluencerLedger({
      client: db,
      influencerId: withdrawal.influencer_id,
      type: 'withdrawal_reversal',
      amount: parseFloat(withdrawal.amount_requested),
      direction: 'credit',
      balanceField: 'wallet_balance',
      balanceAfter: revRows[0] ? parseFloat(revRows[0].wallet_balance) : null,
      source: 'withdrawal',
      sourceRefId: withdrawal.id,
      note: 'Withdrawal rejected by admin — refunded to wallet',
    });

    await db.query(
      `UPDATE influencer_withdrawals SET status = 'failed', completed_at = now() WHERE id = $1`,
      [withdrawal.id]
    );

    await notificationService.send({
      userId:   withdrawal.user_id,
      type:     'withdrawal.rejected',
      title:    'Withdrawal Rejected',
      body:     `Your withdrawal of \u20B9${parseFloat(withdrawal.amount_requested).toFixed(2)} was rejected. Reason: ${reason}. Amount returned to wallet.`,
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
    body:     `Your withdrawal of \u20B9${parseFloat(withdrawal.net_paid).toFixed(2)} has been approved and is being processed.`,
    data:     { screen: 'withdrawals', withdrawal_id: withdrawal.id },
    fcmToken: withdrawal.fcm_token,
    sendSms:  true,
    phone:    withdrawal.phone,
  });

  const { rows: updated } = await db.query(`SELECT * FROM influencer_withdrawals WHERE id = $1`, [withdrawal.id]);
  return success(res, { withdrawal: updated[0], action: 'approved' });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/brand-withdrawals?status=&search=&page=    (Wave 2 commit 2)
// Mirror of getWithdrawals for the brand-side payout queue.
// ─────────────────────────────────────────────────────────────────────────────

const getBrandWithdrawals = asyncHandler(async (req, res) => {
  const { status = 'all', search = '', page: rawPage, limit: rawLimit } = req.query;
  const validStatuses = ['all', 'pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new AppError('VALIDATION_ERROR', 'status must be all, pending, queued, processing, completed, failed, or cancelled', 422, 'status');
  }

  const page = Math.max(1, parseInt(rawPage || '1', 10));
  const limit = Math.min(100, parseInt(rawLimit || '50', 10));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (status !== 'all') {
    params.push(status);
    conditions.push(`bw.status = $${params.length}`);
  }
  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const idx = params.length;
    conditions.push(`(LOWER(b.business_name) LIKE $${idx} OR LOWER(u.phone) LIKE $${idx})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT
       bw.id, bw.brand_id, bw.amount_requested, bw.method,
       bw.upi_id, bw.bank_account_no, bw.bank_ifsc, bw.account_holder_name,
       bw.razorpay_payout_id, bw.status, bw.failure_reason,
       bw.created_at, bw.completed_at,
       b.business_name AS brand_name, u.phone AS brand_phone
     FROM brand_withdrawals bw
     JOIN brands b ON b.id = bw.brand_id
     JOIN users u ON u.id = b.user_id
     ${where}
     ORDER BY bw.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total
     FROM brand_withdrawals bw
     JOIN brands b ON b.id = bw.brand_id
     JOIN users u ON u.id = b.user_id
     ${where}`,
    params
  );

  const { rows: summaryRows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')    AS pending_count,
       COALESCE(SUM(amount_requested) FILTER (WHERE status = 'pending'), 0) AS pending_amount,
       COUNT(*) FILTER (WHERE status IN ('queued', 'processing')) AS processing_count,
       COALESCE(SUM(amount_requested) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE), 0) AS today_paid,
       COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) AS today_count
     FROM brand_withdrawals`
  );

  return success(res, {
    withdrawals: rows,
    summary: summaryRows[0],
  }, 200, { page, limit, total: parseInt(countRows[0].total, 10) });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/brand-withdrawals/:id/process  { action: 'approve'|'reject', reason? }
//
// approve → fire RazorpayX payout (wallet was already debited at request time;
//           no further deduction). On payout failure, refund + status 'failed'.
// reject  → refund wallet + reversing ledger credit + status 'cancelled'.
// ─────────────────────────────────────────────────────────────────────────────

const processBrandWithdrawal = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('VALIDATION_ERROR', 'action must be approve or reject', 422, 'action');
  }
  if (action === 'reject' && (!reason || !reason.trim())) {
    throw new AppError('VALIDATION_ERROR', 'reason is required when rejecting', 422, 'reason');
  }

  const { rows: wRows } = await db.query(
    `SELECT bw.*, b.business_name, b.razorpay_contact_id,
            u.id AS user_id, u.phone, u.fcm_token
     FROM brand_withdrawals bw
     JOIN brands b ON b.id = bw.brand_id
     JOIN users u ON u.id = b.user_id
     WHERE bw.id = $1`,
    [req.params.id]
  );
  if (!wRows[0]) throw new AppError('NOT_FOUND', 'Brand withdrawal not found', 404);
  const withdrawal = wRows[0];

  if (withdrawal.status !== 'pending') {
    throw new AppError('CONFLICT', `Cannot ${action} a withdrawal with status "${withdrawal.status}"`, 409);
  }

  const amount = parseFloat(withdrawal.amount_requested);

  // Refund helper — returns funds to the wallet + writes a reversing ledger
  // credit (type='withdrawal' direction='credit'; ignored by getWallet sums).
  async function refundWallet(client, note) {
    const { rows: lockRows } = await client.query(
      `SELECT wallet_balance FROM brands WHERE id = $1 FOR UPDATE`,
      [withdrawal.brand_id]
    );
    const newBalance = parseFloat((parseFloat(lockRows[0].wallet_balance) + amount).toFixed(2));
    await client.query(`UPDATE brands SET wallet_balance = $1 WHERE id = $2`, [newBalance, withdrawal.brand_id]);
    await client.query(
      `INSERT INTO wallet_transactions (brand_id, type, amount, direction, balance_after, notes)
       VALUES ($1, 'withdrawal', $2, 'credit', $3, $4)`,
      [withdrawal.brand_id, amount, newBalance, note]
    );
    // Item 11 (v1.27 §11.2, approval Q4) — money in settles what is owed. A withdrawal that
    // comes back is money the brand can spend again, so an outstanding courier charge comes
    // off it first, oldest-first, in this same transaction.
    await require('../services/remoteMoney.service')
      .settleDuesFromCredit(client, withdrawal.brand_id, amount);
  }

  if (action === 'reject') {
    await db.withTransaction(async (client) => {
      await refundWallet(client, `Withdrawal rejected — refunded. Reason: ${reason}`);
      await client.query(
        `UPDATE brand_withdrawals SET status = 'cancelled', failure_reason = $1, completed_at = now() WHERE id = $2`,
        [reason, withdrawal.id]
      );
    });

    await notificationService.send({
      userId:   withdrawal.user_id,
      type:     'withdrawal.rejected',
      title:    'Withdrawal Rejected',
      body:     `Your withdrawal of ₹${amount.toFixed(2)} was rejected. Reason: ${reason}. Amount returned to your wallet.`,
      data:     { screen: 'wallet', withdrawal_id: withdrawal.id },
      fcmToken: withdrawal.fcm_token,
      sendSms:  true,
      phone:    withdrawal.phone,
    });

    const { rows: updated } = await db.query(`SELECT * FROM brand_withdrawals WHERE id = $1`, [withdrawal.id]);
    return success(res, { withdrawal: updated[0], action: 'rejected' });
  }

  // action === 'approve' — fire the payout (wallet already debited at request).
  await db.query(`UPDATE brand_withdrawals SET status = 'processing' WHERE id = $1`, [withdrawal.id]);

  const env = require('../config/env');
  if (env.RAZORPAY_MOCK) {
    const mockPayoutId = `mock_payout_${Date.now()}`;
    await db.query(
      `UPDATE brand_withdrawals SET status = 'completed', razorpay_payout_id = $1, completed_at = now() WHERE id = $2`,
      [mockPayoutId, withdrawal.id]
    );
    console.log(`[ADMIN][RAZORPAY MOCK] Brand payout ${mockPayoutId} approved for withdrawal ${withdrawal.id}`);
  } else {
    const withdrawalService = require('../services/withdrawal.service');
    try {
      const { razorpayPayoutId, status } = await withdrawalService.executeBrandPayout(
        { id: withdrawal.brand_id, business_name: withdrawal.business_name, phone: withdrawal.phone, razorpay_contact_id: withdrawal.razorpay_contact_id },
        withdrawal
      );
      await db.query(
        `UPDATE brand_withdrawals SET status = $1, razorpay_payout_id = $2, completed_at = $3 WHERE id = $4`,
        [status, razorpayPayoutId, status === 'completed' ? new Date() : null, withdrawal.id]
      );
    } catch (err) {
      // Payout failed — the money never left, so refund + mark failed.
      const msg = err?.response?.data?.error?.description || err.message;
      await db.withTransaction(async (client) => {
        await refundWallet(client, `Brand payout failed — refunded. ${msg}`);
        await client.query(
          `UPDATE brand_withdrawals SET status = 'failed', failure_reason = $1, completed_at = now() WHERE id = $2`,
          [msg, withdrawal.id]
        );
      });
      throw new AppError('PAYOUT_FAILED', `Razorpay payout failed: ${msg}`, 502);
    }
  }

  await notificationService.send({
    userId:   withdrawal.user_id,
    type:     'withdrawal.approved',
    title:    'Withdrawal Approved',
    body:     `Your withdrawal of ₹${amount.toFixed(2)} has been approved and is being processed to your ${withdrawal.method === 'upi' ? 'UPI' : 'bank account'}.`,
    data:     { screen: 'wallet', withdrawal_id: withdrawal.id },
    fcmToken: withdrawal.fcm_token,
    sendSms:  true,
    phone:    withdrawal.phone,
  });

  const { rows: updated } = await db.query(`SELECT * FROM brand_withdrawals WHERE id = $1`, [withdrawal.id]);
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
// GET /admin/influencers?status=&search=&page=
//
// The creator list. Until now Admin -> Influencers was a CSV upload box and nothing
// else, so a creator's page could only be opened by typing her internal id into the
// address bar — which means, in practice, never. Deliberately the same shape as
// getBrands above, so the two lists behave identically.
// Contract: features/admin-account-review (item 2)
// ─────────────────────────────────────────────────────────────────────────────

const getInfluencers = asyncHandler(async (req, res) => {
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
    // Phone is searchable on purpose — the practice creators are known by number.
    conditions.push(`(
      i.full_name ILIKE $${paramIdx} OR
      u.name ILIKE $${paramIdx} OR
      i.instagram_handle ILIKE $${paramIdx} OR
      i.youtube_handle ILIKE $${paramIdx} OR
      u.phone ILIKE $${paramIdx} OR
      COALESCE(i.city, u.city) ILIKE $${paramIdx}
    )`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: summaryRows } = await db.query(`
    SELECT
      COUNT(*)                                       AS total,
      COUNT(*) FILTER (WHERE u.status = 'approved')  AS approved,
      COUNT(*) FILTER (WHERE u.status = 'pending')   AS pending,
      COUNT(*) FILTER (WHERE u.status = 'rejected')  AS rejected,
      COUNT(*) FILTER (WHERE u.status = 'suspended') AS suspended
    FROM influencers i JOIN users u ON u.id = i.user_id
  `);
  const summary = {
    total:     parseInt(summaryRows[0].total, 10),
    approved:  parseInt(summaryRows[0].approved, 10),
    pending:   parseInt(summaryRows[0].pending, 10),
    rejected:  parseInt(summaryRows[0].rejected, 10),
    suspended: parseInt(summaryRows[0].suspended, 10),
  };

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total FROM influencers i JOIN users u ON u.id = i.user_id ${where}`,
    params
  );
  const total = parseInt(countRows[0].total, 10);

  const { rows: influencers } = await db.query(`
    SELECT i.id, i.instagram_handle, i.youtube_handle,
           -- The City column was a dash for every creator who signed up in the app:
           -- registration wrote her city to users.city and this read i.city, which
           -- stays NULL. Same reason full_name fell back to blank.
           -- Contract: features/admin-creator-review-completeness
           COALESCE(i.full_name, u.name) AS full_name,
           COALESCE(i.city,  u.city)     AS city,
           COALESCE(i.state, u.state)    AS state,
           i.followers_count, i.engagement_rate, i.tier,
           i.youtube_subscribers, i.youtube_scrape_last_run,
           i.scrape_last_run, i.created_at,
           u.name, u.phone, u.status,
           -- Counted live, exactly as everywhere else on the platform.
           (SELECT COUNT(*)::int FROM follower_follows ff WHERE ff.influencer_id = i.id)
             AS inflx_followers
    FROM influencers i
    JOIN users u ON u.id = i.user_id
    ${where}
    ORDER BY u.status = 'pending' DESC, i.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `, [...params, limit, offset]);

  return success(res, { influencers, summary }, 200, { page, limit, total });
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
       (SELECT COALESCE(SUM(marketplace_fee_amount), 0) FROM follower_transactions WHERE status = 'completed' AND created_at::date = d::date) +
       (SELECT COALESCE(SUM(escrow_fee_amount), 0) FROM escrow_entries WHERE status = 'released' AND released_at::date = d::date) AS revenue
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
       (SELECT COALESCE(SUM(marketplace_fee_amount), 0) FROM follower_transactions WHERE status = 'completed' AND created_at >= $1) +
       (SELECT COALESCE(SUM(escrow_fee_amount), 0) FROM escrow_entries WHERE status = 'released' AND released_at >= $1) AS current_revenue,
       (SELECT COUNT(*) FROM campaigns WHERE status IN ('active','live') AND created_at >= $1) AS current_active_campaigns,
       -- Previous period
       (SELECT COUNT(*) FROM users WHERE created_at >= $2 AND created_at < $1) AS prev_users,
       (SELECT COUNT(*) FROM follower_transactions WHERE status = 'completed' AND created_at >= $2 AND created_at < $1) AS prev_transactions,
       (SELECT COALESCE(SUM(marketplace_fee_amount), 0) FROM follower_transactions WHERE status = 'completed' AND created_at >= $2 AND created_at < $1) +
       (SELECT COALESCE(SUM(escrow_fee_amount), 0) FROM escrow_entries WHERE status = 'released' AND released_at >= $2 AND released_at < $1) AS prev_revenue,
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
       COALESCE(SUM(ft.marketplace_fee_amount), 0) AS revenue
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
       (SELECT COALESCE(SUM(marketplace_fee_amount), 0) FROM follower_transactions WHERE status = 'completed') +
       (SELECT COALESCE(SUM(escrow_fee_amount), 0) FROM escrow_entries WHERE status = 'released') AS total_revenue`
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/production/queue — production events that need attention
//
// Surfaces three buckets:
//   * proposed > 3 days       (brand never filled in details)
//   * in_progress > 14 days   (shipment stuck, possibly lost)
//   * reschedule limit hit    (either side has used 2 reschedules)
// ─────────────────────────────────────────────────────────────────────────────

const getProductionQueue = asyncHandler(async (req, res) => {
  const RESCHEDULE_LIMIT = 2;

  const { rows } = await db.query(
    `SELECT pe.id,
            pe.contract_id,
            pe.mode,
            pe.status,
            pe.created_at,
            -- Item 11 (approval §3.3): shipment_dispatched_at / _courier / _awb are gone from
            -- this projection. They were written only by the hand-typed "dispatch" door, which
            -- is retired, so the "in_progress > 14 days" bucket below can never fill again.
            -- The Remote flow's own stalls are the :55 reminder lane's and the Delayed flag's.
            pe.visit_scheduled_at,
            pe.reschedule_count_brand,
            pe.reschedule_count_influencer,
            EXTRACT(EPOCH FROM (NOW() - pe.created_at)) / 86400 AS days_since_created,
            camp.name AS campaign_name,
            b.business_name AS brand_name,
            inf_u.name AS influencer_name,
            inf.instagram_handle AS influencer_handle,
            ci.id AS campaign_influencer_id,
            -- Item 10: the store visit's own timestamps, the posting date, the Delayed flag,
            -- and how many times the time thread has reopened (a pattern admin should see, Q7).
            pe.plan_sent_at, pe.time_agreed_at, pe.influencer_completed_at, pe.brand_completed_at,
            pe.auto_confirmed_at, pe.auto_confirm_due_at,
            cs.go_live_date, ci.delayed_at, ci.delayed_stage,
            (SELECT count(*)::int FROM negotiation_turns t JOIN negotiations n ON n.id = t.negotiation_id
              WHERE n.production_event_id = pe.id AND t.kind = 'accept') AS times_agreed
     FROM   production_events pe
     JOIN   contracts c ON c.id = pe.contract_id
     JOIN   campaign_influencers ci ON ci.id = c.campaign_influencer_id
     JOIN   campaign_sets cs ON cs.id = ci.set_id
     JOIN   campaigns camp ON camp.id = cs.campaign_id
     JOIN   brands b ON b.id = camp.brand_id
     JOIN   influencers inf ON inf.id = ci.influencer_id
     JOIN   users inf_u ON inf_u.id = inf.user_id
     WHERE  pe.status NOT IN ('completed', 'cancelled')
       AND  (
              (pe.status = 'proposed'   AND pe.created_at < NOW() - INTERVAL '3 days')
           OR pe.reschedule_count_brand >= $1
           OR pe.reschedule_count_influencer >= $1
            )
     ORDER  BY pe.updated_at ASC`,
    [RESCHEDULE_LIMIT]
  );

  // Item 10: the §10 gate as a column. A shoot row on a collaboration that is not signed and
  // funded is itself the anomaly admin should see — every door in the apps refuses it.
  const shootGate = require('../services/shootGate.service');
  const gates = await shootGate.shootGateMany(rows.map(r => r.campaign_influencer_id));

  const items = rows.map(r => {
    const reasons = [];
    const g = gates.get(r.campaign_influencer_id) || null;
    r.gate = g ? { open: g.open, reason: g.reason } : null;
    if (g && !g.open) reasons.push(g.reason === 'NOT_SIGNED' ? 'Not signed by both' : 'Money not locked');
    if (r.delayed_at) reasons.push(`Delayed since ${new Date(r.delayed_at).toISOString().slice(0, 10)} (${r.delayed_stage})`);
    if (Number(r.times_agreed) >= 2) reasons.push(`Time moved ${Number(r.times_agreed) - 1}× after agreement`);
    if (r.status === 'proposed' && Number(r.days_since_created) >= 3) {
      reasons.push(`Stale 'proposed' for ${Math.floor(r.days_since_created)}d`);
    }
    if (Number(r.reschedule_count_brand) >= RESCHEDULE_LIMIT) reasons.push('Brand reschedule limit reached');
    if (Number(r.reschedule_count_influencer) >= RESCHEDULE_LIMIT) reasons.push('Influencer reschedule limit reached');
    return { ...r, reasons };
  });

  return success(res, { items, total: items.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/tax-summary?month=YYYY-MM   (Wave 4 — compliance reporting)
// Monthly GST collected / TCS owed / TDS withheld for filing returns.
// ─────────────────────────────────────────────────────────────────────────────

const getTaxSummary = asyncHandler(async (req, res) => {
  const month = String(req.query.month || '').trim() || new Date().toISOString().slice(0, 7);
  const taxReportSvc = require('../services/taxReport.service');
  let summary;
  try {
    summary = await taxReportSvc.monthlySummary(month);
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') {
      throw new AppError('VALIDATION_ERROR', err.message, 422, 'month');
    }
    throw err;
  }
  return success(res, summary);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/queue/agencies  (Contract 3a)
// ─────────────────────────────────────────────────────────────────────────────

const getAgencyQueue = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  const { rows: agencies } = await db.query(
    `SELECT a.id, a.agency_name, a.contact_person, a.contact_email, a.city, a.state,
            a.created_at, u.status AS user_status, u.phone, u.name
     FROM agencies a JOIN users u ON u.id = a.user_id
     WHERE u.status = 'pending'
     ORDER BY a.created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total FROM agencies a JOIN users u ON u.id = a.user_id WHERE u.status = 'pending'`
  );
  return success(res, { agencies }, 200, { page, limit, total: parseInt(countRows[0].total, 10) });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/agencies/:id/status  (Contract 3a)
// ─────────────────────────────────────────────────────────────────────────────

const updateAgencyStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const adminUserId = req.user.sub;

  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    throw new AppError('VALIDATION_ERROR', 'status must be approved, rejected, or suspended', 422, 'status');
  }
  if (status === 'rejected' && !reason) {
    throw new AppError('VALIDATION_ERROR', 'reason is required when rejecting', 422, 'reason');
  }

  const { rows: agencyRows } = await db.query(
    `SELECT a.*, u.status AS user_status, u.phone, u.fcm_token
     FROM agencies a JOIN users u ON u.id = a.user_id WHERE a.id = $1`,
    [req.params.id]
  );
  if (!agencyRows.length) throw new AppError('NOT_FOUND', 'Agency not found', 404);
  const agency = agencyRows[0];

  if (status === 'approved') {
    await db.query(
      `UPDATE agencies SET rejection_reason = NULL, approved_at = now(), approved_by = $2 WHERE id = $1`,
      [agency.id, adminUserId]
    );
  } else {
    await db.query(
      `UPDATE agencies SET rejection_reason = $2, approved_at = NULL, approved_by = NULL WHERE id = $1`,
      [agency.id, reason || null]
    );
  }
  await db.query(`UPDATE users SET status = $1 WHERE id = $2`, [status, agency.user_id]);

  const { rows: updated } = await db.query(
    `SELECT a.*, u.status AS user_status FROM agencies a JOIN users u ON u.id = a.user_id WHERE a.id = $1`,
    [agency.id]
  );

  const templates = {
    approved:  { type: 'account.approved',  title: 'Agency Approved',         body: 'Your agency account is approved. Share your referral code to start earning!' },
    rejected:  { type: 'account.rejected',  title: 'Agency Needs More Info',   body: `Your agency account needs more info. Reason: ${reason}` },
    suspended: { type: 'account.suspended', title: 'Agency Suspended',         body: 'Your agency account has been suspended. Please contact support.' },
  };
  const tpl = templates[status];
  await notificationService.send({
    userId: agency.user_id, type: tpl.type, title: tpl.title, body: tpl.body,
    data: { screen: 'agency_dashboard' }, fcmToken: agency.fcm_token, sendSms: true, phone: agency.phone,
  });

  return success(res, { agency: updated[0], notification_sent: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/agencies  (referral-agency-admin) — full directory + wallet/earnings
// ─────────────────────────────────────────────────────────────────────────────

const getAgencies = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  const status = req.query.status;
  if (status && status !== 'all') { params.push(status); where.push(`u.status = $${params.length}`); }
  if (req.query.search) { params.push(`%${req.query.search}%`); where.push(`a.agency_name ILIKE $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM agencies a JOIN users u ON u.id = a.user_id ${whereSql}`,
    params
  );

  const { rows } = await db.query(
    `SELECT a.id, a.agency_name, a.contact_person, a.contact_email, a.city, a.state,
            u.status AS user_status, a.wallet_balance, a.referral_earned_total, a.created_at,
            rc.code AS referral_code,
            (SELECT COUNT(*)::int FROM referral_edges e
               WHERE e.referrer_type = 'agency' AND e.referrer_id = a.id AND e.status = 'active') AS active_edges
       FROM agencies a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN referral_codes rc ON rc.referrer_type = 'agency' AND rc.referrer_id = a.id
       ${whereSql}
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const data = rows.map(r => ({
    id: r.id,
    agency_name: r.agency_name,
    contact_person: r.contact_person,
    contact_email: r.contact_email,
    city: r.city,
    state: r.state,
    user_status: r.user_status,
    wallet_balance: parseFloat(r.wallet_balance),
    referral_earned_total: parseFloat(r.referral_earned_total),
    referral_code: r.referral_code || null,
    active_edges: r.active_edges,
    created_at: r.created_at,
  }));
  return success(res, { agencies: data }, 200, { page, limit, total: countRows[0].total });
});

module.exports = {
  getInfluencers,
  getBrandQueue,
  getInfluencerQueue,
  updateBrandStatus,
  updateInfluencerStatus,
  getAgencyQueue,
  getAgencies,
  updateAgencyStatus,
  getStats,
  getEscrowOverview,
  adminReleaseEscrow,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  getMe,
  getCapabilityCatalog,
  bulkUploadInfluencers,
  getPaymentConfig,
  updatePaymentConfig,
  setBrandPlatformFee,
  setBrandEscrowFeeOverride,
  // Wave 1 — new per-actor admin controls
  setBrandCommerceCommissionOverride,
  setInfluencerTaxControls,
  getWithdrawals,
  processWithdrawal,
  getBrandWithdrawals,
  processBrandWithdrawal,
  getTaxSummary,
  getBrands,
  getAnalytics,
  getProductionQueue,
};
