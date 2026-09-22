'use strict';

const db                  = require('../config/db');
const notificationService = require('../services/notification.service');
const campaignRollup = require('../services/campaignRollup.service');
const setShape = require('../services/setShape.model');
// Item 4 — states, counts, cutoff, locks and the delete rules, written once. Contract: features/item4-campaigns-sets
const campaignState = require('../services/campaignState.service');
const { MSG: CMSG } = require('../services/campaignCopy');
const pricingService      = require('../services/pricing.service');
const entitlementsService = require('../services/entitlements.service');
const {
  validateOfferConfig,
  normalizeOfferType,
  backfillDiscountSubType,
} = require('../services/offerConfig.validator');
// collab-part2 — consuming a handshake agreement when it is briefed into a set.
const handshakeService = require('../services/handshake.service');
// stage-2 — the one definition of what must be true before a campaign may be published,
// shared by publish and by the Review screen's read-only check.
const publishGate = require('../services/publishGate.service');
// The one definition of what a selling set is — shared with publishGate and the roll-up.
const { SELLING_GOALS } = require('../services/collabOwedItems.service');
// stage-2 ledger #96 — the brand's basket preview goes through the SAME resolver the
// shopping app's checkout uses. A preview that can disagree with the till is worse than
// no preview.
const offerResolution = require('../services/offerResolution.service');
// stage-2 ledger #69 — the one place the channel vocabulary is written down.
const campaignChannels = require('../services/campaignChannels');
// Item 2 — the creator's invitation settings (rules v1.10 §8A). Contract: features/item2-pitch-invitation-settings
const eligibility = require('../services/collabEligibility.service');
// Item 5 — the input helpers every invitation door shares now live in one service, and the
// invitation row is created in one place. Contract: features/item5-invitations
const {
  assertValidFormats, assertValidChannels, resolveAllocation, VALID_ALLOC_SCOPES,
} = require('../services/invitationInputs.service');
const invitationSend = require('../services/invitationSend.service');
const { MSG: MSG5 } = require('../services/invitationCopy');

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
    // Exclude anyone already live in THIS set — not in the campaign. Rules v1.21 §148 and §268:
    // the same creator may belong to several sets of one campaign, and only a live row in this
    // set puts her out of the running for it. A dead or deferred row does not exclude her at all,
    // same as the invite path. (The campaign-wide version was removed 2026-09-17; see
    // invitationSend.service for the whole story.)
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM campaign_influencers ci2
                    WHERE ci2.set_id = ${nextIdx} AND ci2.influencer_id = i.id
                      AND NOT (ci2.status = ANY(${nextIdx + 1}::campaign_influencer_status[])))`
    );
    params.push(set.id, campaignState.NON_BLOCKING_STATUSES);
    let nextParamIdx = nextIdx + 2;

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
// ─────────────────────────────────────────────────────────────────────────────
// Campaign CRUD
// ─────────────────────────────────────────────────────────────────────────────

const create = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { name, total_budget, start_date, end_date, brief, allow_negotiation, started_from_group_id } = req.body;

  // Item 4 — name required (≤ 60) and description ≤ 200, with the exact §7 messages.
  const v4 = campaignState.validateCampaignInput({ name, brief });
  if (!v4.ok) throw new AppError('VALIDATION_ERROR', v4.message, 422, v4.field);
  // Item 4 / G10 — a campaign started from one of this brand's creator groups remembers it, so
  // item 5's picker can start from the members. Never shown to creators.
  let groupId = null;
  if (started_from_group_id) {
    const { rows: g } = await db.query(`SELECT id FROM influencer_groups WHERE id = $1 AND brand_id = $2`, [started_from_group_id, brand.id]);
    if (!g[0]) throw new AppError('NOT_FOUND', 'Group not found', 404, 'started_from_group_id');
    groupId = g[0].id;
  }
  // stage-a — SB-23 stopped asking for a start date: BR-01 is now "a campaign is two
  // fields", and the day that matters lives on each SET (go_live_date) rather than once
  // on the campaign. start_date IS NULLABLE at the database level and was only ever
  // required by this check, not by a constraint — an older client (or the web wizard,
  // still unconverted) that keeps sending one is unaffected. follower.service.js's
  // discovery query already treats a NULL start_date as "no lower bound", and a draft
  // campaign is filtered out by status long before that clause runs, so nothing downstream
  // needed a migration for this.
  // collab-part5 — the end date is no longer asked for. It is derived from the sets by
  // campaignRollup: NULL when any set is conversion (a sales collaboration has no end),
  // otherwise the latest paid posting-window end. A caller that still sends one is not
  // rejected — old clients would break mid-deploy — but the value is ignored, and the
  // first set write replaces it with the derived one. Same for total_budget.
  if (end_date && new Date(end_date) <= new Date(start_date)) {
    throw new AppError('VALIDATION_ERROR', 'end_date must be after start_date', 422, 'end_date');
  }

  const { rows } = await db.query(
    `INSERT INTO campaigns (brand_id, name, total_budget, start_date, end_date, brief, allow_negotiation, started_from_group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      brand.id,
      name.trim(),
      null,                 // total_budget — derived from paid sets (collab-part5)
      start_date || null,   // stage-a — no longer asked for; NULL until a client sends one
      null,                 // end_date     — derived from paid posting windows (collab-part5)
      brief || null,
      allow_negotiation === false ? false : true,
      groupId,
    ]
  );

  // dateRules ride along so the new-set screen that opens next never guesses a date (A12).
  return success(res, { campaign: rows[0], dateRules: campaignState.dateRules() }, 201);
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

  // Pending per-creator date-change requests (migration 106). Latest pending
  // request per campaign_influencer drives the brand's approve/reject card.
  const { rows: dcrRows } = await db.query(
    `SELECT DISTINCT ON (dcr.campaign_influencer_id)
            dcr.id, dcr.campaign_influencer_id, dcr.requested_start, dcr.requested_end,
            dcr.reason, dcr.status, dcr.created_at
       FROM date_change_requests dcr
       JOIN campaign_influencers ci ON ci.id = dcr.campaign_influencer_id
       JOIN campaign_sets cs        ON cs.id = ci.set_id
      WHERE cs.campaign_id = $1 AND dcr.status = 'requested'
      ORDER BY dcr.campaign_influencer_id, dcr.created_at DESC`,
    [campaign.id]
  );
  const dcrMap = {};
  for (const r of dcrRows) dcrMap[r.campaign_influencer_id] = r;

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
      // Effective posting window: per-creator (window_start/window_end from
      // ci.*) overrides the set window; the page resolves the fallback.
      ci.set_window_start = set.window_start;
      ci.set_window_end   = set.window_end;
      ci.pending_date_change = dcrMap[ci.id] || null;
      if (hasTransactions) ci.transaction_count = txnMap[ci.id] || 0;
    }
  }

  return success(res, { campaign });
});

