'use strict';

const db                  = require('../config/db');
const notificationService = require('../services/notification.service');
const pricingService      = require('../services/pricing.service');
const entitlementsService = require('../services/entitlements.service');

// ─────────────────────────────────────────────────────────────────────────────
// Phase A12.2 — discover_filter entitlement helper.
// Reads the brand's tier config for discover_filter and returns SQL fragments
// the influencer search/match endpoints inject into their WHERE clause.
// Defensive: if feature not enforced OR brand has no city/state, returns
// empty fragments (pass-through to no-filter behaviour).
// ─────────────────────────────────────────────────────────────────────────────
async function _applyDiscoverFilter(brandId, paramStartIdx) {
  const config = await entitlementsService.configFor(db, brandId, 'discover_filter');
  const sqlParts = [];
  const params = [];
  let idx = paramStartIdx;

  const areaScope = config && config.area_scope;
  if (areaScope && areaScope !== 'all_india') {
    const { rows: userRows } = await db.query(
      `SELECT u.city, u.state
         FROM users u
         JOIN brands b ON b.user_id = u.id
        WHERE b.id = $1
        LIMIT 1`,
      [brandId]
    );
    const brandCity  = userRows[0]?.city;
    const brandState = userRows[0]?.state;

    if (areaScope === 'city' && brandCity) {
      sqlParts.push(`i.city = $${idx}`);
      params.push(brandCity);
      idx++;
    } else if (areaScope === 'state' && brandState) {
      sqlParts.push(`i.state = $${idx}`);
      params.push(brandState);
      idx++;
    }
    // If brand has no city/state, skip the filter (defensive — don't lock
    // the brand out due to incomplete profile data).
  }

  const nichesLimit = (config && config.niches_limit != null) ? Number(config.niches_limit) : null;
  return { sqlParts, params, nichesLimit, areaScope: areaScope || 'all_india' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase A12.3 — search_filters_advanced entitlement gate.
// "Advanced" filters: tier (influencer-tier band) + min_er (engagement-rate
// threshold). Brands whose plan doesn't include this feature can still use
// the basic filters (q, niche, city, gender) but get 422 FEATURE_NOT_AVAILABLE
// if they pass any advanced param.
// Defensive fail-open: if feature not enforced, returns immediately.
// ─────────────────────────────────────────────────────────────────────────────
const ADVANCED_SEARCH_PARAMS = ['tier', 'tiers', 'min_er'];

async function _requireAdvancedSearchFilters(brandId, query) {
  // Detect which advanced params (if any) the brand passed.
  const used = ADVANCED_SEARCH_PARAMS.filter(k => {
    const v = query[k];
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  });
  if (used.length === 0) return;  // No advanced filter used — nothing to gate.

  const allowed = await entitlementsService.hasFeature(db, brandId, 'search_filters_advanced');
  if (allowed) return;  // Brand's tier grants the feature.

  // Look up tiers that DO grant it, so the popup can recommend an upgrade.
  const { rows: upgrades } = await db.query(
    `SELECT t.tier_key
       FROM subscription_tiers t
       JOIN tier_features tf ON tf.tier_id = t.id
       JOIN features f       ON f.id       = tf.feature_id
      WHERE t.active        = true
        AND f.feature_key   = 'search_filters_advanced'
        AND tf.included     = true
      ORDER BY t.sort_order`
  );

  throw new AppError(
    'FEATURE_NOT_AVAILABLE',
    `Advanced search filters (${used.join(', ')}) are not available on your current plan. Upgrade to use them.`,
    422,
    'search_filters_advanced',
    {
      feature_key:    'search_filters_advanced',
      blocked_params: used,
      upgrade_to:     upgrades.map(r => r.tier_key),
    }
  );
}
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

// Safety bound on how many influencers a single open_group set can broadcast
// to. The brand's slot cap (set.max_cap) is enforced separately at accept
// time; this is just a runaway guard. A12.5 layers a per-tier cap from
// open_group_broadcast.max_recipients on top of this — see below.
const OPEN_GROUP_BROADCAST_LIMIT = 1000;

/**
 * Materialise `campaign_influencers` rows for every open_group set in this
 * campaign. Called inside the publish transaction so any SQL failure rolls
 * back the status update.
 *
 * For each open_group set:
 *   - Resolve open_group_filters → SQL WHERE clauses via the shared helper
 *   - Exclude influencers already attached to any set in this campaign
 *   - Apply A12.5 open_group_broadcast.area_scope filter (city/state) when
 *     the feature is enforced and the brand has a location on file
 *   - INSERT one CI row per match with status='invited' and a 48h offer
 *     expiry, capped by A12.5 open_group_broadcast.max_recipients (clamped
 *     to OPEN_GROUP_BROADCAST_LIMIT safety bound; pre-M066 falls back to
 *     the safety bound only)
 *
 * Handpick sets are skipped here — those CI rows are inserted at wizard save
 * time and are already in 'invited' state by the time we get here.
 */
async function materialiseOpenGroupInvites(tx, campaign, sets) {
  if (!sets.some(s => s.influencer_mode === 'open_group')) return;

  // Phase A12.5 — open_group_broadcast config gate.
  // Pre-M066 (is_enforced=false): configFor returns {} → effective cap
  // = OPEN_GROUP_BROADCAST_LIMIT, no scope filter (behaviour identical to
  // pre-A12.5). Post-M066 the per-tier cap + area_scope filter activate.
  const broadcastCfg  = await entitlementsService.configFor(tx, campaign.brand_id, 'open_group_broadcast');
  const maxRecipients = broadcastCfg.max_recipients != null ? Number(broadcastCfg.max_recipients) : null;
  const effectiveCap  =
    (maxRecipients == null || maxRecipients === -1)
      ? OPEN_GROUP_BROADCAST_LIMIT
      : Math.min(maxRecipients, OPEN_GROUP_BROADCAST_LIMIT);

  // Resolve brand location once if area_scope filter will apply.
  // Defensive: if brand has no city/state on their user row, skip the filter
  // — don't lock the brand out due to incomplete profile data.
  const areaScope = broadcastCfg.area_scope || null;
  let scopeColumn = null;   // 'city' | 'state' | null
  let scopeValue  = null;
  if (areaScope && areaScope !== 'all_india') {
    const { rows: userRows } = await tx.query(
      `SELECT u.city, u.state
         FROM users u
         JOIN brands b ON b.user_id = u.id
        WHERE b.id = $1
        LIMIT 1`,
      [campaign.brand_id]
    );
    const brandCity  = userRows[0]?.city;
    const brandState = userRows[0]?.state;
    if (areaScope === 'city' && brandCity) {
      scopeColumn = 'city';
      scopeValue  = brandCity;
    } else if (areaScope === 'state' && brandState) {
      scopeColumn = 'state';
      scopeValue  = brandState;
    }
  }

  for (const set of sets) {
    if (set.influencer_mode !== 'open_group') continue;

    const { conditions, params, nextIdx } = buildOpenGroupMatchClauses(set.open_group_filters || {}, 1);
    // Exclude anyone already on another set in this campaign.
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM campaign_influencers ci2 JOIN campaign_sets cs2 ON cs2.id = ci2.set_id
                    WHERE cs2.campaign_id = $${nextIdx} AND ci2.influencer_id = i.id)`
    );
    params.push(campaign.id);
    let nextParamIdx = nextIdx + 1;

    // A12.5 — area_scope filter (city/state) injected with proper placeholder.
    if (scopeColumn && scopeValue != null) {
      conditions.push(`i.${scopeColumn} = $${nextParamIdx}`);
      params.push(scopeValue);
      nextParamIdx++;
    }

    const { rows: matches } = await tx.query(
      `SELECT i.id
         FROM influencers i
         JOIN users u ON u.id = i.user_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY i.followers_count DESC NULLS LAST, i.created_at ASC
        LIMIT $${nextParamIdx}`,
      [...params, effectiveCap]
    );

    console.log(`[publish] open_group set ${set.id}: broadcasting to ${matches.length} matches (effective cap ${effectiveCap}, scope ${areaScope || 'all_india'}, slot cap ${set.max_cap || 'unset'})`);

    const perBudget = set.per_influencer_budget != null ? parseFloat(set.per_influencer_budget) : null;
    for (const m of matches) {
      await tx.query(
        `INSERT INTO campaign_influencers
           (set_id, influencer_id, status, influencer_budget, offer_expires_at)
         VALUES ($1, $2, 'invited', $3, now() + interval '48 hours')`,
        [set.id, m.id, perBudget]
      );
    }
  }
}

/**
 * Build SQL WHERE conditions + bound params for open-group influencer matching.
 * Shared by openGroupMatches (count preview) and publish (materialise CI rows)
 * so both endpoints agree on who is "matching".
 *
 * - i.niche is varchar[], not text[] — comparisons need an explicit cast to
 *   avoid "operator does not exist: character varying[] && text[]".
 * - Niches and cities are matched case-insensitively (wizard sends 'fashion',
 *   DB stores 'Fashion'); tier comparison is exact (both lowercase).
 * - secondary_niche is OR'd with primary niche so an influencer matches if
 *   either column contains the requested niche.
 *
 * Returns { conditions: string[], params: any[], nextIdx: number }.
 */
function buildOpenGroupMatchClauses(filters, startIdx) {
  const conditions = [`u.status = 'approved'`];
  const params = [];
  let idx = startIdx;

  const f = (filters && typeof filters === 'object') ? filters
          : (typeof filters === 'string' ? (() => { try { return JSON.parse(filters); } catch { return {}; } })() : {});

  const tiers   = Array.isArray(f.tiers)  && f.tiers.length  ? f.tiers  : null;
  const niches  = Array.isArray(f.niches) && f.niches.length ? f.niches : null;
  const cities  = Array.isArray(f.cities) && f.cities.length ? f.cities : null;
  const minEr   = f.min_er != null && f.min_er !== '' ? parseFloat(f.min_er) : null;
  const gender  = f.gender && f.gender !== 'any' ? String(f.gender) : null;

  if (tiers) {
    conditions.push(`i.tier = ANY($${idx}::text[])`);
    params.push(tiers); idx++;
  }
  if (niches) {
    conditions.push(
      `(EXISTS (SELECT 1 FROM unnest(i.niche) n WHERE lower(n) = ANY(SELECT lower(x) FROM unnest($${idx}::text[]) x))` +
      ` OR EXISTS (SELECT 1 FROM unnest(i.secondary_niche) n WHERE lower(n) = ANY(SELECT lower(x) FROM unnest($${idx}::text[]) x)))`
    );
    params.push(niches); idx++;
  }
  if (cities) {
    conditions.push(
      `(lower(i.city) = ANY(SELECT lower(x) FROM unnest($${idx}::text[]) x)` +
      ` OR lower(u.city) = ANY(SELECT lower(x) FROM unnest($${idx}::text[]) x))`
    );
    params.push(cities); idx++;
  }
  if (minEr != null && !Number.isNaN(minEr)) {
    conditions.push(`i.engagement_rate >= $${idx}`);
    params.push(minEr); idx++;
  }
  if (gender) {
    conditions.push(`lower(i.gender) = lower($${idx})`);
    params.push(gender); idx++;
  }

  return { conditions, params, nextIdx: idx };
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
  const { name, total_budget, start_date, end_date, brief, allow_negotiation } = req.body;

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
    `INSERT INTO campaigns (brand_id, name, total_budget, start_date, end_date, brief, allow_negotiation)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      brand.id,
      name.trim(),
      total_budget != null ? total_budget : null,
      start_date,
      end_date,
      brief || null,
      allow_negotiation === false ? false : true,
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

  // Per-CI drill-down enrichment: tranche statuses, deliverable counts,
  // transaction count. Three small aggregation queries (rather than one big
  // Cartesian join) keyed on campaign_influencer_id, then merged in JS.
  const { rows: trancheRows } = await db.query(
    `SELECT ee.campaign_influencer_id,
            MAX(CASE WHEN ee.tranche_number = 1 THEN ee.status END) AS t1,
            MAX(CASE WHEN ee.tranche_number = 2 THEN ee.status END) AS t2,
            MAX(CASE WHEN ee.tranche_number = 3 THEN ee.status END) AS t3
     FROM   escrow_entries ee
     JOIN   campaign_influencers ci ON ci.id = ee.campaign_influencer_id
     JOIN   campaign_sets cs        ON cs.id = ci.set_id
     WHERE  cs.campaign_id = $1
     GROUP  BY ee.campaign_influencer_id`,
    [campaign.id]
  );
  const trancheMap = {};
  for (const r of trancheRows) {
    trancheMap[r.campaign_influencer_id] = { t1: r.t1, t2: r.t2, t3: r.t3 };
  }

  const { rows: delivRows } = await db.query(
    `SELECT d.campaign_influencer_id,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE d.status = 'pending')::int             AS pending,
            COUNT(*) FILTER (WHERE d.status = 'submitted')::int           AS submitted,
            COUNT(*) FILTER (WHERE d.status = 'under_review')::int        AS under_review,
            COUNT(*) FILTER (WHERE d.status = 'revision_requested')::int  AS revision_requested,
            COUNT(*) FILTER (WHERE d.status = 'approved')::int            AS approved,
            COUNT(*) FILTER (WHERE d.status = 'live')::int                AS live
     FROM   deliverables d
     JOIN   campaign_influencers ci ON ci.id = d.campaign_influencer_id
     JOIN   campaign_sets cs        ON cs.id = ci.set_id
     WHERE  cs.campaign_id = $1
     GROUP  BY d.campaign_influencer_id`,
    [campaign.id]
  );
  const delivMap = {};
  for (const r of delivRows) {
    const { campaign_influencer_id, ...counts } = r;
    delivMap[campaign_influencer_id] = counts;
  }

  const { rows: txnRows } = await db.query(
    `SELECT ft.campaign_influencer_id,
            COUNT(*)::int AS transaction_count
     FROM   follower_transactions ft
     WHERE  ft.campaign_id = $1
       AND  ft.status = 'completed'
     GROUP  BY ft.campaign_influencer_id`,
    [campaign.id]
  );
  const txnMap = {};
  for (const r of txnRows) {
    txnMap[r.campaign_influencer_id] = r.transaction_count;
  }

  // Actionable deliverable rows for the brand UI: submitted / under_review
  // need review, approved-with-live_url need confirm-live. Other states (live,
  // pending, revision_requested) are surfaced via deliverable_counts only —
  // they don't drive an action button so the row body isn't needed.
  const { rows: actionDelivRows } = await db.query(
    `SELECT d.id, d.campaign_influencer_id, d.type, d.status,
            d.submitted_url AS content_url, d.live_url, d.submitted_at
     FROM   deliverables d
     JOIN   campaign_influencers ci ON ci.id = d.campaign_influencer_id
     JOIN   campaign_sets cs        ON cs.id = ci.set_id
     WHERE  cs.campaign_id = $1
       AND  (d.status IN ('submitted', 'under_review')
             OR (d.status = 'approved' AND d.live_url IS NOT NULL))
     ORDER  BY d.submitted_at ASC NULLS LAST, d.id ASC`,
    [campaign.id]
  );
  const actionDelivMap = {};
  for (const r of actionDelivRows) {
    if (!actionDelivMap[r.campaign_influencer_id]) actionDelivMap[r.campaign_influencer_id] = [];
    actionDelivMap[r.campaign_influencer_id].push(r);
  }

  // Merge aggregates onto each influencer. Transaction count is only surfaced
  // for sets whose goal is conversion or hybrid (engagement has no buyer
  // transactions, so the field stays undefined and the UI can hide it).
  for (const set of sets) {
    const goal = (set.goal || '').toLowerCase();
    const hasTransactions = goal === 'conversion' || goal === 'hybrid';
    for (const ci of set.influencers) {
      ci.tranche_statuses = trancheMap[ci.id] || { t1: null, t2: null, t3: null };
      ci.deliverable_counts = delivMap[ci.id] || {
        total: 0, pending: 0, submitted: 0, under_review: 0,
        revision_requested: 0, approved: 0, live: 0,
      };
      ci.deliverables = actionDelivMap[ci.id] || [];
      if (hasTransactions) ci.transaction_count = txnMap[ci.id] || 0;
    }
  }

  return success(res, { campaign });
});

const update = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  if (campaign.status !== 'draft') {
    throw new AppError('VALIDATION_ERROR', `Only draft campaigns can be edited. Current status: ${campaign.status}`, 422);
  }

  const allowed = ['name', 'total_budget', 'start_date', 'end_date', 'brief', 'allow_negotiation'];
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
// Offer Engine (Sub-contract C) — resolve a per-influencer offer attachment.
// If brand_offer_id is given, snapshot that library offer onto the assignment
// (the library row is authoritative — its config wins, and a later edit to the
// library never mutates this attachment) and record provenance. allocation is
// derived from the set goal: engagement => 'promotional' (no commission/tracking);
// conversion|hybrid => 'commissioned'. Returns the effective offer to persist.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveOfferAttachment({ brandId, goal, brand_offer_id, offer_type, offer_config_json }) {
  let effType = offer_type || null;
  let effConfig = offer_config_json || null;
  let brandOfferId = null;

  if (brand_offer_id) {
    const { rows } = await db.query(
      `SELECT id, offer_type, offer_config_json, status
         FROM brand_offers WHERE id = $1 AND brand_id = $2`,
      [brand_offer_id, brandId]
    );
    if (!rows[0]) throw new AppError('NOT_FOUND', 'Offer not found in your library', 404, 'brand_offer_id');
    if (rows[0].status === 'archived') throw new AppError('VALIDATION_ERROR', 'Cannot attach an archived offer', 422, 'brand_offer_id');
    brandOfferId = rows[0].id;
    effType = rows[0].offer_type;            // snapshot — library is authoritative
    effConfig = rows[0].offer_config_json;   // jsonb → JS object
  }

  const allocation = effType ? (goal === 'engagement' ? 'promotional' : 'commissioned') : null;
  return { effType, effConfig, brandOfferId, allocation };
}

