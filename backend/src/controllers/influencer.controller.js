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
  // Indicate whether the influencer has configured a payout method (without revealing the values)
  safe.has_payout_method = !!(bank_account_no || upi_id);
  safe.has_pan = !!pan_number;
  safe.has_bank_account = !!bank_account_no;
  safe.has_upi = !!upi_id;
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

  const sanitised = sanitiseInfluencer(influencer);
  // Include phone as read-only for profile display
  sanitised.phone = influencer.phone;

  return success(res, {
    influencer: sanitised,
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
    bio,
    city,
    full_name,
    name: userName,
  } = req.body;

  const updates = {};

  if (language !== undefined) updates.language = language;
  if (content_style !== undefined) updates.content_style = content_style;
  if (niche !== undefined) updates.niche = niche;
  if (youtube_handle !== undefined) updates.youtube_handle = youtube_handle;
  if (bank_ifsc !== undefined) updates.bank_ifsc = bank_ifsc;
  if (bio !== undefined) updates.bio = bio;
  if (city !== undefined) updates.city = city;
  if (full_name !== undefined) updates.full_name = full_name;

  // Encrypt sensitive fields before storing
  if (upi_id !== undefined) updates.upi_id = encrypt(upi_id);
  if (bank_account_no !== undefined) updates.bank_account_no = encrypt(bank_account_no);
  if (pan_number !== undefined) updates.pan_number = encrypt(pan_number);

  // Update name on users table if provided
  const nameUpdate = userName !== undefined ? userName : full_name;

  if (Object.keys(updates).length === 0 && nameUpdate === undefined) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided to update', 422);
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
    const values = [influencer.id, ...Object.values(updates)];

    await db.query(
      `UPDATE influencers SET ${setClauses.join(', ')} WHERE id = $1`,
      values
    );
  }

  if (nameUpdate !== undefined) {
    await db.query(`UPDATE users SET name = $1 WHERE id = $2`, [nameUpdate, req.user.sub]);
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/campaigns
// Returns all campaigns the influencer is part of (via campaign_influencers)
// ─────────────────────────────────────────────────────────────────────────────

const getMyCampaigns = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const { status } = req.query;
  const conditions = [`ci.influencer_id = $1`];
  const params = [inf.id];

  // Filter by campaign_influencer status group
  if (status === 'active') {
    conditions.push(`ci.status IN ('accepted', 'contracted', 'active')`);
  } else if (status === 'completed') {
    conditions.push(`ci.status = 'completed'`);
  }
  // 'all' or no filter returns everything except declined/expired
  if (!status || status === 'all') {
    conditions.push(`ci.status NOT IN ('declined', 'expired')`);
  }

  const { rows } = await db.query(
    `SELECT
       ci.id AS campaign_influencer_id,
       ci.status AS influencer_status,
       ci.agreed_fee,
       ci.posting_date,
       ci.contract_signed_at,
       ci.brand_signed_at,
       ci.created_at AS invited_at,
       c.id AS campaign_id,
       c.name AS campaign_name,
       c.brief,
       c.status AS campaign_status,
       c.start_date,
       c.end_date,
       cs.name AS set_name,
       cs.goal,
       b.business_name AS brand_name,
       (SELECT COUNT(*) FROM deliverables d WHERE d.campaign_influencer_id = ci.id) AS deliverable_count,
       (SELECT COUNT(*) FROM deliverables d WHERE d.campaign_influencer_id = ci.id AND d.status = 'approved') AS approved_count
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ci.created_at DESC`,
    params
  );

  return success(res, { campaigns: rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/campaigns/:campaign_influencer_id
// Full campaign detail from the influencer's perspective
// ─────────────────────────────────────────────────────────────────────────────

const getMyCampaignDetail = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const ciId = req.params.campaign_influencer_id;

  // Validate UUID format to avoid Postgres cast errors
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!ciId || !uuidRegex.test(ciId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid campaign assignment ID', 400);
  }

  let campaign, deliverables = [], contract = null, tranches = [];

  // Step 1: Main campaign + influencer assignment
  try {
    const { rows: ciRows } = await db.query(
      `SELECT
         ci.id AS campaign_influencer_id,
         ci.status AS influencer_status,
         ci.agreed_fee,
         ci.influencer_budget,
         ci.posting_date,
         ci.coupon_code,
         ci.commission_pct,
         ci.offer_type,
         ci.offer_config_json,
         ci.physical_delivery,
         ci.delivery_address,
         ci.contract_signed_at,
         ci.brand_signed_at,
         ci.created_at AS invited_at,
         c.id AS campaign_id,
         c.name AS campaign_name,
         c.brief,
         c.status AS campaign_status,
         c.start_date,
         c.end_date,
         c.total_budget,
         cs.id AS set_id,
         cs.name AS set_name,
         cs.goal,
         cs.set_budget,
         cs.per_influencer_budget,
         cs.coupon_prefix,
         cs.content_start_date,
         cs.content_end_date,
         cs.formats_json,
         b.id AS brand_id,
         b.business_name AS brand_name,
         b.logo_url AS brand_logo_url,
         u.name AS brand_contact_name
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       JOIN brands b ON b.id = c.brand_id
       JOIN users u ON u.id = b.user_id
       WHERE ci.id = $1 AND ci.influencer_id = $2`,
      [ciId, inf.id]
    );
    if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Campaign assignment not found', 404);
    campaign = ciRows[0];
  } catch (e) {
    if (e instanceof AppError) throw e;
    console.error('[getMyCampaignDetail] Step 1 (main query) failed:', e.message);
    throw new AppError('INTERNAL_ERROR', `Campaign query failed: ${e.message}`, 500);
  }

  // Step 2: Deliverables
  try {
    const { rows } = await db.query(
      `SELECT d.id, d.type, d.quantity, d.status, d.submission_deadline,
              d.submitted_at, d.live_url, d.live_confirmed_at,
              d.revision_count, d.revision_limit, d.brand_feedback
       FROM deliverables d
       WHERE d.campaign_influencer_id = $1
       ORDER BY d.id ASC`,
      [ciId]
    );
    deliverables = rows;
  } catch (e) {
    console.error('[getMyCampaignDetail] Step 2 (deliverables) failed:', e.message);
    // Non-critical: return empty deliverables
  }

  // Step 3: Contract (moved before Step 2b which depends on contract status)
  try {
    const { rows: contractRows } = await db.query(
      `SELECT id, status, influencer_signed_at, brand_signed_at, pdf_url, created_at
       FROM contracts
       WHERE campaign_influencer_id = $1`,
      [ciId]
    );
    contract = contractRows[0] || null;
  } catch (e) {
    console.error('[getMyCampaignDetail] Step 3 (contract) failed:', e.message);
    // Non-critical: contract may not exist yet
  }

  // Step 2b: Auto-create deliverables if contract is active but none exist
  // (handles contracts signed before deliverable-creation fix was deployed)
  if (deliverables.length === 0 && contract && (contract.status === 'active' || contract.status === 'completed')) {
    try {
      // Fetch formats_json from the campaign set
      const { rows: setRows } = await db.query(
        `SELECT cs.formats_json FROM campaign_sets cs
         JOIN campaign_influencers ci ON ci.set_id = cs.id
         WHERE ci.id = $1`,
        [ciId]
      );
      let formats = [];
      if (setRows[0]?.formats_json) {
        const raw = setRows[0].formats_json;
        formats = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
      }
      if (formats.length === 0) formats = [{ type: 'reel', count: 1 }];

      for (const fmt of formats) {
        const delType = fmt.type || 'reel';
        const count = parseInt(fmt.count, 10) || 1;
        for (let i = 0; i < count; i++) {
          await db.query(
            `INSERT INTO deliverables
               (campaign_influencer_id, type, quantity, status, submission_deadline, revision_limit)
             VALUES ($1, $2, 1, 'pending', $3, 2)`,
            [ciId, delType, campaign.posting_date || null]
          );
        }
      }

      // Re-fetch deliverables after creation
      const { rows: newRows } = await db.query(
        `SELECT d.id, d.type, d.quantity, d.status, d.submission_deadline,
                d.submitted_at, d.live_url, d.live_confirmed_at,
                d.revision_count, d.revision_limit, d.brand_feedback
         FROM deliverables d
         WHERE d.campaign_influencer_id = $1
         ORDER BY d.id ASC`,
        [ciId]
      );
      deliverables = newRows;
      console.log(`[getMyCampaignDetail] Auto-created ${deliverables.length} deliverable(s) for CI ${ciId}`);
    } catch (e) {
      console.error('[getMyCampaignDetail] Step 2b (auto-create deliverables) failed:', e.message);
    }
  }

  // Step 4: Escrow / tranche entries
  try {
    const { rows } = await db.query(
      `SELECT tranche_number, amount, net_to_influencer, status, trigger_event, triggered_at, released_at
       FROM escrow_entries
       WHERE campaign_influencer_id = $1
       ORDER BY tranche_number ASC`,
      [ciId]
    );
    tranches = rows;
  } catch (e) {
    console.error('[getMyCampaignDetail] Step 4 (escrow) failed:', e.message);
    // Non-critical: tranches may not exist yet
  }

  return success(res, {
    campaign,
    deliverables,
    contract,
    tranches,
  });
});

// ── GET /influencers/me/store-preview — influencer sees their store as followers see it

const followerService = require('../services/follower.service');

const storePreview = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const data = await followerService.getInfluencerStorePreview(inf.id);
  if (!data) throw new AppError('NOT_FOUND', 'Store data not found', 404);

  return success(res, data);
});

