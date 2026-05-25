'use strict';

/**
 * quotaCheck.js — Phase A12.1 of the INFLX 3-Layer Revenue Model.
 *
 * Express middleware factory: gates a create-action behind the active
 * subscription tier's quota limit. Returns 422 QUOTA_EXCEEDED with a
 * structured payload telling the client which limit was hit and which
 * tiers would unblock the action.
 *
 *   const { checkQuota } = require('../middleware/quotaCheck');
 *   router.post('/campaigns',
 *     authenticate, requireRole('brand'), requireApproved,
 *     checkQuota('createCampaign'),
 *     campaignController.create);
 *
 * Phase A12.1 migration: limits now come from the entitlements system
 * (features × tier_features → tf.quota_value) — the same numbers admin
 * edits in Section C of the /admin/pricing/tiers/[tier_key] page. The
 * legacy subscription_tiers.max_* columns are no longer read for gating.
 *
 * Lazy-creates a 'free' tier brand_subscriptions row on first call for
 * any brand that doesn't have one yet — the "every existing brand keeps
 * working" guarantee from features/billing-subscriptions-schema/05-impact.md.
 *
 * Limit value `-1` is the sentinel for "unlimited" (enterprise tier);
 * checkQuota passes immediately. Limit value `null` (no entitlement row
 * AND no catalog default) is treated as "not configured" → passes
 * (defensive — would only happen if admin removed all rows for the
 * feature, which the catalog UI prevents).
 *
 * QUOTA_EXCEEDED response body:
 *   {
 *     success: false,
 *     error: {
 *       code: 'QUOTA_EXCEEDED',
 *       message: '<plain English>',
 *       field: '<action>',
 *       details: {
 *         action: '<action>',
 *         feature_key: '<feature_key>',
 *         used:   <int>,
 *         limit:  <int>,
 *         current_tier: '<tier_key>',
 *         upgrade_to:   ['<tier_key>', ...]   // tiers that would allow the action
 *       }
 *     }
 *   }
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const entitlementsService = require('../services/entitlements.service');

// ─────────────────────────────────────────────────────────────────────────────
// Subscription helpers
// ─────────────────────────────────────────────────────────────────────────────

async function _getBrandIdFromUser(client, userId) {
  const { rows } = await client.query(
    `SELECT id FROM brands WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0]?.id || null;
}

/**
 * Returns the brand's active subscription (identity only — tier_id,
 * tier_key, cycle dates). Quota limits are NOT loaded here — the
 * middleware calls entitlements.service.quotaFor per action.
 * Lazy-creates a 'free' row if none exists.
 */
async function _ensureSubscription(client, brandId) {
  const { rows: existing } = await client.query(
    `SELECT bs.id AS sub_id, bs.tier_id, bs.current_cycle_start, bs.current_cycle_end,
            t.tier_key
       FROM brand_subscriptions bs
       JOIN subscription_tiers t ON t.id = bs.tier_id
      WHERE bs.brand_id = $1
        AND bs.status   = 'active'
      LIMIT 1`,
    [brandId]
  );
  if (existing[0]) return existing[0];

  // Lazy-create on the 'free' tier.
  const { rows: freeTier } = await client.query(
    `SELECT id, tier_key
       FROM subscription_tiers
      WHERE tier_key = 'free'
      LIMIT 1`
  );
  if (!freeTier[0]) {
    throw new AppError(
      'INTERNAL_ERROR',
      "free tier missing from subscription_tiers — migration 058 not applied?",
      500
    );
  }

  const { rows: created } = await client.query(
    `INSERT INTO brand_subscriptions
       (brand_id, tier_id, status, current_cycle_start, current_cycle_end)
     VALUES ($1, $2, 'active', current_date, current_date + 30)
     ON CONFLICT DO NOTHING
     RETURNING id AS sub_id, current_cycle_start, current_cycle_end`,
    [brandId, freeTier[0].id]
  );

  return {
    sub_id:              created[0]?.sub_id || null,
    tier_id:             freeTier[0].id,
    tier_key:            freeTier[0].tier_key,
    current_cycle_start: created[0]?.current_cycle_start || new Date(),
    current_cycle_end:   created[0]?.current_cycle_end   || new Date(Date.now() + 30 * 86400_000),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-action counters
// ─────────────────────────────────────────────────────────────────────────────

async function _countCampaigns(client, brandId) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c FROM campaigns
      WHERE brand_id = $1
        AND status NOT IN ('completed','cancelled')`,
    [brandId]
  );
  return rows[0].c;
}

async function _countProducts(client, brandId) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c FROM brand_products WHERE brand_id = $1`,
    [brandId]
  );
  return rows[0].c;
}

