'use strict';

/**
 * returns.controller.js — Fashion-1 customer returns workflow.
 *
 * State machine (migration 048):
 *   requested → approved → received → refunded
 *              ↘ rejected
 *
 * Endpoints split by audience:
 *   Customer side (mounted under /follower/returns):
 *     POST /follower/returns                  — initiate
 *     GET  /follower/returns                  — list mine
 *     GET  /follower/returns/:id              — one
 *
 *   Admin side (mounted under /admin/returns; gated by requireAdminRole):
 *     GET   /admin/returns?status=requested   — admin queue
 *     POST  /admin/returns/:id/approve        — admin approves with refund_amount
 *     POST  /admin/returns/:id/reject         — admin rejects with admin_notes
 *     POST  /admin/returns/:id/mark-refunded  — admin records refund issued
 *
 * Notifications fire at each state transition (customer + admin where
 * relevant) via notification.service.send.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');

// ── Customer side ────────────────────────────────────────────────────────────

/**
 * POST /follower/returns
 * Body: { transaction_id, product_id?, variant_id?, reason, reason_text? }
 *
 * Validates:
 *   · Customer owns the transaction (follower.user_id matches)
 *   · Transaction is within the product's return_policy_days window
 *   · No existing 'requested'/'approved'/'received' return for the same item
 */
const initiateReturn = asyncHandler(async (req, res) => {
  const { transaction_id, product_id, variant_id, reason, reason_text } = req.body;

  if (!transaction_id || !reason) {
    throw new AppError('VALIDATION_ERROR', 'transaction_id and reason are required', 422);
  }

  // Validate transaction ownership + fetch context for return-window check
  const { rows: txRows } = await db.query(
    `SELECT ft.id, ft.follower_id, ft.product_id AS tx_product_id, ft.created_at,
            ft.transaction_type, ft.net_amount,
            f.user_id AS follower_user_id,
            bp.return_policy_days,
            fo.id AS order_id
       FROM follower_transactions ft
       JOIN followers f ON f.id = ft.follower_id
       LEFT JOIN brand_products bp ON bp.id = COALESCE($2, ft.product_id)
       LEFT JOIN follower_orders fo ON fo.transaction_id = ft.id
      WHERE ft.id = $1`,
    [transaction_id, product_id || null]
  );
  const tx = txRows[0];
  if (!tx) throw new AppError('NOT_FOUND', 'Transaction not found', 404);
  if (tx.follower_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'Not your transaction', 403);
  }

  // Return-window check: created_at + return_policy_days >= now
  const returnDays = tx.return_policy_days || 0;
  if (returnDays === 0) {
    throw new AppError('VALIDATION_ERROR', 'This product is not eligible for returns', 422);
  }
  const windowEnds = new Date(new Date(tx.created_at).getTime() + returnDays * 24 * 60 * 60 * 1000);
  if (Date.now() > windowEnds.getTime()) {
    throw new AppError('VALIDATION_ERROR', `Return window has closed (${returnDays} days from purchase)`, 422);
  }

  // No active return already
  const { rows: existing } = await db.query(
    `SELECT id, return_status FROM follower_returns
      WHERE transaction_id = $1 AND product_id IS NOT DISTINCT FROM $2 AND variant_id IS NOT DISTINCT FROM $3
        AND return_status IN ('requested','approved','received')
      LIMIT 1`,
    [transaction_id, product_id || tx.tx_product_id || null, variant_id || null]
  );
  if (existing[0]) {
    throw new AppError('CONFLICT', `An active return already exists for this item (status: ${existing[0].return_status})`, 409);
  }

  const { rows } = await db.query(
    `INSERT INTO follower_returns
       (transaction_id, order_id, product_id, variant_id, reason, reason_text)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, return_status, created_at`,
    [
      transaction_id,
      tx.order_id || null,
      product_id || tx.tx_product_id || null,
      variant_id || null,
      reason,
      reason_text || null,
    ]
  );
  const returnRow = rows[0];

  // Notify admins — fire-and-forget. We send to any admin reviewer; for V1
  // we just persist the notification and let the admin web poll. (Real
  // multi-admin fanout is a separate concern.)
  notifyAdminsOfReturnRequest(returnRow.id).catch(e =>
    console.error('[NOTIFY] return.requested admin notify failed:', e.message)
  );

  return success(res, { id: returnRow.id, return_status: returnRow.return_status, created_at: returnRow.created_at }, 201);
});

/**
 * GET /follower/returns — list returns belonging to the logged-in follower
 */