// ── GET /influencers/me/campaigns/:ci_id/products — products assigned via campaign
const getCampaignProducts = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const { campaign_influencer_id } = req.params;

  // Verify this CI belongs to the influencer
  const { rows: ciRows } = await db.query(
    `SELECT ci.id, ci.set_id, cs.campaign_id, c.brand_id, b.business_name, b.category,
            ci.offer_type, ci.offer_config_json
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
     WHERE ci.id = $1 AND ci.influencer_id = $2`,
    [campaign_influencer_id, inf.id]
  );
  if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Campaign assignment not found', 404);
  const ci = ciRows[0];

  // Get offer data — first from campaign_influencers (per-influencer offer), then campaign_offers
  const ciOfferType = ciRows[0].offer_type || null;
  const ciOfferConfig = ciRows[0].offer_config_json || {};
  const offerConfigProducts = ciOfferConfig.products || [];

  // Also check campaign_offers for this set
  const { rows: offers } = await db.query(
    `SELECT id, offer_type, discount_value, products_json, availing_modes
     FROM campaign_offers WHERE set_id = $1 AND is_active = true`,
    [ci.set_id]
  );

  // Get existing notes (published products) by this influencer for this campaign FIRST
  const { rows: notes } = await db.query(
    `SELECT product_id, note_text FROM influencer_product_notes
     WHERE influencer_id = $1 AND campaign_id = $2`,
    [inf.id, ci.campaign_id]
  );
  const publishedProductIds = notes.map(n => n.product_id);

  // Determine product IDs — priority order:
  // 1. offer_config_json.products (brand selected specific products for this influencer)
  // 2. campaign_offers.products_json (set-level product assignment)
  // 3. Published products (influencer already published these)
  // 4. All brand products (fallback — brand-level offer, no specific products)
  let productIds = [];

  // From per-influencer offer config
  if (Array.isArray(offerConfigProducts) && offerConfigProducts.length > 0) {
    productIds = offerConfigProducts.map(p => typeof p === 'string' ? p : p.product_id || p.id).filter(Boolean);
  }

  // From campaign_offers if no per-influencer products
  if (productIds.length === 0) {
    productIds = offers.flatMap(o => {
      if (!o.products_json) return [];
      const pj = typeof o.products_json === 'string' ? JSON.parse(o.products_json) : o.products_json;
      return (Array.isArray(pj) ? pj : []).map(p => typeof p === 'string' ? p : p.product_id).filter(Boolean);
    });
  }

  // From published notes if still no specific products
  if (productIds.length === 0 && publishedProductIds.length > 0) {
    productIds = publishedProductIds;
  }

  let products;
  if (productIds.length > 0) {
    const { rows } = await db.query(
      `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
       FROM brand_products WHERE brand_id = $1 AND id = ANY($2) AND is_active = true
       ORDER BY section NULLS LAST, name`,
      [ci.brand_id, productIds]
    );
    products = rows;
  } else {
    // No specific products at all — return all brand products
    const { rows } = await db.query(
      `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
       FROM brand_products WHERE brand_id = $1 AND is_active = true
       ORDER BY section NULLS LAST, name`,
      [ci.brand_id]
    );
    products = rows;
  }

  // Build discount info from CI or campaign_offers
  const discountValue = ciOfferConfig.value || offers[0]?.discount_value || ci.commission_pct || null;
  const offerType = ciOfferType || offers[0]?.offer_type || null;
  const noteMap = {};
  for (const n of notes) noteMap[n.product_id] = n.note_text;

  // Attach notes to products
  const productsWithNotes = products.map(p => ({
    ...p,
    price: parseFloat(p.price || 0),   // rupees — brand_products.price is stored in rupees
    influencer_note: noteMap[p.id] || null,
    is_published: !!noteMap[p.id],     // has note = published to store
  }));

  return success(res, {
    campaign_id: ci.campaign_id,
    brand: { id: ci.brand_id, name: ci.business_name, category: ci.category },
    offer: {
      type: offerType,
      discount_value: discountValue,
      config: ciOfferConfig,
    },
    offers,
    products: productsWithNotes,
  });
});