// Offer Engine: validate the engagement "promoted offers" multi-select — every id
// must belong to this brand and not be archived. Returns a de-duped uuid[] or null.
async function validatePromotedOffers(brandId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return null;
  const { rows } = await db.query(
    `SELECT id FROM brand_offers WHERE id = ANY($1::uuid[]) AND brand_id = $2 AND status <> 'archived'`,
    [uniq, brandId]
  );
  if (rows.length !== uniq.length) {
    throw new AppError('VALIDATION_ERROR', 'One or more selected offers are not in your library', 422, 'promoted_brand_offer_ids');
  }
  return uniq;
}

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
    brand_offer_id,
    promoted_brand_offer_ids,
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

  // Offer Engine (C): resolve a library-offer attachment (snapshot) or inline offer.
  const { effType, effConfig, brandOfferId, allocation } = await resolveOfferAttachment({
    brandId: brand.id, goal, brand_offer_id, offer_type, offer_config_json,
  });
  // Engagement multi-select: a list of offers the creator promotes (promotional).
  const promotedIds = await validatePromotedOffers(brand.id, promoted_brand_offer_ids);
  const finalAllocation = promotedIds ? 'promotional' : allocation;

  // Goal-conditional validation.
  if (goal === 'engagement') {
    // Engagement offers are PROMOTIONAL (Offer Engine C): allowed, but never
    // commissioned/tracked — no coupon, no commission.
    if (customCouponCode) throw new AppError('VALIDATION_ERROR', 'coupon_code must not be set for engagement (promotional) offers', 422, 'coupon_code');
    if (commission_pct) throw new AppError('VALIDATION_ERROR', 'commission_pct must not be set for engagement (promotional) offers', 422, 'commission_pct');
  }
  if ((goal === 'conversion' || goal === 'hybrid') && !effType) {
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
        physical_delivery, delivery_address, influencer_budget, submission_deadline,
        brand_offer_id, allocation, promoted_brand_offer_ids)
     VALUES ($1, $2, 'invited', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      set.id,
      influencer_id,
      agreed_fee || null,
      posting_date || null,
      expiresAt,
      effType || null,
      effConfig ? JSON.stringify(effConfig) : null,
      commission_pct || null,
      finalCouponCode,
      physical_delivery || false,
      delivery_address || null,
      influencer_budget || null,
      submissionDeadline,
      brandOfferId,
      finalAllocation,
      promotedIds,
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

  const set = await getSetOrThrow(req.params.sid, req.params.id);

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
    brand_offer_id,
    promoted_brand_offer_ids,
    commission_pct,
    physical_delivery,
    delivery_address,
    influencer_budget,
    coupon_code,
  } = req.body;

  // Offer Engine (C): resolve library-offer attachment (snapshot) or inline offer.
  const { effType, effConfig, brandOfferId, allocation } = await resolveOfferAttachment({
    brandId: brand.id, goal: set.goal, brand_offer_id, offer_type, offer_config_json,
  });
  // Engagement multi-select promoted offers (promotional list).
  const promotedIds = await validatePromotedOffers(brand.id, promoted_brand_offer_ids);
  const finalAllocation = promotedIds ? 'promotional' : allocation;
  // Promotional (engagement) offers never carry a commission.
  const effCommission = finalAllocation === 'promotional' ? null : (commission_pct != null ? commission_pct : null);

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
       offer_expires_at = $10,
       brand_offer_id = $11,
       allocation = $12,
       promoted_brand_offer_ids = $13
     WHERE id = $1
     RETURNING *`,
    [
      ciId,
      newPostingDate,
      effType || null,
      effConfig ? JSON.stringify(effConfig) : null,
      effCommission,
      physical_delivery != null ? physical_delivery : false,
      delivery_address || null,
      influencer_budget != null ? influencer_budget : null,
      submissionDeadline,
      newOfferExpiresAt,
      brandOfferId,
      finalAllocation,
      promotedIds,
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

  // Phase A12.5 — open-group feature gates fire BEFORE wallet check / tx open,
  // conditional on the campaign containing any open_group set. Two layers
  // (defence-in-depth):
  //   1. bulk_outreach boolean — re-applied here from A12.4 (verify-twice
  //      found A12.4 wired this on offer.controller.publishOpenGroup, a
  //      notify-only endpoint with no frontend caller — M065 alone was a
  //      no-op against the real publish path). Free tier blocked.
  //   2. open_group_broadcast.max_recipients == 0 — Free tier also blocked
  //      via the config layer (same intent, separate feature key).
  // Both gates fail-open pre-M065/M066 (requireFeature/configFor honour
  // is_enforced).
  const hasOpenGroupSet = sets.some(s => s.influencer_mode === 'open_group');
  if (hasOpenGroupSet) {
    await entitlementsService.requireFeature(db, brand.id, 'bulk_outreach', {
      label: 'Bulk influencer outreach',
    });
    const ogbCfg = await entitlementsService.configFor(db, brand.id, 'open_group_broadcast');
    if (ogbCfg.max_recipients === 0) {
      throw new AppError(
        'FEATURE_NOT_AVAILABLE',
        'Open-group broadcast is not available on your current plan. Upgrade to publish open-group campaigns.',
        422,
        'open_group_broadcast',
        {
          feature_key: 'open_group_broadcast',
          upgrade_to:  ['growth', 'pro', 'enterprise'],
        }
      );
    }
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
    //
    // L2 (Campaign Protection Fee) is also locked here. The rate is chosen
    // by tier (escrow_fee_tiers) using the engagement+hybrid base, or by
    // brands.escrow_fee_override_pct if set. Captured on the campaigns row
    // and stays for the life of the campaign — see M037.
    //
    // open_group materialisation is part of the SAME transaction so a SQL
    // failure rolls back status='active'. Otherwise an open-group SQL bug
    // would leave the campaign half-published and unable to retry.
    await db.withTransaction(async (tx) => {
      await pricingService.lockEscrowFeeAtPublish(tx, campaign.id, brand.id);
      await tx.query(
        `UPDATE campaigns SET status = 'active', published_at = now() WHERE id = $1`,
        [campaign.id]
      );
      await materialiseOpenGroupInvites(tx, campaign, sets);
    });
  } else {
    // Conversion-only: no engagement budget, no L2 fee to lock — wrap status
    // update + open_group materialisation together for the same atomicity.
    await db.withTransaction(async (tx) => {
      await tx.query(
        `UPDATE campaigns SET status = 'active', published_at = now() WHERE id = $1`,
        [campaign.id]
      );
      await materialiseOpenGroupInvites(tx, campaign, sets);
    });
  }

  // Post-publish: notify every invited influencer (handpick + open_group)
  // in one pass. Notifications run outside the tx — a failed push must not
  // roll back the campaign state, and we don't want SMS retries inside the
  // critical path.
  const { rows: invited } = await db.query(
    `SELECT ci.id, u.id AS user_id, u.fcm_token, u.phone
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN influencers inf ON inf.id = ci.influencer_id
       JOIN users u ON u.id = inf.user_id
      WHERE cs.campaign_id = $1 AND ci.status = 'invited'`,
    [campaign.id]
  );
  for (const inv of invited) {
    try {
      await notificationService.send({
        userId:   inv.user_id,
        type:     'offer.invited',
        title:    'New Campaign is Live!',
        body:     'A brand has invited you to a new campaign.',
        data:     { screen: 'offer_inbox', campaign_influencer_id: inv.id },
        fcmToken: inv.fcm_token,
        sendSms:  false,
        phone:    inv.phone,
      });
    } catch (e) {
      console.error('[publish] notification send failed:', e.message);
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
            COALESCE(SUM(ee.escrow_fee_amount), 0) AS locked_platform_fee
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
// Approve / reject an open-group APPLICATION (status='applied' → 'accepted'
// or 'rejected_by_brand'). Approving triggers the same contract auto-create
// the handpick accept flow uses. When the brand's approval count for a set
// hits max_cap, every remaining 'applied' or 'invited' row in that set is
// moved to 'slots_filled' so the offer disappears from those influencers'
// inboxes and they get a closing notification.
//
// POST /campaigns/:id/influencers/:ciid/approve-application
// POST /campaigns/:id/influencers/:ciid/reject-application
// ─────────────────────────────────────────────────────────────────────────────

const approveApplication = asyncHandler(async (req, res) => {
  const brand    = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  const ciid     = req.params.ciid;

  const { rows: ciRows } = await db.query(
    `SELECT ci.*, cs.campaign_id, cs.influencer_mode, cs.max_cap,
            i.user_id AS influencer_user_id, u.name AS influencer_name,
            i.instagram_handle, u.fcm_token AS influencer_fcm_token, u.phone AS influencer_phone
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN influencers i ON i.id = ci.influencer_id
       JOIN users u ON u.id = i.user_id
      WHERE ci.id = $1 AND cs.campaign_id = $2`,
    [ciid, campaign.id]
  );
  if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Application not found', 404);
  const ci = ciRows[0];

  if (ci.influencer_mode !== 'open_group') {
    throw new AppError('VALIDATION_ERROR', 'This action only applies to open-group campaigns.', 422);
  }
  if (ci.status !== 'applied') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot approve application in '${ci.status}' status. Must be 'applied'.`,
      422
    );
  }

  let slotsFilled = false;
  let closedOutCount = 0;

  await db.withTransaction(async (client) => {
    // Lock the set so concurrent approvals can't overshoot max_cap.
    await client.query(`SELECT 1 FROM campaign_sets WHERE id = $1 FOR UPDATE`, [ci.set_id]);

    const { rows: takenRows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM campaign_influencers
        WHERE set_id = $1 AND status IN ('accepted','contracted','active','completed')`,
      [ci.set_id]
    );
    const cap = parseInt(ci.max_cap, 10) || 0;
    if (cap > 0 && takenRows[0].n >= cap) {
      throw new AppError(
        'SLOT_FULL',
        `All ${cap} slots are already filled. Revoke an existing approval first if you want to swap.`,
        422
      );
    }

    await client.query(
      `UPDATE campaign_influencers
         SET status = 'accepted',
             agreed_fee = COALESCE(agreed_fee, influencer_budget)
       WHERE id = $1`,
      [ci.id]
    );

    // If THIS approval just filled the cap, auto-close remaining applicants
    // in the same set. Brand keeps a clean roster, applicants stop seeing
    // the offer in their active inbox.
    if (cap > 0 && takenRows[0].n + 1 >= cap) {
      const { rows: closed } = await client.query(
        `UPDATE campaign_influencers
            SET status = 'slots_filled'
          WHERE set_id = $1 AND status IN ('applied', 'invited')
          RETURNING id, influencer_id`,
        [ci.set_id]
      );
      closedOutCount = closed.length;
      slotsFilled = true;
    }
  });

  // Approved influencer → contract auto-create (same as handpick accept).
  let contractError = null;
  try {
    const contractService = require('../services/contract.service');
    await contractService.autoCreate(ci.id);
  } catch (e) {
    console.error('[CONTRACT] Auto-create failed on application approval:', e.message);
    contractError = e.message;
  }

  // Notify the approved influencer.
  try {
    await notificationService.send({
      userId:   ci.influencer_user_id,
      type:     'application.approved',
      title:    'Application approved!',
      body:     `${campaign.name} approved your application. Review and sign the contract.`,
      data:     { screen: 'contract_review', campaign_influencer_id: ci.id, campaign_id: campaign.id },
      fcmToken: ci.influencer_fcm_token,
      sendSms:  false,
      phone:    ci.influencer_phone,
    });
  } catch (e) { console.error('[NOTIFICATION] application.approved failed:', e.message); }

  // If slots just filled, notify the other applicants.
  if (slotsFilled && closedOutCount > 0) {
    try {
      const { rows: closedUsers } = await db.query(
        `SELECT u.id AS user_id, u.fcm_token, u.phone
           FROM campaign_influencers ci
           JOIN influencers i ON i.id = ci.influencer_id
           JOIN users u ON u.id = i.user_id
          WHERE ci.set_id = $1 AND ci.status = 'slots_filled'`,
        [ci.set_id]
      );
      for (const u of closedUsers) {
        notificationService.send({
          userId:   u.user_id,
          type:     'application.slots_filled',
          title:    'Campaign filled',
          body:     `"${campaign.name}" filled all positions. We'll surface similar campaigns soon.`,
          data:     { screen: 'offer_inbox' },
          fcmToken: u.fcm_token,
          sendSms:  false,
          phone:    u.phone,
        }).catch(() => {});
      }
    } catch (e) { console.error('[NOTIFICATION] slots_filled fanout failed:', e.message); }
  }

  return success(res, {
    campaign_influencer_id: ci.id,
    status: 'accepted',
    slots_filled: slotsFilled,
    closed_out_count: closedOutCount,
    contract_pending: !!contractError,
    contract_error: contractError,
  });
});