const listMyReturns = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT fr.id, fr.transaction_id, fr.product_id, fr.variant_id, fr.reason, fr.reason_text,
            fr.return_status, fr.refund_amount, fr.admin_notes,
            fr.reviewed_at, fr.refunded_at, fr.created_at,
            bp.name AS product_name, bp.image_url AS product_image_url,
            b.business_name AS brand_name
       FROM follower_returns fr
       JOIN follower_transactions ft ON ft.id = fr.transaction_id
       JOIN followers f ON f.id = ft.follower_id
       LEFT JOIN brand_products bp ON bp.id = fr.product_id
       JOIN brands b ON b.id = ft.brand_id
      WHERE f.user_id = $1
      ORDER BY fr.created_at DESC`,
    [req.user.sub]
  );
  return success(res, { returns: rows });
});

/**
 * GET /follower/returns/:id — fetch one
 */
const getMyReturn = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT fr.*, bp.name AS product_name, bp.image_url AS product_image_url,
            b.business_name AS brand_name
       FROM follower_returns fr
       JOIN follower_transactions ft ON ft.id = fr.transaction_id
       JOIN followers f ON f.id = ft.follower_id
       LEFT JOIN brand_products bp ON bp.id = fr.product_id
       JOIN brands b ON b.id = ft.brand_id
      WHERE fr.id = $1 AND f.user_id = $2`,
    [req.params.id, req.user.sub]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Return not found', 404);
  return success(res, { return: rows[0] });
});

// ── Admin side ───────────────────────────────────────────────────────────────

/**
 * GET /admin/returns?status=requested — admin queue
 * Defaults to 'requested' when no status filter passed.
 */
const adminListReturns = asyncHandler(async (req, res) => {
  const status = req.query.status || 'requested';
  const { rows } = await db.query(
    `SELECT fr.id, fr.transaction_id, fr.product_id, fr.variant_id, fr.reason, fr.reason_text,
            fr.return_status, fr.refund_amount, fr.admin_notes,
            fr.created_at, fr.reviewed_at, fr.refunded_at,
            bp.name AS product_name, bp.image_url AS product_image_url,
            pv.size AS variant_size, pv.color AS variant_color,
            b.business_name AS brand_name, b.id AS brand_id,
            u.name AS follower_name, u.phone AS follower_phone,
            ft.net_amount AS transaction_amount
       FROM follower_returns fr
       JOIN follower_transactions ft ON ft.id = fr.transaction_id
       JOIN brands b ON b.id = ft.brand_id
       JOIN followers f ON f.id = ft.follower_id
       JOIN users u ON u.id = f.user_id
       LEFT JOIN brand_products bp ON bp.id = fr.product_id
       LEFT JOIN product_variants pv ON pv.id = fr.variant_id
      WHERE fr.return_status = $1
      ORDER BY fr.created_at ASC`,
    [status]
  );
  return success(res, { returns: rows });
});

/**
 * POST /admin/returns/:id/approve
 * Body: { refund_amount, admin_notes? }
 */
