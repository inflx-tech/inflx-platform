'use strict';

const db = require('../config/db');
const apifyService = require('../services/apify.service');
const notificationService = require('../services/notification.service');
const pdfService = require('../services/pdf.service');
const { encrypt } = require('../utils/encrypt');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getInfluencerByUserId(userId) {
  const { rows } = await db.query(
    `SELECT i.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getInfluencerById(id) {
  const { rows } = await db.query(
    `SELECT i.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Remove encrypted fields and internal tokens from API response.
 * Sensitive data (bank_account_no, upi_id, pan_number) is never returned.
 */
function sanitiseInfluencer(row) {
  const {
    bank_account_no,
    upi_id,
    pan_number,
    fcm_token,
    phone: _phone,
    ...safe
  } = row;
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /influencers/register
// ─────────────────────────────────────────────────────────────────────────────

const register = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { instagram_handle } = req.body;

  if (!instagram_handle || !instagram_handle.trim()) {
    throw new AppError('VALIDATION_ERROR', 'instagram_handle is required', 422, 'instagram_handle');
  }

  // Prevent duplicate registration
  const existing = await getInfluencerByUserId(userId);
  if (existing) {
    throw new AppError('CONFLICT', 'Influencer profile already exists for this account', 409);
  }

  // Run Apify scrape (mocked in dev)
  const scraped = await apifyService.scrapeProfile(instagram_handle.trim());

  const { rows } = await db.query(
    `INSERT INTO influencers
       (user_id, instagram_handle, followers_count, engagement_rate, niche, scrape_data, scrape_last_run)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING *`,
    [
      userId,
      instagram_handle.trim().toLowerCase(),
      scraped.followers_count,
      scraped.engagement_rate,
      scraped.niche,
      JSON.stringify(scraped.scrape_data),
    ]
  );

  const influencer = rows[0];
  const full = await getInfluencerById(influencer.id);

  return success(res, { influencer: sanitiseInfluencer(full), user_status: full.user_status }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me
// ─────────────────────────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  return success(res, {
    influencer: sanitiseInfluencer(influencer),
    user_status: influencer.user_status,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /influencers/me
// ─────────────────────────────────────────────────────────────────────────────

const updateMe = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found. Please register first.', 404);

  const {
    language,
    content_style,
    niche,
    youtube_handle,
    upi_id,
    bank_account_no,
    bank_ifsc,
    pan_number,
  } = req.body;

  const updates = {};

  if (language !== undefined) updates.language = language;
  if (content_style !== undefined) updates.content_style = content_style;
  if (niche !== undefined) updates.niche = niche;
  if (youtube_handle !== undefined) updates.youtube_handle = youtube_handle;
  if (bank_ifsc !== undefined) updates.bank_ifsc = bank_ifsc;

  // Encrypt sensitive fields before storing
  if (upi_id !== undefined) updates.upi_id = encrypt(upi_id);
  if (bank_account_no !== undefined) updates.bank_account_no = encrypt(bank_account_no);
  if (pan_number !== undefined) updates.pan_number = encrypt(pan_number);

  if (Object.keys(updates).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided to update', 422);
  }

  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values = [influencer.id, ...Object.values(updates)];

  await db.query(
    `UPDATE influencers SET ${setClauses.join(', ')} WHERE id = $1`,
    values
  );

  const updated = await getInfluencerById(influencer.id);
  return success(res, { influencer: sanitiseInfluencer(updated) });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/search  (brand + admin)
// ─────────────────────────────────────────────────────────────────────────────

const search = asyncHandler(async (req, res) => {
  const {
    q,
    niche,
    city,
    tier,
    gender,
    platform,
    min_followers,
    max_followers,
    min_er,
    page  = '1',
    limit = '20',
  } = req.query;

  const conditions = [`u.status = 'approved'`];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(u.name ILIKE $${params.length} OR i.instagram_handle ILIKE $${params.length} OR i.full_name ILIKE $${params.length})`);
  }
  if (niche) {
    params.push(niche);
    conditions.push(`$${params.length} = ANY(i.niche)`);
  }
  if (city) {
    params.push(`%${city}%`);
    conditions.push(`i.city ILIKE $${params.length}`);
  }
  if (tier) {
    params.push(tier);
    conditions.push(`i.tier = $${params.length}`);
  }
  if (gender) {
    params.push(gender);
    conditions.push(`i.gender = $${params.length}`);
  }
  if (platform) {
    params.push(platform);
    conditions.push(`i.platform = $${params.length}`);
  }
  if (min_followers) {
    params.push(parseInt(min_followers, 10));
    conditions.push(`i.followers_count >= $${params.length}`);
  }
  if (max_followers) {
    params.push(parseInt(max_followers, 10));
    conditions.push(`i.followers_count <= $${params.length}`);
  }
  if (min_er) {
    params.push(parseFloat(min_er));
    conditions.push(`i.engagement_rate >= $${params.length}`);
  }

  const where = conditions.join(' AND ');

  const countFilterParams = [...params];
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM influencers i JOIN users u ON u.id = i.user_id WHERE ${where}`,
    countFilterParams
  );
  const total = parseInt(countRows[0].count, 10);

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset   = (pageNum - 1) * limitNum;
  params.push(limitNum, offset);

  const { rows } = await db.query(
    `SELECT
       i.id, i.instagram_handle, i.youtube_handle, i.full_name,
       i.followers_count, i.engagement_rate, i.niche, i.secondary_niche,
       i.language, i.tier, i.city, i.state, i.gender, i.platform,
       i.avg_views, i.avg_likes, i.avg_comments, i.avg_shares, i.avg_saves,
       i.total_posts, i.verified,
       i.bio, i.website,
       i.price_per_post_min, i.price_per_post_max,
       i.past_brands_json, i.collaboration_types_json,
       i.profile_image_url, i.age,
       u.name, u.id AS user_id
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE ${where}
     ORDER BY i.followers_count DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return success(res, { influencers: rows }, 200, { page: pageNum, limit: limitNum, total });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/:id  (brand + admin — public profile view)
// ─────────────────────────────────────────────────────────────────────────────

const getPublicById = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT
       i.id, i.instagram_handle, i.youtube_handle, i.full_name,
       i.followers_count, i.engagement_rate, i.niche, i.secondary_niche,
       i.language, i.tier, i.city, i.state, i.gender, i.platform,
       i.avg_views, i.avg_likes, i.avg_comments, i.avg_shares, i.avg_saves,
       i.total_posts, i.verified,
       i.bio, i.website,
       i.price_per_post_min, i.price_per_post_max,
       i.past_brands_json, i.collaboration_types_json,
       i.profile_image_url, i.age,
       i.wallet_balance, i.pending_balance,
       u.name, u.id AS user_id, u.status AS user_status
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer not found', 404);
  return success(res, { influencer: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/earnings  (Phase 3 — Block E)
// ─────────────────────────────────────────────────────────────────────────────

const getEarnings = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  // Locked escrow entries for this influencer (T2/T3 not yet released)
  const { rows: lockedEntries } = await db.query(
    `SELECT ee.*, c.name AS campaign_name, c.id AS campaign_id
     FROM escrow_entries ee
     JOIN campaign_influencers ci ON ci.id  = ee.campaign_influencer_id
     JOIN campaign_sets        cs ON cs.id  = ci.set_id
     JOIN campaigns            c  ON c.id   = cs.campaign_id
     WHERE ci.influencer_id = $1 AND ee.status = 'locked'
     ORDER BY ee.tranche_number ASC`,
    [inf.id]
  );

  const pendingAmount = lockedEntries.reduce(
    (sum, e) => sum + parseFloat(e.net_to_influencer),
    0
  );

  // Phase 4: commission summary from follower_transactions
  const { rows: commRows } = await db.query(
    `SELECT
       SUM(CASE WHEN ft.commission_confirmed_at IS NULL THEN ft.influencer_commission ELSE 0 END) AS pending,
       SUM(CASE WHEN ft.commission_confirmed_at IS NOT NULL THEN ft.influencer_commission ELSE 0 END) AS confirmed
     FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     WHERE ci.influencer_id = $1 AND ft.status = 'completed'`,
    [inf.id]
  );
  const commSummary = commRows[0] || { pending: 0, confirmed: 0 };
  const pendingComm   = parseFloat(commSummary.pending  || 0);
  const confirmedComm = parseFloat(commSummary.confirmed || 0);

  // Phase 5: recent withdrawals + TDS this financial year
  const { rows: recentWithdrawals } = await db.query(
    `SELECT id AS withdrawal_id, amount_requested, tds_deducted, net_paid,
            method, status, created_at, completed_at
     FROM influencer_withdrawals
     WHERE influencer_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [inf.id]
  );

  // Indian financial year: April 1 to March 31
  const now = new Date();
  const fyStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)        // April 1 this year
    : new Date(now.getFullYear() - 1, 3, 1);   // April 1 last year

  const { rows: tdsRows } = await db.query(
    `SELECT COALESCE(SUM(tds_deducted), 0) AS tds_this_fy
     FROM influencer_withdrawals
     WHERE influencer_id = $1
       AND status IN ('completed', 'processing')
       AND created_at >= $2`,
    [inf.id, fyStart.toISOString()]
  );
  const tdsThisFinancialYear = parseFloat(tdsRows[0].tds_this_fy || 0);

  // available_to_withdraw = current wallet_balance
  const availableToWithdraw = parseFloat(inf.wallet_balance);

  return success(res, {
    wallet_balance:           inf.wallet_balance,
    pending_balance:          inf.pending_balance,
    total_earned:             inf.total_earned,
    available_to_withdraw:    availableToWithdraw,
    pending_amount:           pendingAmount.toFixed(2),
    locked_entries:           lockedEntries,
    commission_summary: {
      pending:   pendingComm,
      confirmed: confirmedComm,
      total:     pendingComm + confirmedComm,
    },
    recent_withdrawals:       recentWithdrawals,
    tds_this_financial_year:  tdsThisFinancialYear,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/tds-certificate?fy=2024-25
// Returns a Form 16A-style PDF for the requested financial year
// ─────────────────────────────────────────────────────────────────────────────

const getTdsCertificate = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  // Parse requested FY — default to current FY
  const fyParam = (req.query.fy || '').trim();
  let fyStart, fyEnd, fyLabel;

  if (fyParam && /^\d{4}-\d{2}$/.test(fyParam)) {
    const startYear = parseInt(fyParam.slice(0, 4));
    fyStart = new Date(startYear, 3, 1);       // April 1 of start year
    fyEnd   = new Date(startYear + 1, 2, 31);  // March 31 of end year
    fyLabel = fyParam;
  } else {
    // Default: current Indian financial year
    const now = new Date();
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    fyStart = new Date(startYear, 3, 1);
    fyEnd   = new Date(startYear + 1, 2, 31);
    fyLabel = `${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  // Query completed withdrawals within the FY
  const { rows: withdrawalRows } = await db.query(
    `SELECT COALESCE(SUM(amount_requested), 0) AS gross_earnings,
            COALESCE(SUM(tds_deducted), 0)     AS tds_deducted,
            COALESCE(SUM(net_paid), 0)          AS net_paid
     FROM influencer_withdrawals
     WHERE influencer_id = $1
       AND status IN ('completed', 'processing')
       AND created_at >= $2
       AND created_at <= $3`,
    [inf.id, fyStart.toISOString(), fyEnd.toISOString()]
  );

  const grossEarnings = parseFloat(withdrawalRows[0].gross_earnings);
  const tdsDeducted   = parseFloat(withdrawalRows[0].tds_deducted);
  const netPaid       = parseFloat(withdrawalRows[0].net_paid);

  // Fetch name and phone from users table for the cert
  const { rows: userRows } = await db.query(
    `SELECT u.name AS full_name, u.phone, i.instagram_handle, i.pan_number
     FROM users u
     JOIN influencers i ON i.user_id = u.id
     WHERE u.id = $1`,
    [req.user.sub]
  );
  const influencerDetails = userRows[0] || {};

  const pdfBuffer = await pdfService.generateTdsCertificate({
    influencer: influencerDetails,
    fy:         fyLabel,
    fyStart,
    fyEnd,
    grossEarnings,
    tdsDeducted,
    netPaid,
  });

  const filename = `inflx_tds_certificate_${fyLabel.replace('-', '_')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  return res.end(pdfBuffer);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /influencers/:id/rescrape  (admin only — refresh Instagram stats)
// ─────────────────────────────────────────────────────────────────────────────

const rescrape = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerById(req.params.id);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer not found', 404);

  const scraped = await apifyService.scrapeProfile(influencer.instagram_handle);

  await db.query(
    `UPDATE influencers
     SET followers_count = $1, engagement_rate = $2, niche = $3,
         scrape_data = $4, scrape_last_run = now()
     WHERE id = $5`,
    [
      scraped.followers_count,
      scraped.engagement_rate,
      scraped.niche,
      JSON.stringify(scraped.scrape_data),
      influencer.id,
    ]
  );

  const updated = await getInfluencerById(influencer.id);
  return success(res, { influencer: sanitiseInfluencer(updated), scraped_at: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported for admin controller re-use
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { register, getMe, updateMe, search, getPublicById, getInfluencerById, getEarnings, getTdsCertificate, rescrape };
