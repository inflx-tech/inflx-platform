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

module.exports = { getBrandEscrow };
