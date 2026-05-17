'use strict';

/**
 * brandBookings.controller.js — Wave 2 BookingsInbox API.
 *
 * Brand-facing endpoints to list incoming follower_bookings with creator
 * attribution, and to confirm or reject a booking.
 *
 * Routes mounted on /brands/me/bookings in brand.routes.js. All endpoints
 * require role=brand. The brand_status column is NULL for existing rows;
 * the UI treats NULL as 'confirmed' (see migration 052 column comment).
 *
 * Stat tiles surfaced by GET /brands/me/bookings:
 *   - pending      → brand_status = 'pending'
 *   - today        → booking_date = CURRENT_DATE OR pickup_date = CURRENT_DATE
 *   - upcoming     → booking_date > CURRENT_DATE OR pickup_date > CURRENT_DATE
 *   - revenue_7d   → SUM(ft.net_amount) over the last 7 days for completed
 *                    transactions tied to this brand
 */

const db           = require('../config/db');
const { success }  = require('../utils/response');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');

async function getBrandIdForUser(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/bookings
// Query: status=pending|today|upcoming|past|all  (default: all)
// Returns: { stats, bookings[] }
// ─────────────────────────────────────────────────────────────────────────────

const list = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdForUser(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { status = 'all', page = '1', limit = '50' } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset   = (pageNum - 1) * limitNum;

  // Tab filter — translated to SQL. The "effective_date" pattern unifies
  // table/slot/appointment bookings (booking_date) with date_range bookings
  // (pickup_date) so the inbox sorts correctly regardless of type.
  const conds = ['ft.brand_id = $1'];
  const params = [brandId];

  if (status === 'pending') {
    conds.push(`fb.brand_status = 'pending'`);
  } else if (status === 'today') {
    conds.push(`COALESCE(fb.booking_date, fb.pickup_date) = CURRENT_DATE`);
  } else if (status === 'upcoming') {
    conds.push(`COALESCE(fb.booking_date, fb.pickup_date) > CURRENT_DATE`);
  } else if (status === 'past') {
    conds.push(`COALESCE(fb.booking_date, fb.pickup_date) < CURRENT_DATE`);
  } else if (status === 'completed') {
    // booking_status enum value 'completed' is set when dining/service is
    // marked complete (cron or staff action). Independent of brand_status.
    conds.push(`fb.status = 'completed'`);
  } else if (status === 'cancelled') {
    // Includes both brand-rejected (reject endpoint flips booking_status
    // to 'cancelled' in the same transaction) and follower-side cancels.
    conds.push(`fb.status = 'cancelled'`);
  }
  // 'all' = no extra filter

  const where = conds.join(' AND ');

  // Bookings page — paginated list with creator attribution
  params.push(limitNum, offset);
  const { rows: bookings } = await db.query(
    `SELECT
       fb.id, fb.booking_type, fb.booking_date, fb.booking_time, fb.guest_count,
       fb.pickup_date, fb.return_date, fb.duration_days, fb.pickup_type,
       fb.stylist_id, fb.notes, fb.reference_code,
       fb.status        AS booking_status,
       fb.brand_status, fb.brand_confirmed_at, fb.brand_rejected_at, fb.brand_review_note,
       fb.advance_paid, fb.balance_due_at_venue, fb.created_at,
       ft.id            AS transaction_id,
       ft.net_amount, ft.gross_amount,
       ft.campaign_id, ft.set_id, ft.campaign_influencer_id,
       c.name           AS campaign_name,
       i.instagram_handle,
       u_i.name         AS influencer_name,
       u_f.name         AS follower_name,
       u_f.phone        AS follower_phone
     FROM follower_bookings fb
     JOIN follower_transactions ft ON ft.id = fb.transaction_id
     LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     LEFT JOIN influencers i          ON i.id  = ci.influencer_id
     LEFT JOIN users u_i              ON u_i.id = i.user_id
     LEFT JOIN campaigns c            ON c.id  = ft.campaign_id
     LEFT JOIN followers f            ON f.id  = ft.follower_id
     LEFT JOIN users u_f              ON u_f.id = f.user_id
     WHERE ${where}
     ORDER BY COALESCE(fb.booking_date, fb.pickup_date) ASC NULLS LAST,
              fb.booking_time ASC NULLS LAST,
              fb.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // Stats — independent of the tab filter so all tiles always reflect totals
  const { rows: statRows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE fb.brand_status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE COALESCE(fb.booking_date, fb.pickup_date) = CURRENT_DATE)::int AS today,
       COUNT(*) FILTER (WHERE COALESCE(fb.booking_date, fb.pickup_date) > CURRENT_DATE)::int AS upcoming,
       COALESCE(SUM(ft.net_amount) FILTER (
         WHERE ft.status = 'completed'
           AND ft.created_at >= now() - INTERVAL '7 days'
       ), 0)::numeric AS revenue_7d
     FROM follower_bookings fb
     JOIN follower_transactions ft ON ft.id = fb.transaction_id
     WHERE ft.brand_id = $1`,
    [brandId]
  );

  return success(res, {
    bookings,
    stats: statRows[0] || { pending: 0, today: 0, upcoming: 0, revenue_7d: 0 },
  }, 200, { page: pageNum, limit: limitNum });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper — load a booking and verify it belongs to this brand
// ─────────────────────────────────────────────────────────────────────────────

async function loadOwnedBooking(bookingId, userId) {
  const { rows } = await db.query(
    `SELECT fb.*, ft.brand_id, ft.follower_id, u_f.fcm_token AS follower_fcm,
            u_f.id AS follower_user_id, b.business_name
     FROM follower_bookings fb
     JOIN follower_transactions ft ON ft.id = fb.transaction_id
     JOIN brands b   ON b.id   = ft.brand_id
     JOIN followers f ON f.id   = ft.follower_id
     JOIN users   u_f ON u_f.id = f.user_id
     WHERE fb.id = $1 AND b.user_id = $2`,
    [bookingId, userId]
  );
  return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/bookings/:id/confirm
// Body: { note? }
// ─────────────────────────────────────────────────────────────────────────────

const confirm = asyncHandler(async (req, res) => {
  const { id }   = req.params;
  const { note } = req.body || {};

  const booking = await loadOwnedBooking(id, req.user.sub);
  if (!booking) throw new AppError('NOT_FOUND', 'Booking not found or access denied', 404);

  if (booking.brand_status === 'rejected') {
    throw new AppError('CONFLICT', 'Cannot confirm a rejected booking', 409);
  }

  const { rows } = await db.query(
    `UPDATE follower_bookings
        SET brand_status        = 'confirmed',
            brand_confirmed_at  = now(),
            brand_review_note   = COALESCE($2, brand_review_note)
      WHERE id = $1
      RETURNING *`,
    [id, note || null]
  );

  notificationService.send({
    userId: booking.follower_user_id,
    type: 'booking.confirmed_by_brand',
    title: `${booking.business_name} confirmed your booking`,
    body: note ? `Note from the venue: ${note}` : 'See you soon!',
    fcmToken: booking.follower_fcm,
  }).catch(e => console.error('[NOTIFY] booking confirm failed:', e.message));

  return success(res, { booking: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/bookings/:id/reject
// Body: { note? }
// Side effect: also flips booking_status → 'cancelled' and sets cancelled_at.
// Refund handling is out of scope for this PR — the brand-side reject is a
// signal to the follower; financial reversal lives in a separate workflow.
// ─────────────────────────────────────────────────────────────────────────────

const reject = asyncHandler(async (req, res) => {
  const { id }   = req.params;
  const { note } = req.body || {};

  const booking = await loadOwnedBooking(id, req.user.sub);
  if (!booking) throw new AppError('NOT_FOUND', 'Booking not found or access denied', 404);

  if (booking.brand_status === 'confirmed') {
    throw new AppError('CONFLICT', 'Cannot reject an already-confirmed booking — cancel via support if needed', 409);
  }

  const { rows } = await db.query(
    `UPDATE follower_bookings
        SET brand_status       = 'rejected',
            brand_rejected_at  = now(),
            brand_review_note  = COALESCE($2, brand_review_note),
            status             = 'cancelled',
            cancelled_at       = COALESCE(cancelled_at, now())
      WHERE id = $1
      RETURNING *`,
    [id, note || null]
  );

  notificationService.send({
    userId: booking.follower_user_id,
    type: 'booking.rejected_by_brand',
    title: `${booking.business_name} couldn't accept your booking`,
    body: note || 'Please try a different time or contact the venue.',
    fcmToken: booking.follower_fcm,
  }).catch(e => console.error('[NOTIFY] booking reject failed:', e.message));

  return success(res, { booking: rows[0] });
});

module.exports = { list, confirm, reject };