const update = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  // Item 4 — the name and description can be changed at any time (C11: Rename campaign, Edit
  // description, offered on a live campaign). The older money-adjacent fields stay draft-only.
  // Item 6 (APPROVAL §4.11): the negotiation switch may change at any time — it governs only new
  // counters, and an open negotiation always runs to its end (rules §7B). start_date stays draft-only.
  const touchesLegacy = ['start_date'].some(f => req.body[f] !== undefined);
  if (touchesLegacy && campaign.status !== 'draft') {
    throw new AppError('VALIDATION_ERROR', `Only draft campaigns can be edited. Current status: ${campaign.status}`, 422);
  }
  const v4 = campaignState.validateCampaignInput(req.body, { requireName: false });
  if (!v4.ok) throw new AppError('VALIDATION_ERROR', v4.message, 422, v4.field);

  // collab-part5 — total_budget and end_date are derived from the sets and are no longer
  // accepted here. They are dropped rather than rejected so a stale client mid-deploy does
  // not hard-fail; the derived values are authoritative either way. Deliberately NOT
  // recomputed on this path: existing campaigns keep their stored dates until a SET is
  // touched, so renaming a live campaign never silently changes when it ends.
  const allowed = ['name', 'start_date', 'brief', 'allow_negotiation'];
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
  // Item 4 — a campaign can be deleted only while every set is a draft with nothing sent.
  await campaignState.assertCampaignDeletable(campaign.id);
  try {
    await db.query(`DELETE FROM campaigns WHERE id = $1`, [campaign.id]);
  } catch (e) {
    if (e && e.code === '23503') throw new AppError('CONFLICT', CMSG.DELETE_CAMPAIGN_IN_USE, 409);
    throw e;
  }
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

/**
 * GET /campaigns/:id/deferred — SB-24's "Moved out".
 * Contract: features/stage-a-the-set. Migration 167.
 *
 * Every creator who raised a reservation about a set's day or shoot mode (offer.defer)
 * anywhere in this campaign, across all of its sets. Her row still carries set_id — she
 * is just no longer counted as one of that set's active creators (status = 'deferred').
 * Returned with the terms already settled (money, allocation, offer, channels/formats),
 * which is exactly what "build a set from these" carries forward unchanged.
 */
const getDeferred = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);

  const { rows } = await db.query(
    `SELECT ci.*, inf.instagram_handle, u.name AS influencer_name, u.phone AS influencer_phone,
            cs.id AS original_set_id, cs.name AS original_set_name
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN influencers inf ON inf.id = ci.influencer_id
       JOIN users u ON u.id = inf.user_id
      WHERE cs.campaign_id = $1 AND ci.status = 'deferred'
      ORDER BY ci.deferred_at DESC`,
    [req.params.id]
  );

  return success(res, { deferred: rows });
});

