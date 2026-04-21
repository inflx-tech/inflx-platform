'use strict';

const db                  = require('../config/db');
const notificationService = require('../services/notification.service');
const { success }         = require('../utils/response');
const AppError            = require('../utils/AppError');
const asyncHandler        = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

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

async function getSetOrThrow(setId, campaignId) {
  const { rows } = await db.query(
    `SELECT * FROM campaign_sets WHERE id = $1 AND campaign_id = $2`,
    [setId, campaignId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign set not found', 404);
  return rows[0];
}

/**
 * Auto-generate a coupon code from prefix + influencer first name.
 * Checks uniqueness; appends numeric suffix if collision.
 */
async function generateUniqueCouponCode(prefix, firstName) {
  const base = `${prefix.toUpperCase()}_${firstName.toUpperCase().split(' ')[0]}`;
  let code = base;
  let attempt = 0;
  while (attempt < 10) {
    const { rows } = await db.query(
      `SELECT 1 FROM campaign_influencers WHERE coupon_code = $1`,
      [code]
    );
    if (!rows[0]) return code;
    attempt++;
    code = `${base}${attempt}`;
  }
  throw new AppError('INTERNAL_ERROR', 'Could not generate unique coupon code', 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign CRUD
// ─────────────────────────────────────────────────────────────────────────────

const create = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { name, total_budget, start_date, end_date, brief } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }
  if (!start_date) {
    throw new AppError('VALIDATION_ERROR', 'start_date is required', 422, 'start_date');
  }
  if (!end_date) {
    throw new AppError('VALIDATION_ERROR', 'end_date is required', 422, 'end_date');
  }
  if (new Date(end_date) <= new Date(start_date)) {
    throw new AppError('VALIDATION_ERROR', 'end_date must be after start_date', 422, 'end_date');
  }

  const { rows } = await db.query(
    `INSERT INTO campaigns (brand_id, name, total_budget, start_date, end_date, brief)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      brand.id,
      name.trim(),
      total_budget != null ? total_budget : null,
      start_date,
      end_date,
      brief || null,
    ]
  );

  return success(res, { campaign: rows[0] }, 201);
});

const list = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);

  const { rows } = await db.query(
    `SELECT * FROM campaigns WHERE brand_id = $1 ORDER BY created_at DESC`,
    [brand.id]
  );

  return success(res, { campaigns: rows });
});

const getById = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  // Attach sets with influencers
  const { rows: sets } = await db.query(
    `SELECT * FROM campaign_sets WHERE campaign_id = $1 ORDER BY id ASC`,
    [campaign.id]
  );
  for (const set of sets) {
    const { rows: influencers } = await db.query(
      `SELECT ci.*, inf.instagram_handle, u.name AS influencer_name, u.phone AS influencer_phone,
              (SELECT n.id FROM negotiations n WHERE n.campaign_influencer_id = ci.id ORDER BY n.created_at DESC LIMIT 1) AS negotiation_id,
              (SELECT n.status FROM negotiations n WHERE n.campaign_influencer_id = ci.id ORDER BY n.created_at DESC LIMIT 1) AS negotiation_status,
              (SELECT n.current_turn FROM negotiations n WHERE n.campaign_influencer_id = ci.id ORDER BY n.created_at DESC LIMIT 1) AS next_turn
       FROM campaign_influencers ci
       JOIN influencers inf ON inf.id = ci.influencer_id
       JOIN users u ON u.id = inf.user_id
       WHERE ci.set_id = $1 ORDER BY ci.id ASC`,
      [set.id]
    );
    set.influencers = influencers;
  }
  campaign.sets = sets;

  return success(res, { campaign });
});

const update = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  if (campaign.status !== 'draft') {
    throw new AppError('VALIDATION_ERROR', `Only draft campaigns can be edited. Current status: ${campaign.status}`, 422);
  }

  const allowed = ['name', 'total_budget', 'start_date', 'end_date', 'brief'];
  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (Object.keys(updates).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided to update', 422);
  }

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
  const values = [campaign.id, ...Object.values(updates)];

  await db.query(`UPDATE campaigns SET ${setClauses.join(', ')} WHERE id = $1`, values);

  const { rows } = await db.query(`SELECT * FROM campaigns WHERE id = $1`, [campaign.id]);
  return success(res, { campaign: rows[0] });
});

const remove = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  if (campaign.status !== 'draft') {
    throw new AppError('VALIDATION_ERROR', `Only draft campaigns can be deleted. Current status: ${campaign.status}`, 422);
  }

  await db.query(`DELETE FROM campaigns WHERE id = $1`, [campaign.id]);
  return success(res, { message: 'Campaign deleted successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Campaign Sets CRUD
// ─────────────────────────────────────────────────────────────────────────────

const getSets = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);

  const { rows: sets } = await db.query(
    `SELECT * FROM campaign_sets WHERE campaign_id = $1 ORDER BY id ASC`,
    [req.params.id]
  );

  for (const set of sets) {
    const { rows: influencers } = await db.query(
      `SELECT ci.*, inf.instagram_handle, u.name AS influencer_name, u.phone AS influencer_phone,
              (SELECT n.id FROM negotiations n WHERE n.campaign_influencer_id = ci.id ORDER BY n.created_at DESC LIMIT 1) AS negotiation_id,
              (SELECT n.status FROM negotiations n WHERE n.campaign_influencer_id = ci.id ORDER BY n.created_at DESC LIMIT 1) AS negotiation_status,
              (SELECT n.current_turn FROM negotiations n WHERE n.campaign_influencer_id = ci.id ORDER BY n.created_at DESC LIMIT 1) AS next_turn
       FROM campaign_influencers ci
       JOIN influencers inf ON inf.id = ci.influencer_id
       JOIN users u ON u.id = inf.user_id
       WHERE ci.set_id = $1 ORDER BY ci.id ASC`,
      [set.id]
    );
    set.influencers = influencers;
  }

  return success(res, { sets });
});

const createSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  const {
    name,
    goal,
    influencer_mode,
    set_budget,
    per_influencer_budget,
    max_cap,
    window_start,
    window_end,
    brief,
    coupon_prefix,
    formats_json,
    assets_json,
    open_group_filters,
  } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }

  const VALID_GOALS = ['conversion', 'engagement', 'hybrid'];
  if (goal && !VALID_GOALS.includes(goal)) {
    throw new AppError('VALIDATION_ERROR', `goal must be one of: ${VALID_GOALS.join(', ')}`, 422, 'goal');
  }

  // Engagement/Hybrid require set_budget; Conversion must not have one
  if ((goal === 'engagement' || goal === 'hybrid') && set_budget == null) {
    throw new AppError('VALIDATION_ERROR', 'set_budget is required for engagement and hybrid goals', 422, 'set_budget');
  }
  if (goal === 'conversion' && set_budget != null) {
    throw new AppError('VALIDATION_ERROR', 'set_budget must not be set for conversion goals', 422, 'set_budget');
  }

  // Conversion/Hybrid require coupon_prefix; Engagement must not have one
  if ((goal === 'conversion' || goal === 'hybrid') && !coupon_prefix) {
    throw new AppError('VALIDATION_ERROR', 'coupon_prefix is required for conversion and hybrid goals', 422, 'coupon_prefix');
  }
  if (goal === 'engagement' && coupon_prefix) {
    throw new AppError('VALIDATION_ERROR', 'coupon_prefix must not be set for engagement goals', 422, 'coupon_prefix');
  }

  // Validate set budget against campaign total
  if (set_budget != null && campaign.total_budget != null) {
    const { rows: existingSets } = await db.query(
      `SELECT COALESCE(SUM(set_budget), 0) AS total FROM campaign_sets WHERE campaign_id = $1`,
      [campaign.id]
    );
    const allocated = parseFloat(existingSets[0].total) + parseFloat(set_budget);
    if (allocated > parseFloat(campaign.total_budget)) {
      throw new AppError('VALIDATION_ERROR', `Set budget exceeds remaining campaign budget. Available: ₹${(parseFloat(campaign.total_budget) - parseFloat(existingSets[0].total)).toFixed(2)}`, 422, 'set_budget');
    }
  }

  const { rows } = await db.query(
    `INSERT INTO campaign_sets
       (campaign_id, name, goal, influencer_mode, set_budget, per_influencer_budget,
        max_cap, window_start, window_end, brief, coupon_prefix,
        formats_json, assets_json, open_group_filters)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      campaign.id,
      name.trim(),
      goal || null,
      influencer_mode || 'handpick',
      set_budget != null ? set_budget : null,
      per_influencer_budget != null ? per_influencer_budget : null,
      max_cap != null ? max_cap : null,
      window_start || null,
      window_end || null,
      brief || null,
      coupon_prefix || null,
      formats_json ? JSON.stringify(formats_json) : '[]',
      assets_json ? JSON.stringify(assets_json) : '[]',
      open_group_filters ? JSON.stringify(open_group_filters) : '{}',
    ]
  );

  return success(res, { set: rows[0] }, 201);
});

const updateSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);

  const allowed = [
    'name', 'goal', 'influencer_mode', 'set_budget', 'per_influencer_budget',
    'max_cap', 'window_start', 'window_end', 'brief', 'coupon_prefix',
    'formats_json', 'assets_json', 'open_group_filters',
  ];
  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) {
      if (['formats_json', 'assets_json', 'open_group_filters'].includes(field)) {
        updates[field] = JSON.stringify(req.body[field]);
      } else {
        updates[field] = req.body[field];
      }
    }
  });

  if (Object.keys(updates).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided to update', 422);
  }

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
  const values = [set.id, ...Object.values(updates)];

  await db.query(`UPDATE campaign_sets SET ${setClauses.join(', ')} WHERE id = $1`, values);

  const { rows } = await db.query(`SELECT * FROM campaign_sets WHERE id = $1`, [set.id]);
  return success(res, { set: rows[0] });
});

const deleteSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);

  // Minimum 1 set must remain
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM campaign_sets WHERE campaign_id = $1`,
    [campaign.id]
  );
  if (parseInt(countRows[0].cnt) <= 1) {
    throw new AppError('VALIDATION_ERROR', 'A campaign must have at least one set', 422);
  }

  await db.query(`DELETE FROM campaign_sets WHERE id = $1`, [set.id]);
  return success(res, { message: 'Set deleted successfully' });
});

/**
 * POST /campaigns/:id/sets/:sid/duplicate
 * Deep copy a set including its influencer assignments. Coupon codes are reset.
 */
const duplicateSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);

  // Count existing sets to auto-name the duplicate
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM campaign_sets WHERE campaign_id = $1`,
    [campaign.id]
  );
  const setLetter = String.fromCharCode(65 + parseInt(countRows[0].cnt)); // A, B, C…
  const newName = `Set ${setLetter}`;

  const { rows: newSetRows } = await db.query(
    `INSERT INTO campaign_sets
       (campaign_id, name, goal, influencer_mode, set_budget, per_influencer_budget,
        max_cap, window_start, window_end, brief, coupon_prefix,
        formats_json, assets_json, open_group_filters)
     SELECT campaign_id, $2, goal, influencer_mode, set_budget, per_influencer_budget,
        max_cap, window_start, window_end, brief, coupon_prefix,
        formats_json, assets_json, open_group_filters
     FROM campaign_sets WHERE id = $1
     RETURNING *`,
    [set.id, newName]
  );
  const newSet = newSetRows[0];

  // Copy influencer assignments — reset coupon codes
  const { rows: influencers } = await db.query(
    `SELECT * FROM campaign_influencers WHERE set_id = $1`,
    [set.id]
  );
  for (const inf of influencers) {
    await db.query(
      `INSERT INTO campaign_influencers
         (set_id, influencer_id, status, agreed_fee, posting_date, offer_expires_at,
          offer_type, offer_config_json, commission_pct, physical_delivery,
          delivery_address, influencer_budget, coupon_code)
       VALUES ($1, $2, 'invited', $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)`,
      [
        newSet.id,
        inf.influencer_id,
        inf.agreed_fee,
        inf.posting_date,
        inf.offer_expires_at,
        inf.offer_type,
        inf.offer_config_json,
        inf.commission_pct,
        inf.physical_delivery,
        inf.delivery_address,
        inf.influencer_budget,
      ]
    );
  }

  return success(res, { set: newSet }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// Invite influencer (handpick)
// POST /campaigns/:id/sets/:sid/invite
// ─────────────────────────────────────────────────────────────────────────────

const invite = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);

  const {
    influencer_id,
    agreed_fee,
    posting_date,
    offer_type,
    offer_config_json,
    commission_pct,
    coupon_code: customCouponCode,
    physical_delivery,
    delivery_address,
    influencer_budget,
  } = req.body;

  if (!influencer_id) {
    throw new AppError('VALIDATION_ERROR', 'influencer_id is required', 422, 'influencer_id');
  }

  const goal = set.goal;

  // Goal-conditional validation
  if (goal === 'engagement') {
    if (offer_type) throw new AppError('VALIDATION_ERROR', 'offer_type must not be set for engagement goal', 422, 'offer_type');
    if (customCouponCode) throw new AppError('VALIDATION_ERROR', 'coupon_code must not be set for engagement goal', 422, 'coupon_code');
  }
  if ((goal === 'conversion' || goal === 'hybrid') && !offer_type) {
    throw new AppError('VALIDATION_ERROR', 'offer_type is required for conversion and hybrid goals', 422, 'offer_type');
  }

  // Verify influencer exists
  const { rows: infRows } = await db.query(
    `SELECT i.id, u.id AS user_id, u.fcm_token, u.phone, u.name AS full_name
     FROM influencers i JOIN users u ON u.id = i.user_id
     WHERE i.id = $1`,
    [influencer_id]
  );
  if (!infRows[0]) throw new AppError('NOT_FOUND', 'Influencer not found', 404);
  const inf = infRows[0];

  // Prevent same influencer in multiple sets of the same campaign
  const { rows: crossSet } = await db.query(
    `SELECT ci.id FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     WHERE cs.campaign_id = $1 AND ci.influencer_id = $2`,
    [campaign.id, influencer_id]
  );
  if (crossSet[0]) {
    throw new AppError('CONFLICT', 'This influencer is already assigned to another set in this campaign', 409);
  }

  // Per-influencer budget validation (Engagement / Hybrid)
  if ((goal === 'engagement' || goal === 'hybrid') && influencer_budget != null && set.set_budget != null) {
    const { rows: allocRows } = await db.query(
      `SELECT COALESCE(SUM(influencer_budget), 0) AS allocated FROM campaign_influencers WHERE set_id = $1`,
      [set.id]
    );
    const remaining = parseFloat(set.set_budget) - parseFloat(allocRows[0].allocated);
    if (parseFloat(influencer_budget) > remaining) {
      throw new AppError('VALIDATION_ERROR', `Budget exceeds remaining set budget of ₹${remaining.toFixed(2)}`, 422, 'influencer_budget');
    }
  }

  // Coupon code handling
  let finalCouponCode = null;
  if (goal === 'conversion' || goal === 'hybrid') {
    if (customCouponCode) {
      // Check custom code uniqueness
      const { rows: dupCheck } = await db.query(
        `SELECT 1 FROM campaign_influencers WHERE coupon_code = $1`,
        [customCouponCode]
      );
      if (dupCheck[0]) {
        throw new AppError('CONFLICT', `Coupon code '${customCouponCode}' is already in use`, 409, 'coupon_code');
      }
      finalCouponCode = customCouponCode;
    } else if (set.coupon_prefix) {
      const firstName = inf.full_name || 'INF';
      finalCouponCode = await generateUniqueCouponCode(set.coupon_prefix, firstName);
    }
  }

  // Submission deadline = post_date - 24h
  let submissionDeadline = null;
  if (posting_date) {
    const pd = new Date(posting_date);
    pd.setHours(pd.getHours() - 24);
    submissionDeadline = pd.toISOString();
  }

  // Offer expires when the influencer's posting_date is reached. If no posting_date
  // is set yet, leave NULL — the offer will not auto-expire until one is assigned.
  const expiresAt = posting_date ? new Date(posting_date) : null;

  const { rows } = await db.query(
    `INSERT INTO campaign_influencers
       (set_id, influencer_id, status, agreed_fee, posting_date, offer_expires_at,
        offer_type, offer_config_json, commission_pct, coupon_code,
        physical_delivery, delivery_address, influencer_budget, submission_deadline)
     VALUES ($1, $2, 'invited', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      set.id,
      influencer_id,
      agreed_fee || null,
      posting_date || null,
      expiresAt,
      offer_type || null,
      offer_config_json ? JSON.stringify(offer_config_json) : null,
      commission_pct || null,
      finalCouponCode,
      physical_delivery || false,
      delivery_address || null,
      influencer_budget || null,
      submissionDeadline,
    ]
  );

  // Notify influencer
  await notificationService.send({
    userId: inf.user_id,
    type: 'offer.invited',
    title: 'New Campaign Invitation',
    body: 'You have received a new campaign invitation. Check your offers inbox.',
    data: { screen: 'offer_inbox', campaign_influencer_id: rows[0].id },
    fcmToken: inf.fcm_token,
    sendSms: true,
    phone: inf.phone,
  });

  return success(res, { campaign_influencer: rows[0] }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// Update an existing campaign_influencer (draft editing)
// PATCH /campaigns/:id/sets/:sid/influencers/:ciId
// ─────────────────────────────────────────────────────────────────────────────

const updateInfluencer = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  if (campaign.status !== 'draft') {
    throw new AppError('VALIDATION_ERROR', 'Can only update influencer assignments on draft campaigns', 422);
  }

  await getSetOrThrow(req.params.sid, req.params.id);

  const ciId = req.params.ciId;
  const { rows: existing } = await db.query(
    `SELECT * FROM campaign_influencers WHERE id = $1 AND set_id = $2`,
    [ciId, req.params.sid]
  );
  if (!existing[0]) {
    throw new AppError('NOT_FOUND', 'Campaign influencer assignment not found', 404);
  }

  const {
    posting_date,
    offer_type,
    offer_config_json,
    commission_pct,
    physical_delivery,
    delivery_address,
    influencer_budget,
    coupon_code,
  } = req.body;

  // Recalculate submission deadline
  let submissionDeadline = existing[0].submission_deadline;
  if (posting_date !== undefined) {
    if (posting_date) {
      const pd = new Date(posting_date);
      pd.setHours(pd.getHours() - 24);
      submissionDeadline = pd.toISOString();
    } else {
      submissionDeadline = null;
    }
  }

  // Keep offer_expires_at in sync with posting_date (new rule: offer expires when
  // influencer's posting_date is reached). If posting_date wasn't part of this
  // request, leave the existing offer_expires_at untouched.
  const newPostingDate = posting_date || null;
  const newOfferExpiresAt = posting_date !== undefined
    ? (newPostingDate ? new Date(newPostingDate) : null)
    : existing[0].offer_expires_at;

  const { rows } = await db.query(
    `UPDATE campaign_influencers SET
       posting_date = $2,
       offer_type = $3,
       offer_config_json = $4,
       commission_pct = $5,
       physical_delivery = $6,
       delivery_address = $7,
       influencer_budget = $8,
       submission_deadline = $9,
       offer_expires_at = $10
     WHERE id = $1
     RETURNING *`,
    [
      ciId,
      newPostingDate,
      offer_type || null,
      offer_config_json ? JSON.stringify(offer_config_json) : null,
      commission_pct != null ? commission_pct : null,
      physical_delivery != null ? physical_delivery : false,
      delivery_address || null,
      influencer_budget != null ? influencer_budget : null,
      submissionDeadline,
      newOfferExpiresAt,
    ]
  );

  return success(res, { campaign_influencer: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Offer creation (legacy — kept for backward compat)
// POST /campaigns/:id/sets/:sid/offers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_OFFER_TYPES = ['flat', 'percentage', 'bogo', 'bundle', 'volume', 'prebook'];

const createOffer = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  await getSetOrThrow(req.params.sid, req.params.id);

  const { offer_type, discount_value, availing_modes, products_json, bundle_price, volume_threshold, prebook_advance } = req.body;

  if (!offer_type) throw new AppError('VALIDATION_ERROR', 'offer_type is required', 422, 'offer_type');
  if (!VALID_OFFER_TYPES.includes(offer_type)) {
    throw new AppError('VALIDATION_ERROR', `offer_type must be one of: ${VALID_OFFER_TYPES.join(', ')}`, 422, 'offer_type');
  }

  const { rows } = await db.query(
    `INSERT INTO campaign_offers
       (campaign_id, set_id, offer_type, discount_value, availing_modes,
        products_json, bundle_price, volume_threshold, prebook_advance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      campaign.id, req.params.sid, offer_type, discount_value ?? null,
      availing_modes || null, products_json ? JSON.stringify(products_json) : null,
      bundle_price ?? null, volume_threshold ?? null, prebook_advance ?? null,
    ]
  );

  return success(res, { offer: rows[0] }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// Publish campaign
// POST /campaigns/:id/publish
// ─────────────────────────────────────────────────────────────────────────────

const publish = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  if (campaign.status !== 'draft') {
    throw new AppError('VALIDATION_ERROR', `Campaign is already ${campaign.status} and cannot be published again`, 422);
  }

  // Fetch all sets to determine if budget is needed
  const { rows: sets } = await db.query(
    `SELECT * FROM campaign_sets WHERE campaign_id = $1`,
    [campaign.id]
  );
  if (!sets.length) {
    throw new AppError('VALIDATION_ERROR', 'Campaign must have at least one set before publishing', 422);
  }

  const hasEngagementOrHybrid = sets.some(s => s.goal === 'engagement' || s.goal === 'hybrid');
  const allConversion = sets.every(s => s.goal === 'conversion');

  // Budget required if any set has engagement or hybrid goal
  if (hasEngagementOrHybrid) {
    if (!campaign.total_budget || parseFloat(campaign.total_budget) <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Campaign must have a total_budget set before publishing', 422, 'total_budget');
    }

    // Validate sum of set budgets <= total_budget (Level 1)
    const totalSetBudget = sets.reduce((sum, s) => {
      return sum + (s.goal !== 'conversion' && s.set_budget ? parseFloat(s.set_budget) : 0);
    }, 0);

    if (totalSetBudget > parseFloat(campaign.total_budget)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Total set budgets (₹${totalSetBudget.toFixed(2)}) exceed campaign budget (₹${parseFloat(campaign.total_budget).toFixed(2)})`,
        422
      );
    }

    // Wallet check — everything is RUPEES (migration 021).
    const { rows: brandRows } = await db.query(
      `SELECT wallet_balance FROM brands WHERE id = $1`,
      [brand.id]
    );
    const walletBalance = parseFloat(brandRows[0].wallet_balance);
    const budget        = parseFloat(campaign.total_budget);

    if (walletBalance < budget) {
      throw new AppError(
        'WALLET_INSUFFICIENT',
        `Insufficient wallet balance. Required: \u20B9${budget.toFixed(2)}, Available: \u20B9${walletBalance.toFixed(2)}`,
        422
      );
    }

    // ── Publish: NO money moves yet ──────────────────────────────────────
    // We only verify the brand has enough in their wallet to potentially
    // cover the full budget. Funds STAY in wallet_balance — they're locked
    // per-influencer at the moment that influencer's contract gets fully
    // brand-signed (see contract.controller.brandSign). This avoids tying
    // up money for influencers who never sign / negotiate down / decline.
    await db.query(
      `UPDATE campaigns SET status = 'active', published_at = now() WHERE id = $1`,
      [campaign.id]
    );
  } else {
    // Conversion-only: no budget needed, just activate
    await db.query(
      `UPDATE campaigns SET status = 'active', published_at = now() WHERE id = $1`,
      [campaign.id]
    );
  }

  // Fire invites for all handpicked influencers
  for (const set of sets) {
    if (set.influencer_mode === 'handpick') {
      const { rows: influencers } = await db.query(
        `SELECT ci.*, u.fcm_token, u.phone, u.id AS user_id
         FROM campaign_influencers ci
         JOIN influencers inf ON inf.id = ci.influencer_id
         JOIN users u ON u.id = inf.user_id
         WHERE ci.set_id = $1 AND ci.status = 'invited'`,
        [set.id]
      );
      for (const inf of influencers) {
        await notificationService.send({
          userId: inf.user_id,
          type: 'offer.invited',
          title: 'New Campaign is Live!',
          body: 'A campaign you were invited to is now active.',
          data: { screen: 'offer_inbox', campaign_influencer_id: inf.id },
          fcmToken: inf.fcm_token,
          sendSms: false,
          phone: inf.phone,
        });
      }
    }
  }

  const { rows: updatedCampaign } = await db.query(`SELECT * FROM campaigns WHERE id = $1`, [campaign.id]);

  // Notify the brand that their campaign is now published/active
  try {
    const { rows: brandUserRows } = await db.query(
      `SELECT u.id AS user_id, u.fcm_token
       FROM brands b JOIN users u ON u.id = b.user_id
       WHERE b.id = $1`,
      [brand.id]
    );
    if (brandUserRows[0]) {
      await notificationService.send({
        userId:   brandUserRows[0].user_id,
        type:     'campaign.published',
        title:    'Campaign Published',
        body:     `Your campaign '${campaign.name}' is now live`,
        data:     { screen: 'campaign_detail', campaign_id: campaign.id },
        fcmToken: brandUserRows[0].fcm_token,
        sendSms:  false,
      });
    }
  } catch (notifErr) {
    console.error('[NOTIFICATION] campaign.published send failed:', notifErr.message);
  }

  return success(res, { campaign: updatedCampaign[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /campaigns/:id/live  — full live hierarchy
// ─────────────────────────────────────────────────────────────────────────────

const getLiveHierarchy = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);

  const { rows: campaignRows } = await db.query(`SELECT * FROM campaigns WHERE id = $1`, [req.params.id]);
  if (!campaignRows[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  if (campaignRows[0].brand_id !== brand.id) throw new AppError('FORBIDDEN', 'You do not own this campaign', 403);
  const campaign = { ...campaignRows[0] };

  const { rows: sets } = await db.query(
    `SELECT * FROM campaign_sets WHERE campaign_id = $1 ORDER BY id ASC`,
    [campaign.id]
  );

  for (const set of sets) {
    const { rows: influencers } = await db.query(
      `SELECT ci.*, inf.instagram_handle, u.name AS influencer_name, u.phone AS influencer_phone
       FROM campaign_influencers ci
       JOIN influencers inf ON inf.id = ci.influencer_id
       JOIN users u ON u.id = inf.user_id
       WHERE ci.set_id = $1 ORDER BY ci.id ASC`,
      [set.id]
    );
    for (const inf of influencers) {
      const { rows: deliverables } = await db.query(
        `SELECT * FROM deliverables WHERE campaign_influencer_id = $1 ORDER BY id ASC`,
        [inf.id]
      );
      inf.deliverables = deliverables;
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
// Cancel campaign — refund unreleased escrow to brand wallet
// POST /campaigns/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────

const cancel = asyncHandler(async (req, res) => {
  const brand    = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  const NON_CANCELLABLE = ['cancelled', 'completed'];
  if (NON_CANCELLABLE.includes(campaign.status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Campaign is already ${campaign.status} and cannot be cancelled`,
      422
    );
  }

  // For draft campaigns there is no locked escrow — just cancel directly
  if (campaign.status === 'draft') {
    await db.query(`UPDATE campaigns SET status = 'cancelled' WHERE id = $1`, [campaign.id]);
    return success(res, { campaign_id: campaign.id, status: 'cancelled', refund_amount: 0 });
  }

  // Refund = sum of LOCKED escrow_entries across all influencers in this
  // campaign + the platform-fee portion that was locked alongside them.
  // All figures in RUPEES (migration 021).
  const { rows: lockedRows } = await db.query(
    `SELECT COALESCE(SUM(ee.amount), 0) AS locked_amount,
            COALESCE(SUM(ee.platform_fee_amount), 0) AS locked_platform_fee
     FROM escrow_entries ee
     JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     WHERE cs.campaign_id = $1 AND ee.status = 'locked'`,
    [campaign.id]
  );
  const lockedAmount   = parseFloat(lockedRows[0].locked_amount || 0);
  const lockedPlatform = parseFloat(lockedRows[0].locked_platform_fee || 0);
  const refundAmount   = parseFloat((lockedAmount + lockedPlatform).toFixed(2));

  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE escrow_entries ee
       SET status = 'cancelled'
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       WHERE ee.campaign_influencer_id = ci.id
         AND cs.campaign_id = $1
         AND ee.status = 'locked'`,
      [campaign.id]
    );

    if (refundAmount > 0) {
      const { rows: brandRows } = await client.query(
        `SELECT wallet_balance FROM brands WHERE id = $1 FOR UPDATE`,
        [brand.id]
      );
      const newBalance = parseFloat((parseFloat(brandRows[0].wallet_balance) + refundAmount).toFixed(2));

      await client.query(
        `UPDATE brands SET wallet_balance = $1 WHERE id = $2`,
        [newBalance, brand.id]
      );

      await client.query(
        `INSERT INTO wallet_transactions
           (brand_id, type, amount, direction, balance_after, campaign_id, notes)
         VALUES ($1, 'refund', $2, 'credit', $3, $4, $5)`,
        [
          brand.id,
          refundAmount,
          newBalance,
          campaign.id,
          `Campaign cancelled — escrow refund for: ${campaign.name}`,
        ]
      );
    }

    await client.query(
      `UPDATE campaigns SET status = 'cancelled' WHERE id = $1`,
      [campaign.id]
    );
  });

  return success(res, {
    campaign_id:   campaign.id,
    status:        'cancelled',
    refund_amount: refundAmount,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancel a single influencer assignment
// POST /campaigns/:id/influencers/:ciid/cancel
// ─────────────────────────────────────────────────────────────────────────────

const cancelInfluencer = asyncHandler(async (req, res) => {
  const brand    = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  const ciid = req.params.ciid;

  // Fetch the campaign_influencer row
  const { rows: ciRows } = await db.query(
    `SELECT ci.*, cs.campaign_id, i.user_id AS influencer_user_id, u.name AS influencer_name, i.instagram_handle
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE ci.id = $1 AND cs.campaign_id = $2`,
    [ciid, campaign.id]
  );

  if (!ciRows[0]) {
    throw new AppError('NOT_FOUND', 'Campaign influencer assignment not found', 404);
  }

  const ci = ciRows[0];

  // Only allow cancel for pre-contract statuses
  const CANCELLABLE = ['invited', 'accepted', 'negotiating'];
  if (!CANCELLABLE.includes(ci.status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot cancel influencer with status "${ci.status}". Only invited, accepted, or negotiating assignments can be cancelled.`,
      422
    );
  }

  // Calculate escrow to refund for this influencer (rupees everywhere).
  const { rows: escrowRows } = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS locked_amount
     FROM escrow_entries
     WHERE campaign_influencer_id = $1 AND status = 'locked'`,
    [ci.id]
  );
  const refundAmount = parseFloat(parseFloat(escrowRows[0].locked_amount).toFixed(2));

  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE campaign_influencers SET status = 'cancelled' WHERE id = $1`,
      [ci.id]
    );

    if (refundAmount > 0) {
      await client.query(
        `UPDATE escrow_entries SET status = 'cancelled' WHERE campaign_influencer_id = $1 AND status = 'locked'`,
        [ci.id]
      );

      // Refund to brand wallet — refundAmount is rupees, wallet is rupees.
      const { rows: balRows } = await client.query(
        `UPDATE brands SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance`,
        [refundAmount, brand.id]
      );
      const newBalance = parseFloat(balRows[0].wallet_balance);

      await client.query(
        `INSERT INTO wallet_transactions
           (brand_id, type, amount, direction, balance_after, campaign_id, notes)
         VALUES ($1, 'refund', $2, 'credit', $3, $4, $5)`,
        [
          brand.id,
          refundAmount,
          newBalance,
          campaign.id,
          `Influencer assignment cancelled \u2014 escrow refund for @${ci.instagram_handle} in: ${campaign.name}`,
        ]
      );
    }
  });

  // Notify the influencer
  try {
    await notificationService.send({
      user_id: ci.influencer_user_id,
      type:    'assignment_cancelled',
      title:   'Assignment Cancelled',
      body:    `Your assignment for campaign "${campaign.name}" has been cancelled by the brand.`,
      data:    { campaign_id: campaign.id, campaign_influencer_id: ci.id },
    });
  } catch (_) { /* notification failure is non-fatal */ }

  return success(res, {
    campaign_influencer_id: ci.id,
    status:        'cancelled',
    refund_amount: refundAmount,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Influencer search for handpick
// GET /campaigns/:id/influencer-search
// ─────────────────────────────────────────────────────────────────────────────

const searchInfluencers = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);

  const { q, tier, niche, city, min_er, gender, limit = 20, offset = 0 } = req.query;

  const conditions = [`u.status = 'approved'`];
  const params = [];
  let idx = 1;

  if (q) {
    conditions.push(`(u.name ILIKE $${idx} OR i.instagram_handle ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (tier) {
    conditions.push(`i.tier = $${idx}`);
    params.push(tier);
    idx++;
  }
  if (niche) {
    conditions.push(`$${idx} = ANY(i.niche)`);
    params.push(niche);
    idx++;
  }
  if (city) {
    conditions.push(`i.city = $${idx}`);
    params.push(city);
    idx++;
  }
  if (min_er) {
    conditions.push(`i.engagement_rate >= $${idx}`);
    params.push(parseFloat(min_er));
    idx++;
  }
  if (gender && gender !== 'any') {
    conditions.push(`i.gender = $${idx}`);
    params.push(gender);
    idx++;
  }

  const where = conditions.join(' AND ');
  const { rows } = await db.query(
    `SELECT i.id, i.instagram_handle, i.followers_count, i.engagement_rate,
            i.tier, i.niche, i.city, i.gender,
            u.name AS full_name, u.status
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE ${where}
     ORDER BY i.followers_count DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, parseInt(limit), parseInt(offset)]
  );

  return success(res, { influencers: rows, total: rows.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// Open-group match count
// GET /campaigns/:id/sets/:sid/open-group-matches
// ─────────────────────────────────────────────────────────────────────────────

const openGroupMatches = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);

  const { tiers, niches, cities, min_er, gender } = req.query;

  const conditions = [`u.status = 'approved'`];
  const params = [];
  let idx = 1;

  if (tiers) {
    const tierArr = Array.isArray(tiers) ? tiers : tiers.split(',');
    conditions.push(`i.tier = ANY($${idx}::text[])`);
    params.push(tierArr);
    idx++;
  }
  if (niches) {
    const nicheArr = Array.isArray(niches) ? niches : niches.split(',');
    conditions.push(`i.niche && $${idx}::text[]`);
    params.push(nicheArr);
    idx++;
  }
  if (cities) {
    const cityArr = Array.isArray(cities) ? cities : cities.split(',');
    conditions.push(`i.city = ANY($${idx}::text[])`);
    params.push(cityArr);
    idx++;
  }
  if (min_er) {
    conditions.push(`i.engagement_rate >= $${idx}`);
    params.push(parseFloat(min_er));
    idx++;
  }
  if (gender && gender !== 'any') {
    conditions.push(`i.gender = $${idx}`);
    params.push(gender);
    idx++;
  }

  const where = conditions.join(' AND ');
  const { rows } = await db.query(
    `SELECT i.id, i.instagram_handle, i.followers_count, i.tier,
            u.name AS full_name
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE ${where}
     ORDER BY i.followers_count DESC
     LIMIT 50`,
    params
  );

  return success(res, { count: rows.length, influencers: rows.slice(0, 10) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

// GET /campaigns/:id/products — products assigned to this campaign via influencer offers
const getCampaignProducts = asyncHandler(async (req, res) => {
  const { id: campaignId } = req.params;

  // Get all influencers in this campaign with their offer configs
  const { rows: ciRows } = await db.query(
    `SELECT ci.id, ci.influencer_id, ci.offer_type, ci.offer_config_json,
            ci.commission_pct, ci.coupon_code, ci.status,
            i.instagram_handle, u.name AS influencer_name,
            c.brand_id
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE cs.campaign_id = $1`,
    [campaignId]
  );

  if (ciRows.length === 0) return success(res, { products: [], influencers: [] });

  const brandId = ciRows[0].brand_id;

  // ── Build per-influencer product assignment map ──────────────────────────
  // For each campaign_influencer, look at their offer_config_json.products
  // to know which product IDs were ALLOCATED TO THIS INFLUENCER specifically.
  // This is the key data the brand needs in the Products tab to drill down
  // by influencer, and the data the influencer mobile app needs to know
  // "what am I promoting".
  const productIdsByCi = {};      // ci.id → Set<product_id>
  const ciIdsByProduct = {};      // product_id → Set<ci.id>
  const allProductIds  = new Set();

  for (const ci of ciRows) {
    const config = ci.offer_config_json || {};
    const prods  = config.products || [];
    productIdsByCi[ci.id] = new Set();
    for (const p of prods) {
      const pid = typeof p === 'string' ? p : (p.product_id || p.id);
      if (!pid) continue;
      allProductIds.add(pid);
      productIdsByCi[ci.id].add(pid);
      if (!ciIdsByProduct[pid]) ciIdsByProduct[pid] = new Set();
      ciIdsByProduct[pid].add(ci.id);
    }
  }

  // Fallback chain when no per-influencer offer config has products:
  //   1. published notes (influencer_product_notes) — pick those product IDs
  //   2. all active brand products (brand-level offer)
  let usingFallback = false;
  if (allProductIds.size === 0) {
    const { rows: noteRows } = await db.query(
      `SELECT DISTINCT ipn.product_id
       FROM   influencer_product_notes ipn
       WHERE  ipn.campaign_id = $1`,
      [campaignId]
    );
    noteRows.forEach(n => allProductIds.add(n.product_id));
    if (allProductIds.size === 0) usingFallback = true;
  }

  let products;
  if (allProductIds.size > 0) {
    const { rows } = await db.query(
      `SELECT id, name, price, image_url, section, veg_flag, description, variants_json, is_active
       FROM brand_products WHERE brand_id = $1 AND id = ANY($2)
       ORDER BY section NULLS LAST, name`,
      [brandId, Array.from(allProductIds)]
    );
    products = rows;
  } else {
    // No specific products at all — return all brand products as fallback.
    // In this case the offer is "brand-level" — every influencer effectively
    // promotes the entire catalogue.
    const { rows } = await db.query(
      `SELECT id, name, price, image_url, section, veg_flag, description, variants_json, is_active
       FROM brand_products WHERE brand_id = $1 AND is_active = true
       ORDER BY section NULLS LAST, name`,
      [brandId]
    );
    products = rows;
  }

  // Get ALL published notes for this campaign (across all influencers)
  const { rows: allNotes } = await db.query(
    `SELECT ipn.product_id, ipn.influencer_id, ipn.note_text, u.name AS influencer_name
     FROM influencer_product_notes ipn
     JOIN influencers i ON i.id = ipn.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE ipn.campaign_id = $1`,
    [campaignId]
  );

  // Build note lookup: product_id → [{influencer_name, note_text, ...}]
  const notesByProduct = {};
  for (const n of allNotes) {
    if (!notesByProduct[n.product_id]) notesByProduct[n.product_id] = [];
    notesByProduct[n.product_id].push({
      influencer_name: n.influencer_name,
      influencer_id:   n.influencer_id,
      note_text:       n.note_text,
    });
  }

  // Build influencer index for assigned-to lookup
  const influencerByCi = {};
  for (const ci of ciRows) {
    influencerByCi[ci.id] = {
      campaign_influencer_id: ci.id,
      influencer_id:          ci.influencer_id,
      name:                   ci.influencer_name,
      handle:                 ci.instagram_handle,
    };
  }

  // Attach publish status + per-influencer assignment to each product
  const productsWithStatus = products.map(p => {
    const assignedCiIds = ciIdsByProduct[p.id] ? Array.from(ciIdsByProduct[p.id]) : [];
    return {
      ...p,
      publish_status: notesByProduct[p.id] ? 'published' : 'pending',
      published_by:   notesByProduct[p.id] || [],
      // NEW: which influencers in this campaign were assigned this product?
      // Empty array = brand-level offer (all influencers see the whole
      // catalogue). Used by brand-web Products tab + mobile drill-downs.
      assigned_to_influencers: assignedCiIds.map(ciId => ({
        campaign_influencer_id: ciId,
        influencer_id:          influencerByCi[ciId]?.influencer_id,
        handle:                 influencerByCi[ciId]?.handle,
        name:                   influencerByCi[ciId]?.name,
      })),
    };
  });

  const publishedCount = productsWithStatus.filter(p => p.publish_status === 'published').length;

  return success(res, {
    products:               productsWithStatus,
    influencers:            ciRows.map(ci => {
      const ciProducts = productIdsByCi[ci.id] ? Array.from(productIdsByCi[ci.id]) : [];
      // For brand-level (fallback) offers, every influencer promotes every product
      const productCount = ciProducts.length > 0 ? ciProducts.length : (usingFallback ? products.length : 0);
      return {
        id:                ci.id,
        influencer_id:     ci.influencer_id,
        name:              ci.influencer_name,
        handle:            ci.instagram_handle,
        status:            ci.status,
        offer_type:        ci.offer_type,
        discount_value:    ci.offer_config_json?.value || ci.commission_pct || null,
        commission_pct:    ci.commission_pct,
        coupon_code:       ci.coupon_code,
        product_ids:       ciProducts,            // NEW: explicit list
        assigned_products: productCount,
      };
    }),
    has_specific_products: !usingFallback && allProductIds.size > 0,
    is_brand_level_offer:  usingFallback,         // NEW: tells UI when to show "all brand products"
    summary: {
      total_products: products.length,
      published:      publishedCount,
      pending:        products.length - publishedCount,
    },
  });
});

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
  cancel,
  cancelInfluencer,
  getSets,
  createSet,
  updateSet,
  deleteSet,
  duplicateSet,
  invite,
  updateInfluencer,
  createOffer,
  publish,
  getLiveHierarchy,
  searchInfluencers,
  openGroupMatches,
  getCampaignProducts,
};