const rejectApplication = asyncHandler(async (req, res) => {
  const brand    = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  const ciid     = req.params.ciid;

  const { rows: ciRows } = await db.query(
    `SELECT ci.*, cs.influencer_mode,
            i.user_id AS influencer_user_id, u.fcm_token AS influencer_fcm_token,
            u.phone AS influencer_phone, i.instagram_handle
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN influencers i ON i.id = ci.influencer_id
       JOIN users u ON u.id = i.user_id
      WHERE ci.id = $1 AND cs.campaign_id = $2`,
    [ciid, campaign.id]
  );
  if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Application not found', 404);
  const ci = ciRows[0];

  if (ci.influencer_mode !== 'open_group') {
    throw new AppError('VALIDATION_ERROR', 'This action only applies to open-group campaigns.', 422);
  }
  if (ci.status !== 'applied') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot reject application in '${ci.status}' status. Must be 'applied'.`,
      422
    );
  }

  await db.query(
    `UPDATE campaign_influencers SET status = 'rejected_by_brand' WHERE id = $1`,
    [ci.id]
  );

  try {
    await notificationService.send({
      userId:   ci.influencer_user_id,
      type:     'application.rejected',
      title:    'Application not selected',
      body:     `The brand chose other applicants for "${campaign.name}". Thanks for applying.`,
      data:     { screen: 'offer_inbox', campaign_influencer_id: ci.id },
      fcmToken: ci.influencer_fcm_token,
      sendSms:  false,
      phone:    ci.influencer_phone,
    });
  } catch (e) { console.error('[NOTIFICATION] application.rejected failed:', e.message); }

  return success(res, { campaign_influencer_id: ci.id, status: 'rejected_by_brand' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Influencer search for handpick
// GET /campaigns/:id/influencer-search
// ─────────────────────────────────────────────────────────────────────────────

const searchInfluencers = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);

  // Phase A12.3 — gate advanced filters (tier / min_er) behind the
  // search_filters_advanced feature. Throws 422 FEATURE_NOT_AVAILABLE
  // if brand's tier lacks the feature AND they passed any advanced param.
  await _requireAdvancedSearchFilters(brand.id, req.query);

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

  // Phase A12.2 — discover_filter entitlement: limits which influencers a
  // brand can see by area_scope (city / state / all_india) per their tier.
  // Defensive pass-through if feature not enforced or brand missing city/state.
  const df = await _applyDiscoverFilter(brand.id, idx);
  conditions.push(...df.sqlParts);
  params.push(...df.params);
  idx += df.params.length;

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

  return success(res, {
    influencers: rows,
    total: rows.length,
    discover_filter: { area_scope: df.areaScope },  // surface what was applied for UI hints
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Open-group match count
// GET /campaigns/:id/sets/:sid/open-group-matches
// ─────────────────────────────────────────────────────────────────────────────

const openGroupMatches = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);

  // Phase A12.3 — same advanced-filter gate as searchInfluencers.
  // Blocks tiers[] / min_er for plans without search_filters_advanced.
  await _requireAdvancedSearchFilters(brand.id, req.query);

  const toArr = (v) => v == null || v === '' ? null : (Array.isArray(v) ? v : String(v).split(','));
  const filters = {
    tiers:  toArr(req.query.tiers),
    niches: toArr(req.query.niches),
    cities: toArr(req.query.cities),
    min_er: req.query.min_er,
    gender: req.query.gender,
  };

  // Phase A12.2 — discover_filter niches_limit: cap how many distinct
  // niches a brand can request in a single open-group match. -1 = unlimited.
  const df = await _applyDiscoverFilter(brand.id, 1);  // start idx — buildOpenGroupMatchClauses uses 1
  if (df.nichesLimit != null && df.nichesLimit !== -1 && filters.niches && filters.niches.length > df.nichesLimit) {
    throw new AppError(
      'FEATURE_LIMIT',
      `Your plan allows up to ${df.nichesLimit} niches per open-group broadcast (you requested ${filters.niches.length}). Upgrade for more.`,
      422,
      'niches',
      {
        feature_key:   'discover_filter',
        config_key:    'niches_limit',
        used:          filters.niches.length,
        limit:         df.nichesLimit,
      }
    );
  }

  const built = buildOpenGroupMatchClauses(filters, 1);
  const conditions = [...built.conditions];
  const params = [...built.params];
  let idx = params.length + 1;

  // Inject area_scope filter alongside the existing where clauses
  if (df.sqlParts.length) {
    // Re-number placeholders since buildOpenGroupMatchClauses used 1..N
    for (const part of df.sqlParts) {
      conditions.push(part.replace(/\$\d+/g, () => `$${idx++}`));
    }
    params.push(...df.params);
  }

  const { rows } = await db.query(
    `SELECT i.id, i.instagram_handle, i.followers_count, i.tier,
            u.name AS full_name
       FROM influencers i
       JOIN users u ON u.id = i.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.followers_count DESC
      LIMIT 200`,
    params
  );

  return success(res, {
    count: rows.length,
    influencers: rows.slice(0, 10),
    discover_filter: { area_scope: df.areaScope, niches_limit: df.nichesLimit },
  });
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
  approveApplication,
  rejectApplication,
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