async function _countSetsInCampaign(client, campaignId) {
  if (!campaignId) return 0;
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c FROM campaign_sets WHERE campaign_id = $1`,
    [campaignId]
  );
  return rows[0].c;
}

async function _countInvitesThisCycle(client, brandId, cycleStart) {
  const { rows } = await client.query(
    `SELECT COUNT(DISTINCT ci.id)::int AS c
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c     ON c.id  = cs.campaign_id
      WHERE c.brand_id    = $1
        AND ci.created_at >= $2`,
    [brandId, cycleStart]
  );
  return rows[0].c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action registry — each action maps to a feature_key in the catalog.
// Phase A12.1: limits read live from tier_features.quota_value via the
// entitlements service. Admin's Section C edits drive enforcement.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = {
  createCampaign: {
    feature_key: 'active_campaigns',
    counter:     (client, sub, brandId) => _countCampaigns(client, brandId),
    label:       'active campaigns',
  },
  createProduct: {
    feature_key: 'products_in_store',
    counter:     (client, sub, brandId) => _countProducts(client, brandId),
    label:       'products',
  },
  createSet: {
    feature_key: 'sets_per_campaign',
    counter:     (client, sub, brandId, req) =>
                   _countSetsInCampaign(client, req.params.campaignId || req.params.id || req.body?.campaign_id),
    label:       'sets per campaign',
  },
  inviteInfluencer: {
    feature_key: 'invitations_per_cycle',
    counter:     (client, sub, brandId) =>
                   _countInvitesThisCycle(client, brandId, sub.current_cycle_start),
    label:       'influencer invites this cycle',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// "Upgrade-to" query — tiers that allow MORE than the current limit for the
// given feature. Reads tier_features (the same surface admin edits) so the
// upgrade suggestion is always consistent with what they actually configured.
// ─────────────────────────────────────────────────────────────────────────────

async function _findUpgradeTiers(client, featureKey, currentTierKey, currentLimit) {
  const { rows } = await client.query(
    `SELECT t.tier_key
       FROM subscription_tiers t
       JOIN tier_features tf ON tf.tier_id = t.id
       JOIN features f       ON f.id       = tf.feature_id
      WHERE t.active        = true
        AND t.tier_key     <> $1
        AND f.feature_key   = $2
        AND tf.included     = true
        AND (tf.quota_value = -1 OR tf.quota_value > $3)
      ORDER BY t.sort_order`,
    [currentTierKey, featureKey, currentLimit]
  );
  return rows.map(r => r.tier_key);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared evaluator — returns the quota state without throwing.
// Used by the middleware (which throws on would_block) AND by the
// /brands/me/quota-preflight endpoint (which returns the state as JSON
// so frontend can show the popup BEFORE the user fills a form).
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateQuota(req, action) {
  const cfg = ACTIONS[action];
  if (!cfg) throw new Error(`evaluateQuota: unknown action '${action}'`);
  if (!req.user?.sub) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const brandId = await _getBrandIdFromUser(db, req.user.sub);
  if (!brandId) throw new AppError('FORBIDDEN', 'No brand profile for this user', 403);

  const sub   = await _ensureSubscription(db, brandId);
  const limit = await entitlementsService.quotaFor(db, brandId, cfg.feature_key);

  // -1 = unlimited; null = neither tier_features nor catalog default set.
  if (limit === -1 || limit == null) {
    return {
      action,
      feature_key:  cfg.feature_key,
      would_block:  false,
      used:         0,
      limit:        limit == null ? null : -1,
      current_tier: sub.tier_key,
      upgrade_to:   [],
    };
  }

  const used = await cfg.counter(db, sub, brandId, req);
  const would_block = used >= limit;
  const upgrade_to = would_block
    ? await _findUpgradeTiers(db, cfg.feature_key, sub.tier_key, limit)
    : [];

  return {
    action,
    feature_key:  cfg.feature_key,
    would_block,
    used,
    limit,
    current_tier: sub.tier_key,
    upgrade_to,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware factory
// ─────────────────────────────────────────────────────────────────────────────

function checkQuota(action) {
  const cfg = ACTIONS[action];
  if (!cfg) throw new Error(`checkQuota: unknown action '${action}'`);

  return asyncHandler(async (req, res, next) => {
    const r = await evaluateQuota(req, action);
    if (r.would_block) {
      throw new AppError(
        'QUOTA_EXCEEDED',
        `Limit reached on the ${r.current_tier} plan: ${cfg.label} (${r.used} / ${r.limit}). Upgrade to continue.`,
        422,
        action,
        {
          action:       r.action,
          feature_key:  r.feature_key,
          used:         r.used,
          limit:        r.limit,
          current_tier: r.current_tier,
          upgrade_to:   r.upgrade_to,
        }
      );
    }
    return next();
  });
}

module.exports = {
  checkQuota,
  evaluateQuota,
  _ACTIONS_FOR_TEST: ACTIONS,
  _ensureSubscriptionForTest: _ensureSubscription,
};
