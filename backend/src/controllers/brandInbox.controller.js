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
// Stage 0 — the needs-you tree, counted once on the server so the brand's screen and
// the creator's screen can never disagree. Contract: features/stage-0-clear-the-decks.
const collabCounts = require('../services/collabCounts.service');

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
          WHERE c.brand_id = $1 AND n.outcome IS NULL AND n.current_turn = 'brand') AS pending_negotiations,

       -- Item 12: "review the content" and "confirm it is live" (§24), from collab_content. The
       -- key name stays pending_reviews so a phone that has not updated keeps working.
       (SELECT COUNT(*)::int FROM campaign_influencers ci
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
          WHERE c.brand_id = $1 AND ${require('../services/contentFlow.service').CONTENT_MOVE_SQL('ci')} = 'review_content') AS pending_reviews,
       (SELECT COUNT(*)::int FROM campaign_influencers ci
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
          WHERE c.brand_id = $1 AND ${require('../services/contentFlow.service').CONTENT_MOVE_SQL('ci')} = 'confirm_live') AS pending_live_confirms,

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
            AND con.pdf_generation_error IS NOT NULL) AS pdf_failed,

       (SELECT COUNT(*)::int FROM campaign_influencers ci
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
          WHERE c.brand_id = $1 AND ci.status = 'applied') AS pending_applications`,
    [brandId]
  );

  // Stage 0 — the needs-you tree, EXTENDED onto this endpoint rather than added as a
  // second one. navigation.html: "One summary endpoint, extended — the new sources are
  // added there rather than in five more calls." Two answers to the same question is
  // how two badges start disagreeing.
  //
  // Every key above is returned unchanged, at the same name, in the same envelope: a
  // phone that has not updated ignores `needs_you` and behaves exactly as it does today
  // (check S8). The tree is additive, never a replacement.
  const needsYou = await collabCounts.forBrand(brandId);

  return success(res, { summary: rows[0], needs_you: needsYou });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/applications
// Open-group applications waiting on brand approval. Returned with the
// influencer's headline analytics so the brand can decide without leaving
// the inbox. Tap-to-view-full-profile still works via the existing
// /influencers/:id endpoint.
// ─────────────────────────────────────────────────────────────────────────────
const listApplications = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdOrThrow(req.user.sub);

  const { rows } = await db.query(
    `SELECT ci.id                AS campaign_influencer_id,
            ci.influencer_id,
            ci.influencer_budget,
            ci.updated_at        AS applied_at,
            cs.id                AS set_id,
            cs.name              AS set_name,
            cs.goal,
            cs.max_cap,
            cs.per_influencer_budget,
            c.id                 AS campaign_id,
            c.name               AS campaign_name,
            inf.id               AS influencer_profile_id,
            inf.instagram_handle,
            inf.full_name        AS influencer_name,
            inf.followers_count,
            inf.engagement_rate,
            inf.tier,
            inf.city,
            inf.niche,
            inf.profile_image_url
       FROM campaign_influencers ci
       JOIN campaign_sets cs        ON cs.id = ci.set_id
       JOIN campaigns c             ON c.id  = cs.campaign_id
       JOIN influencers inf         ON inf.id = ci.influencer_id
      WHERE c.brand_id = $1 AND ci.status = 'applied'
      ORDER BY ci.updated_at DESC`,
    [brandId]
  );

  return success(res, { applications: rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/brands/me/failures
// Unified list of two failure kinds the brand can retry from the inbox UI:
//   - contract_create_failed: campaign_influencer accepted, but auto-contract
//     row was never created (retry via POST /contracts/by-ci/:ciId/retry)
//   - pdf_failed: contract exists but PDF generation errored (retry via
//     POST /contracts/:id/regenerate-pdf)
// Each row carries `kind`, a stable `id` to call retry against, and the
// failure message so the UI can show why it failed.
// ─────────────────────────────────────────────────────────────────────────────
const listFailures = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdOrThrow(req.user.sub);

  const { rows: createFails } = await db.query(
    `SELECT 'contract_create_failed' AS kind,
            ci.id                AS id,
            ci.contract_create_error AS error_message,
            ci.updated_at        AS occurred_at,
            cs.name              AS set_name,
            c.id                 AS campaign_id,
            c.name               AS campaign_name,
            inf.instagram_handle AS influencer_handle,
            inf.full_name        AS influencer_name
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c     ON c.id  = cs.campaign_id
       JOIN influencers inf ON inf.id = ci.influencer_id
      WHERE c.brand_id = $1
        AND ci.contract_create_error IS NOT NULL
        AND ci.status = 'accepted'
      ORDER BY ci.updated_at DESC`,
    [brandId]
  );

  const { rows: pdfFails } = await db.query(
    `SELECT 'pdf_failed' AS kind,
            con.id               AS id,
            con.pdf_generation_error AS error_message,
            con.pdf_generated_at AS occurred_at,
            cs.name              AS set_name,
            c.id                 AS campaign_id,
            c.name               AS campaign_name,
            inf.instagram_handle AS influencer_handle,
            inf.full_name        AS influencer_name
       FROM contracts con
       JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c     ON c.id  = cs.campaign_id
       JOIN influencers inf ON inf.id = ci.influencer_id
      WHERE c.brand_id = $1
        AND con.pdf_generation_error IS NOT NULL
      ORDER BY con.pdf_generated_at DESC NULLS LAST`,
    [brandId]
  );

  const failures = [...createFails, ...pdfFails].sort((a, b) => {
    const at = new Date(a.occurred_at || 0).getTime();
    const bt = new Date(b.occurred_at || 0).getTime();
    return bt - at;
  });

  return success(res, { failures });
});

module.exports = { listNegotiations, listDeliverables, getSummary, listFailures, listApplications };