/**
 * stage-2 §5.3 / ledger #69 — the sales-set mirror of formats_json.
 *
 * The rule itself lives in services/campaignChannels so the phone, the web wizard and any
 * later reader all name the same channels. This is only the HTTP shell that turns its
 * verdict into the error shape the API speaks.
 */

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
    // stage-2 §5.3 — sales/hybrid guidance: which channels a creator here may use.
    channels_json,
    // stage-a — the three things that DEFINE a set. See services/setShape.model.js.
    go_live_date,
    shoot_mode,
    // Item 4 — the branch a Store Visit set names (rules v1.14 §5B).
    branch_id,
  } = req.body;

  // Item 4 — name (≤ 60), Aim, mode of work, branch (Store Visit), posting date at least 7
  // days ahead: the exact §7 messages, checked on the server for every caller. The invitation
  // cutoff is always calculated from the posting date (founder Q3); a client value is ignored.
  const v4 = await campaignState.validateSetInput({ name, goal, shoot_mode, branch_id, go_live_date }, { brandId: brand.id });
  if (!v4.ok) throw new AppError('VALIDATION_ERROR', v4.message, 422, v4.field);
  const branchId = shoot_mode === 'visit' ? branch_id : null;
  const invites_close_at = campaignState.cutoffFor(go_live_date);

  // stage-2 §5.2 — a paid HANDPICK set may omit set_budget, in which case campaignRollup
  // derives it from the sum of that set's agreed fees, and keeps it in step with every
  // later invite. That is what makes the board's "Budget · calculated" honest instead of
  // asking the brand to re-add numbers they already settled one at a time.
  //
  // Still required for OPEN-GROUP paid sets: they have no creator list to sum — their
  // money is a projection (per_influencer_budget × max_cap) — so deriving would write
  // zero and publish would then refuse the campaign for having no budget. A typed value
  // is always kept, so brand-web's deliberate headroom over the fee sum survives.
  const isOpenGroup = (influencer_mode || 'handpick') === 'open_group';
  if ((goal === 'engagement' || goal === 'hybrid') && set_budget == null && isOpenGroup) {
    throw new AppError('VALIDATION_ERROR', 'set_budget is required for an open-group engagement or hybrid set — there is no creator list to derive it from', 422, 'set_budget');
  }
  if (goal === 'conversion' && set_budget != null) {
    throw new AppError('VALIDATION_ERROR', 'set_budget must not be set for conversion goals', 422, 'set_budget');
  }

  assertValidChannels(goal, channels_json);

  // One aim, one go-live day, one way of shooting. The wizard offers two shoot modes;
  // the older brand-approve path may still set 'remote'. Same function answers both, so
  // the app and the server cannot disagree about what a set may look like.
  const shape = setShape.validateSetShape({ go_live_date, shoot_mode, invites_close_at });
  if (!shape.ok) {
    throw new AppError('VALIDATION_ERROR', shape.error, 422, shape.field);
  }

  // Coupon prefix is optional for conversion/hybrid handpick sets (each invite
  // can carry its own coupon_code); open-group joiners have no per-influencer
  // code, so the prefix stays mandatory there. Engagement must not have one.
  // An open-group set used to REQUIRE a prefix, on the same false premise: that a joiner with
  // no code could not be tracked. She is tracked the same way everyone else is — by
  // campaign_influencer_id on the transaction. Removed with the per-creator refusal rather
  // than left behind, because leaving one of two identical rules is how the app comes to
  // contradict itself on the next screen along.
  if (goal === 'engagement' && coupon_prefix) {
    throw new AppError('VALIDATION_ERROR', 'coupon_prefix must not be set for engagement goals', 422, 'coupon_prefix');
  }

  assertValidFormats(formats_json);

  // collab-part5 — the "set budget exceeds remaining campaign budget" check is gone, and
  // could not fire even if kept: the campaign total is now DEFINED as the sum of the paid
  // sets, so a set cannot exceed it. The brand's real constraint is their wallet, which
  // publish still enforces against the derived total.

  const { rows } = await db.query(
    `INSERT INTO campaign_sets
       (campaign_id, name, goal, influencer_mode, set_budget, per_influencer_budget,
        max_cap, window_start, window_end, brief, coupon_prefix,
        formats_json, assets_json, open_group_filters, channels_json,
        go_live_date, shoot_mode, invites_close_at, branch_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19)
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
      // NULL, not '{}' — "this set never stated a channel expectation" is a different
      // thing from "it stated an empty one", and only NULL is true of every set today.
      channels_json ? JSON.stringify(channels_json) : null,
      // The three that define the set. NULL means 'not stated yet' — the wizard fills
      // them in a screen at a time, and a pre-set-first set has none of them.
      go_live_date || null,
      shoot_mode || null,
      invites_close_at || null,
      branchId,
    ]
  );

  const derived = await campaignRollup.recompute(campaign.id);
  return success(res, { set: rows[0], campaign_derived: derived, cutoff: invites_close_at, dateRules: campaignState.dateRules() }, 201);
});

const updateSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);

  // Item 4 — THE LOCK. Once an invitation has gone out, Aim, posting date, mode and branch
  // never change; the name still can. Enforced here, the one place every caller goes through,
  // with the exact §7 message. Nothing was locked before item 4.
  await campaignState.assertSetEditable(set, req.body);
  const v4 = await campaignState.validateSetInput(req.body, { brandId: brand.id, existing: set, requireAll: false });
  if (!v4.ok) throw new AppError('VALIDATION_ERROR', v4.message, 422, v4.field);
  // The cutoff is derived from the posting date; a client value is never trusted.
  if (req.body.go_live_date !== undefined) req.body.invites_close_at = campaignState.cutoffFor(req.body.go_live_date);
  else if (req.body.invites_close_at !== undefined) req.body.invites_close_at = campaignState.cutoffFor(set.go_live_date);
  // A Remote set names no branch.
  const modeAfter = req.body.shoot_mode !== undefined ? req.body.shoot_mode : set.shoot_mode;
  if (modeAfter === 'shipment') req.body.branch_id = null;

  const allowed = [
    'name', 'goal', 'influencer_mode', 'set_budget', 'per_influencer_budget',
    'max_cap', 'window_start', 'window_end', 'brief', 'coupon_prefix',
    'formats_json', 'assets_json', 'open_group_filters', 'channels_json',
    'go_live_date', 'shoot_mode', 'invites_close_at', 'branch_id',
  ];
  if (req.body.formats_json !== undefined) assertValidFormats(req.body.formats_json);
  if (req.body.channels_json !== undefined) {
    // The goal being edited in the same call wins; otherwise the stored one applies.
    assertValidChannels(req.body.goal !== undefined ? req.body.goal : set.goal, req.body.channels_json);
  }

  // Validate the shape the set will HAVE, not just the fields in this request — sending
  // invites_close_at alone must still be checked against the stored go_live_date.
  //
  // An EXISTING go-live day is not re-checked against the lead time: a set built last week
  // is allowed to launch tomorrow, and re-validating it would make a set un-editable simply
  // because time passed. Only a day being CHANGED now must clear the lead time.
  if (['go_live_date', 'shoot_mode', 'invites_close_at'].some((f) => req.body[f] !== undefined)) {
    const changingDay = req.body.go_live_date !== undefined;
    const merged = {
      go_live_date:     changingDay ? req.body.go_live_date : set.go_live_date,
      shoot_mode:       req.body.shoot_mode       !== undefined ? req.body.shoot_mode       : set.shoot_mode,
      invites_close_at: req.body.invites_close_at !== undefined ? req.body.invites_close_at : set.invites_close_at,
    };
    const shape = setShape.validateSetShape(merged, changingDay ? {} : { today: '1970-01-01' });
    if (!shape.ok) throw new AppError('VALIDATION_ERROR', shape.error, 422, shape.field);
  }

  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) {
      if (['formats_json', 'assets_json', 'open_group_filters'].includes(field)) {
        updates[field] = JSON.stringify(req.body[field]);
      } else if (field === 'channels_json') {
        // Explicit null clears it — the wizard's back button must be able to unsay this.
        updates[field] = req.body[field] === null ? null : JSON.stringify(req.body[field]);
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
  const derived = await campaignRollup.recompute(req.params.id);
  return success(res, { set: rows[0], campaign_derived: derived });
});

const deleteSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);

  // Item 4 — a set with ANY invitation can never be deleted, so a signed contract can never be
  // destroyed through the cascade (APPROVAL.md Q8). Where a foreign key would still refuse
  // (offers, sales), answer readably instead of a 500. The old "at least one set must remain"
  // rule is gone: a campaign is only a container and may sit empty as a draft.
  await campaignState.assertSetDeletable(set);
  try {
    await db.query(`DELETE FROM campaign_sets WHERE id = $1`, [set.id]);
  } catch (e) {
    if (e && e.code === '23503') throw new AppError('CONFLICT', CMSG.DELETE_SET_IN_USE, 409);
    throw e;
  }
  // Deleting the last conversion set makes the campaign all-paid, which gives it a
  // derived end date; deleting a paid set can move that date earlier.
  const derived = await campaignRollup.recompute(campaign.id);
  return success(res, { message: 'Set deleted successfully', campaign_derived: derived });
});

/**
 * POST /campaigns/:id/sets/:sid/duplicate   { name?, go_live_date }
 *
 * Item 4 (rules v1.14 §5B, C10, APPROVAL.md Q5): copies the SETTINGS — Aim, mode of work,
 * branch, channels, formats, brief, coupon prefix, budgets, open-group filters — into a new
 * draft set in the same campaign with a new posting date. Never creators, invitations or
 * agreements. Before item 4 this copied every creator row as a fresh invitation, which is the
 * exact state the invite path refuses.
 */
const duplicateSet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);
  const body = req.body || {};

  const { rows: nameRows } = await db.query(`SELECT name FROM campaign_sets WHERE campaign_id = $1`, [campaign.id]);
  const names = nameRows.map(r => r.name);
  // The brand types a name (pre-filled "<name> (copy)"); without one the copy is made unique
  // by suffix, never by a count that can collide after a delete.
  const newName = body.name != null && String(body.name).trim() ? String(body.name).trim() : campaignState.uniqueCopyName(set.name, names);
  if (newName.length > 60) throw new AppError('VALIDATION_ERROR', CMSG.SET_NAME, 422, 'name');
  if (names.some(n => String(n).trim().toLowerCase() === newName.toLowerCase())) {
    throw new AppError('CONFLICT', 'A set with this name already exists in this campaign.', 409, 'name');
  }
  // A new posting date is required and must clear the seven days; the cutoff follows from it.
  if (!body.go_live_date) throw new AppError('VALIDATION_ERROR', CMSG.DATE, 422, 'go_live_date');
  const v4 = await campaignState.validateSetInput({ go_live_date: body.go_live_date }, { brandId: brand.id, requireAll: false, existing: { ...set, go_live_date: null } });
  if (!v4.ok) throw new AppError('VALIDATION_ERROR', v4.message, 422, v4.field);
  const cutoff = campaignState.cutoffFor(body.go_live_date);

  const { rows: newSetRows } = await db.query(
    `INSERT INTO campaign_sets
       (campaign_id, name, goal, influencer_mode, set_budget, per_influencer_budget,
        max_cap, brief, coupon_prefix, formats_json, assets_json, open_group_filters,
        channels_json, shoot_mode, branch_id, go_live_date, invites_close_at)
     SELECT campaign_id, $2, goal, influencer_mode, set_budget, per_influencer_budget,
        max_cap, brief, coupon_prefix, formats_json, assets_json, open_group_filters,
        channels_json, shoot_mode, branch_id, $3, $4
     FROM campaign_sets WHERE id = $1
     RETURNING *`,
    [set.id, newName, body.go_live_date, cutoff]
  );
  const newSet = newSetRows[0];

  // Like create/update/delete: the campaign's derived totals follow the new set.
  const derived = await campaignRollup.recompute(campaign.id);
  return success(res, { set: newSet, campaign_derived: derived, cutoff }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// Offer Engine (Sub-contract C) — resolve a per-influencer offer attachment.
// ─────────────────────────────────────────────────────────────────────────────
// Invite influencer (handpick)
// POST /campaigns/:id/sets/:sid/invite
// ─────────────────────────────────────────────────────────────────────────────

const invite = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  const set = await getSetOrThrow(req.params.sid, req.params.id);
  // Item 5 — the legacy brief door. Every gate, the terms rules and the write live in
  // invitationSend (one service for every door, APPROVAL.md §4.2). This door runs the terms
  // validator in 'legacy' mode: what is present is held to the §7 rules; a missing commission,
  // fee or deliverables list is not refused here (founder Q6 — see the item 5 summary).
  const out = await invitationSend.sendLegacy({ brand, campaign, set, body: req.body || {}, actorUserId: req.user.sub });
  return success(res, out, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// Update an existing campaign_influencer (draft editing)
// PATCH /campaigns/:id/sets/:sid/influencers/:ciId
// ─────────────────────────────────────────────────────────────────────────────

const updateInfluencer = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);
  await getSetOrThrow(req.params.sid, req.params.id);
  const { rows } = await db.query(`SELECT id FROM campaign_influencers WHERE id = $1 AND set_id = $2`, [req.params.ciId, req.params.sid]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign influencer assignment not found', 404);
  // Item 5 (APPROVAL.md §3.2): there is no such thing as an unsent row — the multi-creator
  // draft lives in the app, so a row exists only because it was sent — and sent terms are
  // never edited. The silent NULLing of nine fields this endpoint used to do is gone with it.
  throw new AppError('LOCKED', MSG5.SENT_LOCKED, 422);
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

/**
 * POST /campaigns/preview-basket — "what a shopper pays".
 * Contract: features/stage-2-build-a-campaign-from-the-phone · ledger #96
 * Board: 04-preview/mockups/stage2-screens.html panel ⑧
 *
 * The brand picks a sample basket and sees every offer that could apply, which one wins,
 * what the shopper pays, and what the creator earns. Offer stacking is the single most
 * confusing thing about running a shop, and a brand publishing an offer they have never
 * seen resolve is how "why did this sell for that price?" arrives a week later.
 *
 * WHY IT GOES THROUGH THE SAME RESOLVER
 * offerResolution.scoreAllCandidates is the function the shopping app's checkout uses. A
 * preview with its own copy of the arithmetic would eventually disagree with the till,
 * and a preview that can disagree with the till is worse than no preview — the brand
 * trusts a number that will not happen. So this endpoint builds the resolver's inputs and
 * renders its output. It holds no discount maths of its own.
 *
 * The only door onto that resolver before this was POST /transactions/cart/price, which
 * is follower-authenticated. A brand could not call it.
 */
const previewBasket = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const {
    product_ids = [],
    quantities = {},
    commission_pct,
    brand_offer_id,
    offer_type,
    offer_config_json,
  } = req.body || {};

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Pick at least one product for the sample basket', 422, 'product_ids');
  }
  if (product_ids.length > 20) {
    throw new AppError('VALIDATION_ERROR', 'A sample basket is capped at 20 products', 422, 'product_ids');
  }
  // ANY($2::uuid[]) makes Postgres reject a malformed id with a 500 rather than a refusal
  // the client can read. Check the shape here so a bad id is a named 422.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!product_ids.every(id => UUID.test(String(id)))) {
    throw new AppError('VALIDATION_ERROR', 'product_ids must be product ids', 422, 'product_ids');
  }

  // Only this brand's live products — a preview against someone else's catalogue, or
  // against stock that is not listed, would be a preview of something that cannot happen.
  const { rows: products } = await db.query(
    `SELECT id, name, price, image_url, is_active
       FROM brand_products
      WHERE brand_id = $1 AND id = ANY($2::uuid[]) AND is_active = true`,
    [brand.id, product_ids]
  );
  if (!products.length) {
    throw new AppError('VALIDATION_ERROR', 'None of those products are live in your store', 422, 'product_ids');
  }

  const items = products.map(p => ({
    product_id: p.id,
    variant_id: null,
    quantity: Math.max(1, Number(quantities[p.id] || 1)),
  }));
  const priceMap = new Map(products.map(p => [p.id, parseFloat(p.price) || 0]));
  const subtotal = items.reduce((sum, i) => sum + (priceMap.get(i.product_id) || 0) * i.quantity, 0);

  // The candidate shape the resolver expects from a campaign_influencers row. Built here
  // rather than read from the database because the brand is previewing an offer they have
  // not saved yet — that is the whole point of a preview.
  const ci = (offer_type || brand_offer_id)
    ? { offer_type: offer_type || null, offer_config_json: offer_config_json || {}, brand_offer_id: brand_offer_id || null }
    : null;

  const { candidates, best } = await offerResolution.scoreAllCandidates({
    ci, brandId: brand.id, items, priceMap, variantPriceMap: new Map(), billAmount: subtotal,
  });

  const discount = best ? Number(best.amount) : 0;
  const shopperPays = Math.max(0, parseFloat((subtotal - discount).toFixed(2)));
  const pct = commission_pct != null ? Number(commission_pct) : null;

  return success(res, {
    basket: products.map(p => ({
      id: p.id,
      name: p.name,
      price: parseFloat(p.price) || 0,
      image_url: p.image_url || null,
      quantity: items.find(i => i.product_id === p.id).quantity,
    })),
    subtotal: parseFloat(subtotal.toFixed(2)),
    // Every candidate, winner and losers alike, each with the reason it did not apply.
    candidates,
    winner: best ? { source: best.c.source, offer_id: best.c.offer_id, offer_type: best.c.offerType, discount_amount: parseFloat(discount.toFixed(2)) } : null,
    shopper_pays: shopperPays,
    // Commission is earned on what the shopper actually paid, not on the list price.
    creator_earns: pct != null && pct > 0 ? parseFloat((shopperPays * pct / 100).toFixed(2)) : null,
    commission_pct: pct,
  });
});

/**
 * GET /campaigns/:id/publish-check — what the Review screen shows before Publish.
 * Contract: features/stage-2-build-a-campaign-from-the-phone · ledger #63
 *
 * Read-only, and it is the SAME evaluation publish enforces. A screen that computed its
 * own version of "can this publish" would eventually offer a Publish button the server
 * refuses, or grey one out that would have worked.
 *
 * The wallet is reported here too, so the Review screen can state the shortfall in the
 * same list rather than surfacing it only as a failed publish.
 */
const publishCheck = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  const { blockers, warnings } = await publishGate.evaluate(campaign.id, brand.id);

  const { rows: sets } = await db.query(
    `SELECT goal, set_budget FROM campaign_sets WHERE campaign_id = $1`, [campaign.id]);
  const needsBudget = sets.some(s => s.goal === 'engagement' || s.goal === 'hybrid');

  let wallet = null;
  if (needsBudget) {
    const { rows: brows } = await db.query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brand.id]);
    const balance = parseFloat(brows[0].wallet_balance) || 0;
    const required = parseFloat(campaign.total_budget) || 0;
    wallet = { required, balance, short: Math.max(0, required - balance) };
    if (required <= 0) {
      blockers.push({
        code: 'NO_BUDGET',
        message: 'This campaign has a set you pay for, but its budget works out at zero. Check the fees you agreed with each creator.',
        field: 'total_budget',
      });
    } else if (balance < required) {
      blockers.push({
        code: 'WALLET_INSUFFICIENT',
        message: `Your wallet is short by ₹${(required - balance).toFixed(2)}. A content set can't publish until the wallet covers the fees.`,
        field: 'wallet_balance',
        required, balance,
      });
    }
  }

  return success(res, {
    can_publish: blockers.length === 0 && campaign.status === 'draft',
    status: campaign.status,
    blockers,
    warnings,
    wallet,
  });
});

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

  // stage-2 slice 2 — the four blockers that did not exist. Until now publish enforced
  // only the wallet, so a creator could be contracted into a sales set with NOTHING to
  // sell: since Part 4, having something to sell is the gate for appearing in the shopping
  // app at all. The rules live in publishGate so the Review screen and this path cannot
  // disagree about whether a campaign is publishable.
  //
  // Deliberately BEFORE the wallet check: a brand should not be told to top up money for a
  // campaign that is broken for a different reason.
  const gate = await publishGate.evaluate(campaign.id, brand.id);
  if (gate.blockers.length) {
    const first = gate.blockers[0];
    throw new AppError(
      'VALIDATION_ERROR',
      gate.blockers.length === 1
        ? first.message
        : `${first.message} (and ${gate.blockers.length - 1} other thing${gate.blockers.length === 2 ? '' : 's'} to fix)`,
      422,
      first.field,
      { blockers: gate.blockers, warnings: gate.warnings }
    );
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
      `SELECT ci.*, inf.instagram_handle, u.name AS influencer_name, u.phone AS influencer_phone,
              -- stage-4 — the spine's step 3 opens the shoot, and a shoot is reached through its
              -- contract. Without this the button had nothing to navigate with. LEFT JOIN LATERAL:
              -- a creator who has not signed has no contract, and that is a normal state, not a
              -- missing row.
              con.id AS contract_id, con.production_mode AS contract_production_mode
       FROM campaign_influencers ci
       JOIN influencers inf ON inf.id = ci.influencer_id
       JOIN users u ON u.id = inf.user_id
       LEFT JOIN LATERAL (
         SELECT c2.id, c2.production_mode FROM contracts c2
          WHERE c2.campaign_influencer_id = ci.id ORDER BY c2.created_at DESC LIMIT 1
       ) con ON TRUE
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

      // Item 11 (v1.27 §11.2, approval Q4) — money in settles what is owed. "Next money in"
      // is EVERY credit that reaches brands.wallet_balance, not only a top-up: an escrow
      // refund is money the brand can spend, so an outstanding courier charge comes off it
      // first, oldest-first, in this same transaction.
      await require('../services/remoteMoney.service')
        .settleDuesFromCredit(client, brand.id, refundAmount);
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
// End campaign — the deliberate finish, as opposed to cancel's abort
// POST /campaigns/:id/end
// collab-part5-sales-aim-separation
//
// Why this exists at all: once a sales campaign has no end date, NOTHING can ever close
// it. The nightly job selects on `end_date < CURRENT_DATE`, which a NULL never matches,
// and nothing in the codebase decrements stock, so "runs until stock sells out" cannot
// detect its own end. Cancel is not a substitute — it refunds escrow and records
// 'cancelled', filing a sold-out success as a failure and showing the creator that word.
//
// Guards mirror the nightly job's own protection so manual and automatic completion can
// never disagree: a brand must not be able to end their way out of paying someone, or out
// of reviewing work already submitted to them.
// ─────────────────────────────────────────────────────────────────────────────

// Escrow money that is still owed to a creator. 'released' is paid; 'refunded' has gone
// back to the brand. Everything else is in flight and blocks the finish.
const ESCROW_OWED_STATUSES = ['locked', 'queued', 'processing', 'disputed'];

// Work the creator has handed over and the brand has not yet dealt with.
const DELIVERABLE_AWAITING_BRAND = ['submitted', 'under_review'];

const endCampaign = asyncHandler(async (req, res) => {
  const brand    = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);

  const ENDABLE = ['published', 'active', 'live'];
  if (!ENDABLE.includes(campaign.status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      campaign.status === 'draft'
        ? 'This campaign is still a draft — there is nothing to end. Delete it instead.'
        : `Campaign is already ${campaign.status} and cannot be ended`,
      422,
      'status'
    );
  }

  // Money still owed — name the amount and the earliest release date so the brand knows
  // when they CAN end, rather than being told a flat no.
  const { rows: owed } = await db.query(
    // Deliberately not promising a release DATE here: tranche 3 fires N days after
    // triggered_at where N is admin-configurable, so any date this message printed could
    // be wrong. The count and the amount are facts; "once they clear" is honest.
    `SELECT COUNT(*)::int              AS n,
            COALESCE(SUM(ee.amount),0) AS total
       FROM escrow_entries ee
       JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
       JOIN campaign_sets cs        ON cs.id = ci.set_id
      WHERE cs.campaign_id = $1
        AND ee.status = ANY($2::escrow_status[])`,
    [campaign.id, ESCROW_OWED_STATUSES]
  );
  if (owed[0].n > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot end yet — ${owed[0].n} creator payment(s) totalling ₹${parseFloat(owed[0].total).toFixed(2)} have not been released. End the campaign once they clear.`,
      422,
      'escrow_pending',
      { pending_count: owed[0].n, pending_amount: parseFloat(owed[0].total) }
    );
  }

  // Work awaiting the brand's own review.
  const { rows: awaiting } = await db.query(
    `SELECT COUNT(*)::int AS n,
            MIN(COALESCE(u.name, i.instagram_handle)) AS who
       FROM deliverables d
       JOIN campaign_influencers ci ON ci.id = d.campaign_influencer_id
       JOIN campaign_sets cs        ON cs.id = ci.set_id
       JOIN influencers i           ON i.id  = ci.influencer_id
       LEFT JOIN users u            ON u.id  = i.user_id
      WHERE cs.campaign_id = $1
        AND d.status = ANY($2::deliverable_status[])`,
    [campaign.id, DELIVERABLE_AWAITING_BRAND]
  );
  if (awaiting[0].n > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot end yet — ${awaiting[0].n} submission(s) are waiting for your review${awaiting[0].who ? ` (including ${awaiting[0].who}'s)` : ''}. Review them first, then end.`,
      422,
      'deliverables_awaiting_review',
      { awaiting_count: awaiting[0].n }
    );
  }

  // Everyone who was actually collaborating. Completing the campaign takes their products
  // out of follower discovery (LIVE_COLLAB_WHERE requires published/active/live), so they
  // are told rather than left to notice a link that stopped selling.
  const { rows: participants } = await db.query(
    `SELECT DISTINCT i.user_id, u.fcm_token, u.phone
       FROM campaign_influencers ci
       JOIN campaign_sets cs  ON cs.id = ci.set_id
       JOIN influencers i     ON i.id  = ci.influencer_id
       JOIN users u           ON u.id  = i.user_id
      WHERE cs.campaign_id = $1
        AND ci.status IN ('contracted','active','completed')`,
    [campaign.id]
  );

  await db.query(
    `UPDATE campaigns SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [campaign.id]
  );

  for (const person of participants) {
    try {
      await notificationService.send({
        userId:   person.user_id,
        type:     'campaign.ended',
        title:    'A collaboration has ended',
        body:     `"${campaign.name}" has been closed by the brand. Your products from it are no longer listed, and commission you already earned is unaffected.`,
        data:     { screen: 'collabs' },
        fcmToken: person.fcm_token,
        sendSms:  false,
        phone:    person.phone,
      });
    } catch (e) {
      console.error('[endCampaign] notification send failed:', e.message);
    }
  }

  // Read the row back rather than reporting the status we intended to write.
  const { rows: after } = await db.query(
    `SELECT id, status, completed_at FROM campaigns WHERE id = $1`,
    [campaign.id]
  );

  return success(res, {
    campaign_id:         after[0].id,
    status:              after[0].status,
    completed_at:        after[0].completed_at,
    creators_notified:   participants.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancel a single influencer assignment
// POST /campaigns/:id/influencers/:ciid/cancel
// ─────────────────────────────────────────────────────────────────────────────

const cancelInfluencer = asyncHandler(async (req, res) => {
  const brand    = await getBrandOrThrow(req.user.sub);
  const campaign = await getCampaignOrThrow(req.params.id, brand.id);
  // Item 5 — this used to write status 'cancelled', a value the enum does not contain, so it
  // failed every time it was called. It is now the brand's REMOVE (rules §7A): allowed until
  // both signatures, deletes an unsigned contract, never touches money, tells the creator
  // plainly with no reason. The set is found through the row, since this route has no :sid.
  const { rows } = await db.query(
    `SELECT ci.set_id FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id WHERE ci.id = $1 AND cs.campaign_id = $2`,
    [req.params.ciid, campaign.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign influencer assignment not found', 404);
  const set = await getSetOrThrow(rows[0].set_id, campaign.id);
  const ci = await invitationSend.remove({ brand, campaign, set, ciId: req.params.ciid, actorUserId: req.user.sub });
  return success(res, { campaign_influencer_id: ci.id, status: ci.status, refund_amount: 0 });
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

// ─────────────────────────────────────────────────────────────────────────────
// Command Center — Phase 2: store-clicks rollup
// ─────────────────────────────────────────────────────────────────────────────

// GET /brands/me/campaigns/:id/clicks — link_clicks aggregated per-influencer
// and per-set for this campaign. link_clicks (migration 007) stores
// influencer_id, set_id, campaign_id; we GROUP BY each to mirror the engagement
// payload shape (by_influencer / by_set) the Command Center already consumes.
const getCampaignClicks = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);
  const campaignId = req.params.id;

  const { rows: byInfluencer } = await db.query(
    `SELECT influencer_id, COUNT(*)::int AS clicks
       FROM link_clicks
      WHERE campaign_id = $1 AND influencer_id IS NOT NULL
      GROUP BY influencer_id`,
    [campaignId]
  );

  const { rows: bySet } = await db.query(
    `SELECT set_id, COUNT(*)::int AS clicks
       FROM link_clicks
      WHERE campaign_id = $1 AND set_id IS NOT NULL
      GROUP BY set_id`,
    [campaignId]
  );

  const { rows: totalRows } = await db.query(
    `SELECT COUNT(*)::int AS clicks FROM link_clicks WHERE campaign_id = $1`,
    [campaignId]
  );

  return success(res, {
    total_clicks:  totalRows[0]?.clicks || 0,
    by_influencer: byInfluencer,
    by_set:        bySet,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Command Center — Phase 3: per-creator date-change request / approve flow
// (migration 106: campaign_influencers.window_start/window_end +
//  date_change_requests). The influencer-app screen that CREATES a request is a
//  follow-up; the endpoint exists here so the flow is testable via API.
// ─────────────────────────────────────────────────────────────────────────────

// POST /campaign-influencers/:id/date-change — influencer requests a new window.
const createDateChangeRequest = asyncHandler(async (req, res) => {
  const ciId = req.params.id;
  const { requested_start, requested_end, reason } = req.body;

  if (!requested_start || !requested_end) {
    throw new AppError('VALIDATION_ERROR', 'requested_start and requested_end are required', 422);
  }
  if (new Date(requested_end) < new Date(requested_start)) {
    throw new AppError('VALIDATION_ERROR', 'requested_end must be on or after requested_start', 422);
  }

  // Verify the influencer owns this campaign_influencer.
  const { rows: infRows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [req.user.sub]);
  if (!infRows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const influencerId = infRows[0].id;

  const { rows: ciRows } = await db.query(
    `SELECT id FROM campaign_influencers WHERE id = $1 AND influencer_id = $2`,
    [ciId, influencerId]
  );
  if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Campaign assignment not found', 404);

  const { rows } = await db.query(
    `INSERT INTO date_change_requests (campaign_influencer_id, requested_start, requested_end, reason)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ciId, requested_start, requested_end, reason ? String(reason).trim() : null]
  );

  // Notify the brand that owns the campaign.
  const { rows: ownerRows } = await db.query(
    `SELECT b.user_id AS brand_user_id, c.id AS campaign_id, c.name AS campaign_name,
            u.name AS influencer_name
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id = cs.campaign_id
       JOIN brands b         ON b.id = c.brand_id
       JOIN influencers i    ON i.id = ci.influencer_id
       JOIN users u          ON u.id = i.user_id
      WHERE ci.id = $1`,
    [ciId]
  );
  const owner = ownerRows[0];
  if (owner) {
    notificationService.send({
      userId: owner.brand_user_id,
      type:   'date_change.requested',
      title:  'Date-change request',
      body:   `${owner.influencer_name || 'A creator'} requested new posting dates for ${owner.campaign_name}.`,
      data:   { screen: 'CampaignCommandCenter', campaign_id: owner.campaign_id, campaign_influencer_id: ciId },
    }).catch(err => console.error('[date-change] notify brand failed:', err.message));
  }

  return success(res, { request: rows[0] }, 201);
});

// GET /brands/me/campaigns/:id/date-change-requests — pending requests for this campaign.
const listDateChangeRequests = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  await getCampaignOrThrow(req.params.id, brand.id);

  const { rows } = await db.query(
    `SELECT dcr.*, ci.influencer_id, inf.instagram_handle, u.name AS influencer_name
       FROM date_change_requests dcr
       JOIN campaign_influencers ci ON ci.id = dcr.campaign_influencer_id
       JOIN campaign_sets cs        ON cs.id = ci.set_id
       JOIN influencers inf         ON inf.id = ci.influencer_id
       JOIN users u                 ON u.id = inf.user_id
      WHERE cs.campaign_id = $1 AND dcr.status = 'requested'
      ORDER BY dcr.created_at ASC`,
    [req.params.id]
  );

  return success(res, { requests: rows });
});

// POST /campaign-influencers/:id/date-change/:requestId/decision — brand approve|reject.
const decideDateChangeRequest = asyncHandler(async (req, res) => {
  const { id: ciId, requestId } = req.params;
  const { action } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('VALIDATION_ERROR', "action must be 'approve' or 'reject'", 422);
  }

  const brand = await getBrandOrThrow(req.user.sub);

  // Verify the brand owns the campaign this request belongs to + the request
  // is still pending. One join confirms ownership end-to-end.
  const { rows: reqRows } = await db.query(
    `SELECT dcr.id, dcr.status, dcr.requested_start, dcr.requested_end,
            ci.id AS ci_id, i.user_id AS influencer_user_id,
            c.id AS campaign_id, c.name AS campaign_name
       FROM date_change_requests dcr
       JOIN campaign_influencers ci ON ci.id = dcr.campaign_influencer_id
       JOIN campaign_sets cs        ON cs.id = ci.set_id
       JOIN campaigns c             ON c.id = cs.campaign_id
       JOIN influencers i           ON i.id = ci.influencer_id
      WHERE dcr.id = $1 AND dcr.campaign_influencer_id = $2 AND c.brand_id = $3`,
    [requestId, ciId, brand.id]
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new AppError('NOT_FOUND', 'Date-change request not found', 404);
  if (reqRow.status !== 'requested') {
    throw new AppError('VALIDATION_ERROR', `Request already ${reqRow.status}`, 422);
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  if (action === 'approve') {
    // Approval writes the per-creator window (overrides the set window).
    await db.query(
      `UPDATE campaign_influencers SET window_start = $1, window_end = $2 WHERE id = $3`,
      [reqRow.requested_start, reqRow.requested_end, ciId]
    );
  }

  const { rows } = await db.query(
    `UPDATE date_change_requests
        SET status = $1, decided_at = now(), decided_by = $2
      WHERE id = $3
      RETURNING *`,
    [newStatus, req.user.sub, requestId]
  );

  // Notify the influencer of the decision.
  notificationService.send({
    userId: reqRow.influencer_user_id,
    type:   `date_change.${newStatus}`,
    title:  action === 'approve' ? 'New posting dates approved' : 'Date-change request declined',
    body:   action === 'approve'
      ? `Your posting window for ${reqRow.campaign_name} was updated.`
      : `Your date-change request for ${reqRow.campaign_name} was declined.`,
    data:   { screen: 'CampaignContent', campaign_id: reqRow.campaign_id, campaign_influencer_id: ciId },
  }).catch(err => console.error('[date-change] notify influencer failed:', err.message));

  return success(res, { request: rows[0] });
});

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
  cancel,
  endCampaign,
  cancelInfluencer,
  approveApplication,
  rejectApplication,
  getSets,
  getDeferred,
  createSet,
  updateSet,
  deleteSet,
  duplicateSet,
  invite,
  updateInfluencer,
  createOffer,
  publish,
  publishCheck,
  previewBasket,
  getLiveHierarchy,
  searchInfluencers,
  openGroupMatches,
  getCampaignProducts,
  getCampaignClicks,
  createDateChangeRequest,
  listDateChangeRequests,
  decideDateChangeRequest,
  // collab-part4 §4.1 — exported for test. Validation of what a creator may sell
  // sits on the money-adjacent path (it decides what can be bought through them),
  // so it is covered directly rather than only through the HTTP handlers.
  resolveAllocation,
  VALID_ALLOC_SCOPES,
};
