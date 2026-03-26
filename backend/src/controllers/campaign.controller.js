'use strict';

const db = require('../config/db');
const notificationService = require('../services/notification.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the brand profile for a user, or throw 404 if not registered.
 */
async function getBrandOrThrow(userId) {
  const { rows } = await db.query(
    `SELECT id, user_id, wallet_balance, platform_fee_pct FROM brands WHERE user_id = $1`,
    [userId]
  );
  if (!rows[0]) {
    throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);
  }
  return rows[0];
}

/**
 * Get a campaign by ID and verify ownership. Throws 404 if missing, 403 if not owned.
 */
async function getCampaignOrThrow(campaignId, brandId) {
  const { rows } = await db.query(
    `SELECT * FROM campaigns WHERE id = $1`,
    [campaignId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  if (rows[0].brand_id !== brandId) {
    throw new AppError('FORBIDDEN', 'You do not own this campaign', 403);
  }
  return rows[0];
}

/**
 * Get a campaign set by ID and verify it belongs to the given campaign.
 * Throws 404 if missing.
 */
async function getSetOrThrow(setId, campaignId) {
  const { rows } = await db.query(
    `SELECT * FROM campaign_sets WHERE id = $1 AND campaign_id = $2`,
    [setId, campaignId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign set not found', 404);
  return rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Block A2 — Campaign CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /campaigns
 * Create a new campaign in draft status.
 */
const create = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { name, total_budget, start_date, end_date, brief } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }

  const { rows } = await db.query(
    `INSERT INTO campaigns (brand_id, name, total_budget, start_date, end_date, brief)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      brand.id,
      name.trim(),
      total_budget != null ? total_budget : null,
      start_date || null,
      end_date || null,
      brief || null,
    ]
  );

  return success(res, { campaign: rows[0] }, 201);
});

/**
 * GET /campaigns
 * List all campaigns belonging to the authenticated brand.
 */
const list = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);

  const { rows } = await db.query(
    `SELECT * FROM campaigns WHERE brand_id = $1 ORDER BY created_at DESC`,
    [brand.id]
  );

  return success(res, { campaigns: rows });
});

/**
 * GET /campaigns/:id
 * Get a single campaign. Only the owning brand can view it.
 */
const getById = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  return success(res, { campaign });
});

/**
 * PATCH /campaigns/:id
 * Update campaign fields. Only allowed on draft campaigns.
 */
const update = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  if (campaign.status !== 'draft') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Only draft campaigns can be edited. Current status: ${campaign.status}`,
      422
    );
  }

  const allowed = ['name', 'total_budget', 'start_date', 'end_date'];
  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (Object.keys(updates).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided to update', 422);
  }

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
  const values = [campaign.id, ...Object.values(updates)];

  await db.query(
    `UPDATE campaigns SET ${setClauses.join(', ')} WHERE id = $1`,
    values
  );

  const { rows } = await db.query(`SELECT * FROM campaigns WHERE id = $1`, [campaign.id]);
  return success(res, { campaign: rows[0] });
});

/**
 * DELETE /campaigns/:id
 * Delete a campaign. Only allowed on draft campaigns.
 */
const remove = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  if (campaign.status !== 'draft') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Only draft campaigns can be deleted. Current status: ${campaign.status}`,
      422
    );
  }

  await db.query(`DELETE FROM campaigns WHERE id = $1`, [campaign.id]);
  return success(res, { message: 'Campaign deleted successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block A3 — Campaign Sets CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /campaigns/:id/sets
 */
const createSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  const {
    name,
    goal,
    assignment_mode,
    budget,
    open_group_slots,
    content_start_date,
    content_end_date,
    filters_json,
  } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }

  const { rows } = await db.query(
    `INSERT INTO campaign_sets
       (campaign_id, name, goal, assignment_mode, budget, open_group_slots,
        content_start_date, content_end_date, filters_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      campaign.id,
      name.trim(),
      goal || null,
      assignment_mode || null,
      budget != null ? budget : null,
      open_group_slots != null ? open_group_slots : null,
      content_start_date || null,
      content_end_date || null,
      filters_json ? JSON.stringify(filters_json) : null,
    ]
  );

  return success(res, { set: rows[0] }, 201);
});

