'use strict';

/**
 * review.controller.js — Wave 5 restaurant reviews + ratings.
 *
 * Endpoints (mounted under /follower in follower.routes.js):
 *   POST /follower/reviews              createReview      (follower auth)
 *   GET  /follower/reviews?brand_id=    listBrandReviews  (auth optional)
 *   GET  /follower/me/reviewable        getReviewable     (follower auth)
 *
 * A review requires a qualifying completed follower_transactions row for
 * that brand authored by the same follower (you can only review where you
 * actually transacted). is_creator_review is set when the reviewing user
 * also has an influencers profile. campaign_influencer_id is copied from
 * the qualifying transaction so "creator-trusted" surfacing can also count
 * creator-influenced reviews.
 */

const db           = require('../config/db');
const { success }  = require('../utils/response');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function followerIdForUser(userId) {
  const { rows } = await db.query(`SELECT id FROM followers WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

async function influencerIdForUser(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /follower/reviews
// Body: { brand_id, transaction_id?, rating (1-5), review_text?, photos? }
// ─────────────────────────────────────────────────────────────────────────────

const createReview = asyncHandler(async (req, res) => {
  const followerId = await followerIdForUser(req.user.sub);
  if (!followerId) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { brand_id, transaction_id, rating, review_text, photos } = req.body || {};

  if (!brand_id) throw new AppError('VALIDATION_ERROR', 'brand_id is required', 422, 'brand_id');
  const r = parseInt(rating, 10);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    throw new AppError('VALIDATION_ERROR', 'rating must be an integer 1–5', 422, 'rating');
  }

  // Find a qualifying transaction: a completed tx for this brand by this
  // follower. If transaction_id is supplied, validate it; else pick the
  // most recent completed one. This both authorizes the review and gives
  // us the attribution trail (campaign_influencer_id).
  let txRow;
  if (transaction_id) {
    const { rows } = await db.query(
      `SELECT id, campaign_influencer_id FROM follower_transactions
        WHERE id = $1 AND follower_id = $2 AND brand_id = $3`,
      [transaction_id, followerId, brand_id]
    );
    txRow = rows[0];
    if (!txRow) throw new AppError('VALIDATION_ERROR', 'transaction does not belong to you for this brand', 422, 'transaction_id');
  } else {
    const { rows } = await db.query(
      `SELECT id, campaign_influencer_id FROM follower_transactions
        WHERE follower_id = $1 AND brand_id = $2 AND status = 'completed'
        ORDER BY created_at DESC LIMIT 1`,
      [followerId, brand_id]
    );
    txRow = rows[0];
    if (!txRow) throw new AppError('FORBIDDEN', 'You can only review a place you have visited or ordered from', 403);
  }

  const influencerId = await influencerIdForUser(req.user.sub);

  try {
    const { rows } = await db.query(
      `INSERT INTO restaurant_reviews
         (brand_id, follower_id, influencer_id, transaction_id,
          campaign_influencer_id, rating, review_text, photos, is_creator_review)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        brand_id, followerId, influencerId || null, txRow.id,
        txRow.campaign_influencer_id || null, r,
        review_text || null,
        JSON.stringify(Array.isArray(photos) ? photos : []),
        !!influencerId,
      ]
    );
    return success(res, { review: rows[0] }, 201);
  } catch (e) {
    if (e.code === '23505') {
      throw new AppError('CONFLICT', 'You have already reviewed this visit', 409);
    }
    throw e;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /follower/reviews?brand_id=&creator_only=&page=
// Returns { summary: {avg_rating, review_count, distribution}, reviews: [] }
// ─────────────────────────────────────────────────────────────────────────────

const listBrandReviews = asyncHandler(async (req, res) => {
  const { brand_id, creator_only, page = '1', limit = '20' } = req.query;
  if (!brand_id) throw new AppError('VALIDATION_ERROR', 'brand_id is required', 422, 'brand_id');

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const offset   = (pageNum - 1) * limitNum;

  // Summary across ALL published reviews (independent of the creator filter
  // so the headline rating never changes when the user toggles the filter).
  const { rows: sumRows } = await db.query(
    `SELECT
       COUNT(*)::int AS review_count,
       COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS avg_rating,
       COUNT(*) FILTER (WHERE rating = 5)::int AS r5,
       COUNT(*) FILTER (WHERE rating = 4)::int AS r4,
       COUNT(*) FILTER (WHERE rating = 3)::int AS r3,
       COUNT(*) FILTER (WHERE rating = 2)::int AS r2,
       COUNT(*) FILTER (WHERE rating = 1)::int AS r1,
       COUNT(*) FILTER (WHERE is_creator_review OR campaign_influencer_id IS NOT NULL)::int AS creator_count
     FROM restaurant_reviews
     WHERE brand_id = $1 AND status = 'published'`,
    [brand_id]
  );
  const s = sumRows[0] || {};

  const creatorFilter = (creator_only === 'true' || creator_only === '1')
    ? ` AND (rr.is_creator_review OR rr.campaign_influencer_id IS NOT NULL)`
    : '';

  const { rows: reviews } = await db.query(
    `SELECT rr.id, rr.rating, rr.review_text, rr.photos, rr.is_creator_review,
            rr.campaign_influencer_id, rr.created_at,
            COALESCE(ui.name, uf.name) AS author_name,
            i.instagram_handle        AS author_handle,
            (rr.is_creator_review OR rr.campaign_influencer_id IS NOT NULL) AS creator_trusted
       FROM restaurant_reviews rr
       LEFT JOIN followers   f  ON f.id  = rr.follower_id
       LEFT JOIN users       uf ON uf.id = f.user_id
       LEFT JOIN influencers i  ON i.id  = rr.influencer_id
       LEFT JOIN users       ui ON ui.id = i.user_id
      WHERE rr.brand_id = $1 AND rr.status = 'published' ${creatorFilter}
      ORDER BY rr.created_at DESC
      LIMIT $2 OFFSET $3`,
    [brand_id, limitNum, offset]
  );

  return success(res, {
    summary: {
      avg_rating:   Number(s.avg_rating) || 0,
      review_count: s.review_count || 0,
      creator_count: s.creator_count || 0,
      distribution: { 5: s.r5 || 0, 4: s.r4 || 0, 3: s.r3 || 0, 2: s.r2 || 0, 1: s.r1 || 0 },
    },
    reviews,
  }, 200, { page: pageNum, limit: limitNum });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /follower/me/reviewable
// Completed transactions by this follower with no review yet — drives the
// post-visit "Rate your visit" prompt in the app.
// ─────────────────────────────────────────────────────────────────────────────

const getReviewable = asyncHandler(async (req, res) => {
  const followerId = await followerIdForUser(req.user.sub);
  if (!followerId) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { rows } = await db.query(
    `SELECT ft.id AS transaction_id, ft.brand_id, ft.created_at,
            b.business_name, b.category
       FROM follower_transactions ft
       JOIN brands b ON b.id = ft.brand_id
      WHERE ft.follower_id = $1
        AND ft.status = 'completed'
        // Docs/THE_CUT.md pass 2 — was scoped to restaurants only. Reviews SURVIVE the
        // cut (founder kept them); restaurants do not. Left as it was, this list could
        // only ever return nothing. Widened to any completed purchase, which is what a
        // fashion shopper needs.
        AND NOT EXISTS (
          SELECT 1 FROM restaurant_reviews rr WHERE rr.transaction_id = ft.id
        )
      ORDER BY ft.created_at DESC
      LIMIT 10`,
    [followerId]
  );

  return success(res, { reviewable: rows });
});

module.exports = { createReview, listBrandReviews, getReviewable };
