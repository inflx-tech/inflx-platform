'use strict';

/**
 * brandInbox.controller.js
 *
 * Brand-side inbox endpoints for items waiting on the brand's action.
 * Used by the brand-web dashboard to surface counts + lists of:
 *   - negotiations awaiting brand response
 *   - submitted deliverables awaiting brand review
 *   - contracts awaiting brand countersign
 *   - campaign_influencers whose contract auto-create silently failed
 *
 * Single source of "what does the brand owe right now?".
 */

const db           = require('../config/db');
const { success }  = require('../utils/response');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function getBrandIdOrThrow(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0].id;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/negotiations?status=awaiting_brand
// ─────────────────────────────────────────────────────────────────────────────
const listNegotiations = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdOrThrow(req.user.sub);
  const status  = req.query.status || 'awaiting_brand';

  const ALLOWED = ['awaiting_brand', 'awaiting_influencer', 'agreed', 'walked_away', 'all'];
  if (!ALLOWED.includes(status)) {
    throw new AppError('VALIDATION_ERROR', `status must be one of: ${ALLOWED.join(', ')}`, 422, 'status');
  }

  const where = [`c.brand_id = $1`];
  const params = [brandId];
  if (status !== 'all') {
    params.push(status);
    where.push(`n.status = $${params.length}`);
  }

  const { rows } = await db.query(
    `SELECT n.id,
            n.status,
            n.current_turn,
            n.created_at,
            n.expires_at,
            ci.id                AS campaign_influencer_id,
            ci.influencer_id,
            ci.influencer_budget,
            cs.name              AS set_name,
            c.id                 AS campaign_id,
            c.name               AS campaign_name,
            inf.instagram_handle AS influencer_handle,
            inf.full_name        AS influencer_name,
            (SELECT proposed_fee FROM negotiation_turns
             WHERE negotiation_id = n.id ORDER BY created_at DESC LIMIT 1) AS last_proposed_fee,
            (SELECT sent_by      FROM negotiation_turns
             WHERE negotiation_id = n.id ORDER BY created_at DESC LIMIT 1) AS last_turn_by
     FROM   negotiations n
     JOIN   campaign_influencers ci ON ci.id = n.campaign_influencer_id
     JOIN   campaign_sets cs        ON cs.id = ci.set_id
     JOIN   campaigns c             ON c.id  = cs.campaign_id
     JOIN   influencers inf         ON inf.id = ci.influencer_id
     WHERE  ${where.join(' AND ')}
     ORDER  BY n.created_at DESC`,
    params
  );

  return success(res, { negotiations: rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/deliverables?status=submitted
// ─────────────────────────────────────────────────────────────────────────────
const listDeliverables = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdOrThrow(req.user.sub);
  const status  = req.query.status || 'submitted';

  const ALLOWED = ['submitted', 'under_review', 'approved', 'revision_requested', 'live', 'pending', 'all'];
  if (!ALLOWED.includes(status)) {
    throw new AppError('VALIDATION_ERROR', `status must be one of: ${ALLOWED.join(', ')}`, 422, 'status');
  }

  const where = [`c.brand_id = $1`];
  const params = [brandId];
  if (status !== 'all') {
    if (status === 'submitted') {
      // Treat 'submitted' and 'under_review' as the brand's review queue
      where.push(`d.status IN ('submitted', 'under_review')`);
    } else {
      params.push(status);
      where.push(`d.status = $${params.length}`);
    }
  }

  const { rows } = await db.query(
    `SELECT d.id,
            d.type,
            d.status,
            d.submitted_at,
            d.submitted_url,
            d.live_url,
            d.media_key,
            d.media_type,
            d.notes_to_brand,
            d.revision_count,
            d.revision_limit,
            ci.id                AS campaign_influencer_id,
            cs.name              AS set_name,
            c.id                 AS campaign_id,
            c.name               AS campaign_name,
            inf.instagram_handle AS influencer_handle
     FROM   deliverables d
     JOIN   campaign_influencers ci ON ci.id = d.campaign_influencer_id
     JOIN   campaign_sets cs        ON cs.id = ci.set_id
     JOIN   campaigns c             ON c.id  = cs.campaign_id
     JOIN   influencers inf         ON inf.id = ci.influencer_id
     WHERE  ${where.join(' AND ')}
     ORDER  BY d.submitted_at DESC NULLS LAST, d.id DESC`,
    params
  );

  return success(res, { deliverables: rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/inbox-summary
// One round-trip; powers the dashboard nav badge counts.
// ─────────────────────────────────────────────────────────────────────────────
const getSummary = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdOrThrow(req.user.sub);

  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM negotiations n
          JOIN campaign_influencers ci ON ci.id = n.campaign_influencer_id
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
          WHERE c.brand_id = $1 AND n.status = 'awaiting_brand') AS pending_negotiations,

       (SELECT COUNT(*)::int FROM deliverables d
          JOIN campaign_influencers ci ON ci.id = d.campaign_influencer_id
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
          WHERE c.brand_id = $1 AND d.status IN ('submitted', 'under_review')) AS pending_reviews,

       (SELECT COUNT(*)::int FROM contracts con
          JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
          WHERE c.brand_id = $1 AND con.status = 'pending_brand') AS pending_signatures,

       (SELECT COUNT(*)::int FROM campaign_influencers ci
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
          WHERE c.brand_id = $1
            AND ci.contract_create_error IS NOT NULL
            AND ci.status IN ('accepted')) AS contracts_failed,

       (SELECT COUNT(*)::int FROM contracts con
          JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
          WHERE c.brand_id = $1
            AND con.pdf_generation_error IS NOT NULL) AS pdf_failed`,
    [brandId]
  );

  return success(res, { summary: rows[0] });
});

module.exports = { listNegotiations, listDeliverables, getSummary };
