'use strict';

/**
 * quotaCheck.js — Phase A4 of the INFLX 3-Layer Revenue Model.
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
 * Lazy-creates a 'free' tier brand_subscriptions row on first call for
 * any brand that doesn't have one yet — the "every existing brand keeps
 * working" guarantee from features/billing-subscriptions-schema/05-impact.md.
 *
 * Limit value `-1` is the sentinel for "unlimited" (enterprise tier);
 * checkQuota passes immediately.
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
 * Returns the brand's active subscription joined with its tier limits.
 * Lazy-creates a 'free' row if none exists.
 */
async function _ensureSubscription(client, brandId) {
  const { rows: existing } = await client.query(
    `SELECT bs.id AS sub_id, bs.tier_id, bs.current_cycle_start, bs.current_cycle_end,
            t.tier_key, t.max_campaigns, t.max_sets_per_campaign,
            t.max_influencers_per_cycle, t.max_products
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
    `SELECT id, tier_key, max_campaigns, max_sets_per_campaign,
            max_influencers_per_cycle, max_products
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
    sub_id:                    created[0]?.sub_id || null,
    tier_id:                   freeTier[0].id,
    tier_key:                  freeTier[0].tier_key,
    current_cycle_start:       created[0]?.current_cycle_start || new Date(),
    current_cycle_end:         created[0]?.current_cycle_end   || new Date(Date.now() + 30 * 86400_000),
    max_campaigns:             freeTier[0].max_campaigns,
    max_sets_per_campaign:     freeTier[0].max_sets_per_campaign,
    max_influencers_per_cycle: freeTier[0].max_influencers_per_cycle,
    max_products:              freeTier[0].max_products,
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
// Action registry
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = {
  createCampaign: {
    limitField: 'max_campaigns',
    counter:    (client, sub, brandId) => _countCampaigns(client, brandId),
    label:      'active campaigns',
  },
  createProduct: {
    limitField: 'max_products',
    counter:    (client, sub, brandId) => _countProducts(client, brandId),
    label:      'products',
  },
  createSet: {
    limitField: 'max_sets_per_campaign',
    counter:    (client, sub, brandId, req) =>
                  _countSetsInCampaign(client, req.params.campaignId || req.params.id || req.body?.campaign_id),
    label:      'sets per campaign',
  },
  inviteInfluencer: {
    limitField: 'max_influencers_per_cycle',
    counter:    (client, sub, brandId) =>
                  _countInvitesThisCycle(client, brandId, sub.current_cycle_start),
    label:      'influencer invites this cycle',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Middleware factory
// ─────────────────────────────────────────────────────────────────────────────

function checkQuota(action) {
  const cfg = ACTIONS[action];
  if (!cfg) throw new Error(`checkQuota: unknown action '${action}'`);

  return asyncHandler(async (req, res, next) => {
    if (!req.user?.sub) {
      return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    }
    const brandId = await _getBrandIdFromUser(db, req.user.sub);
    if (!brandId) {
      return next(new AppError('FORBIDDEN', 'No brand profile for this user', 403));
    }

    const sub   = await _ensureSubscription(db, brandId);
    const limit = sub[cfg.limitField];

    // -1 sentinel = unlimited (enterprise tier or future custom tiers).
    if (limit === -1 || limit == null) return next();

    const used = await cfg.counter(db, sub, brandId, req);

    if (used >= limit) {
      // Find tiers that would unblock this action.
      const { rows: upgrades } = await db.query(
        `SELECT tier_key
           FROM subscription_tiers
          WHERE active = true
            AND tier_key <> $2
            AND (${cfg.limitField} = -1 OR ${cfg.limitField} > $1)
          ORDER BY sort_order`,
        [limit, sub.tier_key]
      );
      throw new AppError(
        'QUOTA_EXCEEDED',
        `Limit reached on the ${sub.tier_key} plan: ${cfg.label} (${used} / ${limit}). Upgrade to continue.`,
        422,
        action,
        {
          action,
          used,
          limit,
          current_tier: sub.tier_key,
          upgrade_to:   upgrades.map(r => r.tier_key),
        }
      );
    }
    return next();
  });
}

module.exports = { checkQuota, _ACTIONS_FOR_TEST: ACTIONS, _ensureSubscriptionForTest: _ensureSubscription };