/**
 * PATCH /campaigns/:id/sets/:sid
 */
const updateSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);

  const allowed = [
    'name', 'goal', 'assignment_mode', 'budget',
    'open_group_slots', 'content_start_date', 'content_end_date',
  ];
  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (Object.keys(updates).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided to update', 422);
  }

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
  const values = [set.id, ...Object.values(updates)];

  await db.query(
    `UPDATE campaign_sets SET ${setClauses.join(', ')} WHERE id = $1`,
    values
  );

  const { rows } = await db.query(`SELECT * FROM campaign_sets WHERE id = $1`, [set.id]);
  return success(res, { set: rows[0] });
});

/**
 * DELETE /campaigns/:id/sets/:sid
 */
const deleteSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);

  await db.query(`DELETE FROM campaign_sets WHERE id = $1`, [set.id]);
  return success(res, { message: 'Set deleted successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block A — Invite (handpick)
// POST /campaigns/:id/sets/:sid/invite
// ─────────────────────────────────────────────────────────────────────────────

const invite = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);
  await getSetOrThrow(req.params.sid, req.params.id);

  const { influencer_id, agreed_fee, posting_date } = req.body;

  if (!influencer_id) {
    throw new AppError('VALIDATION_ERROR', 'influencer_id is required', 422, 'influencer_id');
  }

  // Verify influencer exists
  const { rows: infRows } = await db.query(
    `SELECT i.id, u.id AS user_id, u.fcm_token, u.phone
     FROM influencers i JOIN users u ON u.id = i.user_id
     WHERE i.id = $1`,
    [influencer_id]
  );
  if (!infRows[0]) throw new AppError('NOT_FOUND', 'Influencer not found', 404);

  // Prevent duplicate invite to same set
  const { rows: existing } = await db.query(
    `SELECT id FROM campaign_influencers WHERE set_id = $1 AND influencer_id = $2`,
    [req.params.sid, influencer_id]
  );
  if (existing[0]) {
    throw new AppError('CONFLICT', 'Influencer is already invited to this set', 409);
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

  const { rows } = await db.query(
    `INSERT INTO campaign_influencers
       (set_id, influencer_id, status, agreed_fee, posting_date, offer_expires_at)
     VALUES ($1, $2, 'invited', $3, $4, $5)
     RETURNING *`,
    [req.params.sid, influencer_id, agreed_fee || null, posting_date || null, expiresAt]
  );

  // Notify influencer (push + SMS per spec Section 6)
  const inf = infRows[0];
  await notificationService.send({
    userId: inf.user_id,
    type: 'offer.invited',
    title: 'New Campaign Invitation',
    body: 'You have received a new campaign invitation. Check your offers inbox.',
    data: {
      screen: 'offer_inbox',
      campaign_influencer_id: rows[0].id,
    },
    fcmToken: inf.fcm_token,
    sendSms: true,
    phone: inf.phone,
  });

  return success(res, { campaign_influencer: rows[0] }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// Block A4 — Offer creation
// POST /campaigns/:id/sets/:sid/offers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_OFFER_TYPES = ['flat', 'percentage', 'bogo', 'bundle', 'volume', 'prebook'];

const createOffer = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  await getSetOrThrow(req.params.sid, req.params.id);

  const {
    offer_type,
    discount_value,
    availing_modes,
    products_json,
    bundle_price,
    volume_threshold,
    prebook_advance,
  } = req.body;

  if (!offer_type) {
    throw new AppError('VALIDATION_ERROR', 'offer_type is required', 422, 'offer_type');
  }
  if (!VALID_OFFER_TYPES.includes(offer_type)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `offer_type must be one of: ${VALID_OFFER_TYPES.join(', ')}`,
      422,
      'offer_type'
    );
  }

  const { rows } = await db.query(
    `INSERT INTO campaign_offers
       (campaign_id, set_id, offer_type, discount_value, availing_modes,
        products_json, bundle_price, volume_threshold, prebook_advance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      campaign.id,
      req.params.sid,
      offer_type,
      discount_value != null ? discount_value : null,
      availing_modes || null,
      products_json ? JSON.stringify(products_json) : null,
      bundle_price != null ? bundle_price : null,
      volume_threshold != null ? volume_threshold : null,
      prebook_advance != null ? prebook_advance : null,
    ]
  );

  return success(res, { offer: rows[0] }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// Block A6 — Publish campaign
// POST /campaigns/:id/publish
// ─────────────────────────────────────────────────────────────────────────────

const publish = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  // Only draft campaigns can be published
  if (campaign.status !== 'draft') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Campaign is already ${campaign.status} and cannot be published again`,
      422
    );
  }

  // Campaign must have a budget set
  if (!campaign.total_budget || parseFloat(campaign.total_budget) <= 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Campaign must have a total_budget set before publishing',
      422,
      'total_budget'
    );
  }

  // Check wallet balance
  const { rows: brandRows } = await db.query(
    `SELECT wallet_balance FROM brands WHERE id = $1`,
    [brand.id]
  );
  const walletBalance = parseFloat(brandRows[0].wallet_balance);
  const budget = parseFloat(campaign.total_budget);

  if (walletBalance < budget) {
    throw new AppError(
      'WALLET_INSUFFICIENT',
      `Insufficient wallet balance. Required: ₹${budget.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)}`,
      422
    );
  }

  // Atomically debit wallet + create escrow_lock transaction + update campaign status
  const newBalance = walletBalance - budget;

  await db.withTransaction(async (client) => {
    // 1. Debit brand wallet
    await client.query(
      `UPDATE brands SET wallet_balance = $1 WHERE id = $2`,
      [newBalance, brand.id]
    );

    // 2. Record escrow_lock wallet transaction
    await client.query(
      `INSERT INTO wallet_transactions
         (brand_id, type, amount, direction, balance_after, campaign_id, notes)
       VALUES ($1, 'escrow_lock', $2, 'debit', $3, $4, $5)`,
      [
        brand.id,
        budget,
        newBalance,
        campaign.id,
        `Escrow lock for campaign: ${campaign.name}`,
      ]
    );

    // 3. Mark campaign as published
    await client.query(
      `UPDATE campaigns SET status = 'published', published_at = now() WHERE id = $1`,
      [campaign.id]
    );
  });

  const { rows: updatedCampaign } = await db.query(
    `SELECT * FROM campaigns WHERE id = $1`,
    [campaign.id]
  );

  return success(res, {
    campaign: updatedCampaign[0],
    wallet_balance: newBalance,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /campaigns/:id/live  (Phase 3 — Block E)
// Full live hierarchy: campaign → sets → influencers → deliverables + escrow
// ─────────────────────────────────────────────────────────────────────────────

const getLiveHierarchy = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);

  const { rows: campaignRows } = await db.query(
    `SELECT * FROM campaigns WHERE id = $1`,
    [req.params.id]
  );
  if (!campaignRows[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  if (campaignRows[0].brand_id !== brand.id) {
    throw new AppError('FORBIDDEN', 'You do not own this campaign', 403);
  }
  const campaign = { ...campaignRows[0] };

  // Fetch sets
  const { rows: sets } = await db.query(
    `SELECT * FROM campaign_sets WHERE campaign_id = $1 ORDER BY id ASC`,
    [campaign.id]
  );

  // For each set, attach influencers with their deliverables + escrow
  for (const set of sets) {
    const { rows: influencers } = await db.query(
      `SELECT ci.*,
              inf.instagram_handle,
              u.name AS influencer_name,
              u.phone AS influencer_phone
       FROM campaign_influencers ci
       JOIN influencers inf ON inf.id = ci.influencer_id
       JOIN users       u   ON u.id   = inf.user_id
       WHERE ci.set_id = $1
       ORDER BY ci.id ASC`,
      [set.id]
    );

    for (const inf of influencers) {
      // Deliverables
      const { rows: deliverables } = await db.query(
        `SELECT * FROM deliverables WHERE campaign_influencer_id = $1 ORDER BY id ASC`,
        [inf.id]
      );
      inf.deliverables = deliverables;

      // Escrow entries
      const { rows: escrow } = await db.query(
        `SELECT * FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY tranche_number ASC`,
        [inf.id]
      );
      inf.escrow = escrow;
    }

    set.influencers = influencers;
  }

  campaign.sets = sets;

  return success(res, { campaign });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
  createSet,
  updateSet,
  deleteSet,
  invite,
  createOffer,
  publish,
  getLiveHierarchy,
};
