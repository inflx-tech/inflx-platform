'use strict';

/**
 * escrow.controller.js
 * Phase 3 — Block E
 *
 * GET /v1/brands/me/escrow  — brand escrow overview across all campaigns
 */

const db          = require('../config/db');
const { success } = require('../utils/response');
const AppError    = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const taxService  = require('../services/tax.service');

function _round2(n) { return parseFloat((parseFloat(n) || 0).toFixed(2)); }

async function getBrandOrThrow(userId) {
  const { rows } = await db.query(
    `SELECT id FROM brands WHERE user_id = $1`,
    [userId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/escrow
// ─────────────────────────────────────────────────────────────────────────────

const getBrandEscrow = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);

  // Fetch all escrow entries belonging to this brand's campaigns
  const { rows: entries } = await db.query(
    `SELECT
       ee.*,
       c.name  AS campaign_name,
       c.id    AS campaign_id,
       ci.id   AS campaign_influencer_id,
       inf.instagram_handle
     FROM escrow_entries ee
     JOIN campaign_influencers ci ON ci.id  = ee.campaign_influencer_id
     JOIN campaign_sets        cs ON cs.id  = ci.set_id
     JOIN campaigns            c  ON c.id   = cs.campaign_id
     JOIN influencers          inf ON inf.id = ci.influencer_id
     WHERE c.brand_id = $1
     ORDER BY c.created_at DESC, ee.tranche_number ASC`,
    [brand.id]
  );

  // Compute summary totals
  let totalLocked   = 0;
  let totalReleased = 0;

  for (const e of entries) {
    const amt = parseFloat(e.amount);
    if (e.status === 'released') totalReleased += amt;
    else if (e.status === 'locked') totalLocked += amt;
  }

  return success(res, {
    entries,
    summary: {
      total_locked:   totalLocked.toFixed(2),
      total_released: totalReleased.toFixed(2),
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/campaigns/:campaign_id/escrow
// ─────────────────────────────────────────────────────────────────────────────

const getCampaignEscrow = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { campaign_id } = req.params;

  // Verify campaign belongs to this brand AND learn the goals of its sets so
  // the response can be goal-aware. Conversion-only campaigns intentionally
  // have no escrow tranches (no fee → no money to lock) — we still return a
  // 200 with empty arrays + a goal_summary so the UI can render the right
  // explanation instead of pretending tranches exist.
  const { rows: campRows } = await db.query(
    `SELECT c.id, c.name, c.status,
            ARRAY_AGG(DISTINCT cs.goal) FILTER (WHERE cs.goal IS NOT NULL) AS goals
     FROM   campaigns c
     LEFT JOIN campaign_sets cs ON cs.campaign_id = c.id
     WHERE  c.id = $1 AND c.brand_id = $2
     GROUP  BY c.id`,
    [campaign_id, brand.id]
  );
  if (!campRows[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  const campaign = campRows[0];
  const goals    = campaign.goals || [];

  // A campaign is "conversion-only" if every set is conversion (or no sets exist).
  // It's "engagement/hybrid" if any set involves a fee.
  const hasFeeBearingGoal  = goals.some(g => g === 'engagement' || g === 'hybrid');
  const isConversionOnly   = goals.length > 0 && !hasFeeBearingGoal;

  // Fetch escrow entries for this specific campaign (brand ownership verified above)
  const { rows: escrowEntries } = await db.query(
    `SELECT
       ee.id,
       ee.amount,
       ee.escrow_fee_amount,
       ee.fee_gst_amount,
       ee.net_to_influencer,
       ee.status,
       ee.tranche_number,
       ee.trigger_event,
       ee.released_at,
       ee.created_at,
       ci.id   AS campaign_influencer_id,
       inf.instagram_handle,
       u.name  AS influencer_name
     FROM escrow_entries ee
     JOIN campaign_influencers ci ON ci.id  = ee.campaign_influencer_id
     JOIN campaign_sets        cs ON cs.id  = ci.set_id
     JOIN influencers          inf ON inf.id = ci.influencer_id
     JOIN users                u   ON u.id  = inf.user_id
     WHERE cs.campaign_id = $1
     ORDER BY inf.instagram_handle ASC, ee.tranche_number ASC`,
    [campaign_id]
  );

  // Resolve GST on the Protection Fee. Persisted on rows created since M076;
  // for older rows fee_gst_amount is NULL → derive from the current gst_pct.
  const gstPct = await taxService.getGstPct();
  const resolveFeeGst = (e) =>
    e.fee_gst_amount != null
      ? _round2(e.fee_gst_amount)
      : _round2((parseFloat(e.escrow_fee_amount) || 0) * gstPct / 100);

  // Compute summary totals
  let totalLocked   = 0;
  let totalReleased = 0;
  let totalQueued   = 0;
  let totalFee      = 0;
  let totalFeeGst   = 0;

  for (const e of escrowEntries) {
    const amt = parseFloat(e.amount);
    if (e.status === 'released') totalReleased += amt;
    else if (e.status === 'locked') totalLocked += amt;
    else if (e.status === 'queued') totalQueued += amt;
    totalFee    += parseFloat(e.escrow_fee_amount) || 0;
    totalFeeGst += resolveFeeGst(e);
  }

  // Group entries by influencer for per-influencer breakdown
  const byInfluencer = {};
  for (const e of escrowEntries) {
    const key = e.campaign_influencer_id;
    if (!byInfluencer[key]) {
      byInfluencer[key] = {
        campaign_influencer_id: key,
        instagram_handle: e.instagram_handle,
        influencer_name: e.influencer_name,
        tranches: [],
      };
    }
    byInfluencer[key].tranches.push({
      id: e.id,
      tranche_number: e.tranche_number,
      trigger_event: e.trigger_event,
      amount: e.amount,
      escrow_fee_amount: e.escrow_fee_amount != null ? _round2(e.escrow_fee_amount) : 0,
      fee_gst_amount: resolveFeeGst(e),
      net_to_influencer: e.net_to_influencer,
      status: e.status,
      released_at: e.released_at,
      created_at: e.created_at,
    });
  }

  return success(res, {
    campaign: {
      id:     campaign.id,
      name:   campaign.name,
      status: campaign.status,
      goals,                                          // ['engagement'] / ['conversion'] / ['hybrid'] / mix
      goal_summary: isConversionOnly
        ? 'conversion'
        : (hasFeeBearingGoal && goals.includes('conversion') ? 'mixed' : (goals[0] || 'engagement')),
      has_tranches: hasFeeBearingGoal,                // false → UI should not show tranche schedule
    },
    entries: escrowEntries,
    influencer_breakdown: Object.values(byInfluencer),
    summary: {
      total_locked:   totalLocked,
      total_released: totalReleased,
      total_queued:   totalQueued,
      total:          totalLocked + totalReleased + totalQueued,
      total_fee:      _round2(totalFee),
      total_fee_gst:  _round2(totalFeeGst),
    },
  });
});

module.exports = { getBrandEscrow, getCampaignEscrow };