const adminApproveReturn = asyncHandler(async (req, res) => {
  const { refund_amount, admin_notes } = req.body;
  if (!Number.isFinite(Number(refund_amount)) || Number(refund_amount) < 0) {
    throw new AppError('VALIDATION_ERROR', 'refund_amount must be a non-negative number', 422);
  }

  const { rows } = await db.query(
    `UPDATE follower_returns
        SET return_status = 'approved',
            refund_amount = $1,
            admin_notes = $2,
            reviewed_by_admin_id = $3,
            reviewed_at = NOW()
      WHERE id = $4 AND return_status = 'requested'
      RETURNING id, transaction_id, product_id, return_status, refund_amount`,
    [refund_amount, admin_notes || null, req.user.sub, req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Return not found or not in requestable state', 404);

  notifyFollowerOfReturnDecision(rows[0].id, 'approved').catch(e =>
    console.error('[NOTIFY] return.approved customer notify failed:', e.message)
  );
  return success(res, rows[0]);
});

/**
 * POST /admin/returns/:id/reject
 * Body: { admin_notes }
 */
const adminRejectReturn = asyncHandler(async (req, res) => {
  const { admin_notes } = req.body;
  if (!admin_notes || !admin_notes.trim()) {
    throw new AppError('VALIDATION_ERROR', 'admin_notes is required when rejecting', 422);
  }

  const { rows } = await db.query(
    `UPDATE follower_returns
        SET return_status = 'rejected',
            admin_notes = $1,
            reviewed_by_admin_id = $2,
            reviewed_at = NOW()
      WHERE id = $3 AND return_status = 'requested'
      RETURNING id, return_status`,
    [admin_notes, req.user.sub, req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Return not found or not in requestable state', 404);

  notifyFollowerOfReturnDecision(rows[0].id, 'rejected').catch(e =>
    console.error('[NOTIFY] return.rejected customer notify failed:', e.message)
  );
  return success(res, rows[0]);
});

/**
 * POST /admin/returns/:id/mark-refunded
 * Body: { razorpay_refund_id? }
 */
const adminMarkRefunded = asyncHandler(async (req, res) => {
  const { razorpay_refund_id } = req.body;
  const { rows } = await db.query(
    `UPDATE follower_returns
        SET return_status = 'refunded',
            refunded_at = NOW(),
            razorpay_refund_id = $1
      WHERE id = $2 AND return_status IN ('approved','received')
      RETURNING id, return_status, refunded_at`,
    [razorpay_refund_id || null, req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Return not found or not in refundable state', 404);

  // Reverse the influencer's HELD (unconfirmed) commission for this transaction — a
  // refunded order must never pay out (founder rule: held till window closes, cancelled
  // on return). The commission-confirm cron already SKIPS refunded returns; this cleans
  // up the influencer's pending_balance/total_earned so their earnings read true. If the
  // commission was somehow already confirmed (paid to wallet), leave it — clawing back a
  // withdrawn balance is out of scope (the cron skip prevents this in practice).
  const { rows: txRows } = await db.query(
    `SELECT ft.id, ft.influencer_commission, ft.commission_confirmed_at, ci.influencer_id
       FROM follower_returns fr
       JOIN follower_transactions ft ON ft.id = fr.transaction_id
       LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
      WHERE fr.id = $1`,
    [rows[0].id]
  );
  const t = txRows[0];
  if (t) {
    if (t.influencer_id && !t.commission_confirmed_at && Number(t.influencer_commission) > 0) {
      await db.query(
        `UPDATE influencers
            SET pending_balance = GREATEST(0, pending_balance - $1),
                total_earned    = GREATEST(0, total_earned    - $1)
          WHERE id = $2`,
        [Number(t.influencer_commission), t.influencer_id]
      );
    }
    await db.query(`UPDATE follower_transactions SET status = 'refunded' WHERE id = $1`, [t.id]);
  }

  notifyFollowerOfReturnDecision(rows[0].id, 'refunded').catch(e =>
    console.error('[NOTIFY] return.refunded customer notify failed:', e.message)
  );
  return success(res, rows[0]);
});

// ── Notification helpers ─────────────────────────────────────────────────────

async function notifyAdminsOfReturnRequest(returnId) {
  // Fetch admin users; in V1 we notify all admin:reviewer + admin:superadmin.
  // Returns from non-fashion brands stay quiet — only fashion enables returns
  // today, but the gating logic doesn't constrain by category.
  const { rows: admins } = await db.query(
    `SELECT id FROM users WHERE role IN ('admin') AND status = 'approved'`
  );
  const { rows: ctx } = await db.query(
    `SELECT b.business_name, bp.name AS product_name
       FROM follower_returns fr
       JOIN follower_transactions ft ON ft.id = fr.transaction_id
       JOIN brands b ON b.id = ft.brand_id
       LEFT JOIN brand_products bp ON bp.id = fr.product_id
      WHERE fr.id = $1`,
    [returnId]
  );
  const c = ctx[0] || {};
  for (const a of admins) {
    await notificationService.send({
      userId: a.id,
      type: 'return.requested',
      title: 'New return request',
      body: `${c.business_name || 'A brand'} — ${c.product_name || 'item'}: customer requested return`,
      data: { screen: 'AdminReturns', return_id: returnId },
    }).catch(() => {});
  }
}

async function notifyFollowerOfReturnDecision(returnId, decision) {
  const { rows } = await db.query(
    `SELECT u.id AS user_id, b.business_name, bp.name AS product_name,
            fr.refund_amount, fr.admin_notes
       FROM follower_returns fr
       JOIN follower_transactions ft ON ft.id = fr.transaction_id
       JOIN followers f ON f.id = ft.follower_id
       JOIN users u ON u.id = f.user_id
       JOIN brands b ON b.id = ft.brand_id
       LEFT JOIN brand_products bp ON bp.id = fr.product_id
      WHERE fr.id = $1`,
    [returnId]
  );
  if (!rows[0]) return;
  const r = rows[0];
  const titles = {
    approved: 'Return approved',
    rejected: 'Return request declined',
    refunded: 'Refund issued',
  };
  const bodies = {
    approved: `Your return for ${r.product_name || 'this item'} is approved. Refund: ₹${r.refund_amount || 0}`,
    rejected: `Your return for ${r.product_name || 'this item'} was declined. ${r.admin_notes || ''}`.trim(),
    refunded: `₹${r.refund_amount || 0} refunded to your original payment method for ${r.product_name || 'this item'}`,
  };
  await notificationService.send({
    userId: r.user_id,
    type: `return.${decision}`,
    title: titles[decision],
    body: bodies[decision],
    data: { screen: 'MyReturns', return_id: returnId },
  });
}

module.exports = {
  initiateReturn,
  listMyReturns,
  getMyReturn,
  adminListReturns,
  adminApproveReturn,
  adminRejectReturn,
  adminMarkRefunded,
};