// ── GET /influencers/me/transactions — influencer's transaction feed
const getMyTransactions = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const { campaign_id, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['ci.influencer_id = $1'];
  const params = [inf.id];
  if (campaign_id) { params.push(campaign_id); conditions.push(`ft.campaign_id = $${params.length}`); }
  const where = conditions.join(' AND ');

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     WHERE ${where}`,
    params
  );

  params.push(limitNum, offset);
  const { rows } = await db.query(
    `SELECT
       ft.id, ft.transaction_type, ft.status, ft.gross_amount, ft.net_amount,
       ft.influencer_commission, ft.coupon_code_used, ft.created_at,
       b.business_name AS brand_name, b.category AS brand_category,
       c.name AS campaign_name,
       u_f.name AS follower_name,
       bp.name AS product_name,
       fb.booking_date, fb.booking_time, fb.reference_code AS booking_ref
     FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     JOIN brands b ON b.id = ft.brand_id
     LEFT JOIN campaigns c ON c.id = ft.campaign_id
     LEFT JOIN followers f ON f.id = ft.follower_id
     LEFT JOIN users u_f ON u_f.id = f.user_id
     LEFT JOIN follower_bookings fb ON fb.transaction_id = ft.id
     LEFT JOIN follower_orders fo2 ON fo2.transaction_id = ft.id
     LEFT JOIN brand_products bp ON bp.id = CASE WHEN fo2.items_json IS NOT NULL THEN (fo2.items_json->0->>'product_id')::uuid ELSE NULL END
     WHERE ${where}
     ORDER BY ft.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // Summary
  const { rows: summary } = await db.query(
    `SELECT
       COUNT(*)::int AS total_transactions,
       COALESCE(SUM(ft.influencer_commission), 0)::bigint AS total_commission,
       COUNT(CASE WHEN ft.created_at >= CURRENT_DATE THEN 1 END)::int AS today_count,
       COALESCE(SUM(CASE WHEN ft.created_at >= CURRENT_DATE THEN ft.influencer_commission ELSE 0 END), 0)::bigint AS today_commission
     FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     WHERE ci.influencer_id = $1 AND ft.status = 'completed'`,
    [inf.id]
  );

  return success(res, {
    transactions: rows,
    summary: summary[0],
  }, 200, { page: pageNum, limit: limitNum, total: countRows[0].count });
});

module.exports = { register, getMe, updateMe, search, getPublicById, getInfluencerById, getEarnings, getTdsCertificate, rescrape, getMyCampaigns, getMyCampaignDetail, storePreview, getCampaignProducts, getMyTransactions };
