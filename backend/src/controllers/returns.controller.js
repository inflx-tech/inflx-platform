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
 *   Brand side (READ-ONLY; mounted under /brands/me, requireRole('brand')):
 *     GET   /brands/me/returns?filter=open|closed  — returns for this brand's
 *           transactions. Visibility only — brands cannot action returns
 *           (admin owns approve/reject/refund). Join hinge:
 *           follower_returns.transaction_id → follower_transactions.brand_id.
 *
 * Notifications fire at each state transition (customer + admin where
 * relevant) via notification.service.send.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');
const { appendInfluencerLedger } = require('../services/ledger.service');
const shopperReturns = require('../services/shopperReturns.service');

const _round2 = (n) => parseFloat((parseFloat(n) || 0).toFixed(2));

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
            ft.transaction_type, ft.net_amount, ft.checkout_id, ft.return_window_ends_at,
            f.user_id AS follower_user_id,
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

  // shopper-walk-fixes (W11, W14; founder 4 Oct 2026): the return window is INFLX's — ONE platform
  // number — and no longer the product's own "return days" (0 on every product; nobody ever set it).
  //   · An order placed through a creator's post is returned ITEM BY ITEM, from My orders
  //     (POST /follower/orders/lines/:id/return); this older request is not its door.
  //   · An older sale (no parcel to deliver) keeps this request, inside the window stamped on it.
  if (tx.checkout_id) {
    throw new AppError('VALIDATION_ERROR', 'Return this item from My orders', 422);
  }
  if (!tx.return_window_ends_at || Date.now() > new Date(tx.return_window_ends_at).getTime()) {
    throw new AppError('VALIDATION_ERROR', 'The return window has closed', 422);
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

// ── Brand side (READ-ONLY) ───────────────────────────────────────────────────

/**
 * GET /brands/me/returns?filter=open|closed
 *
 * Lists returns that belong to the authenticated brand's transactions.
 * Brand visibility is read-only — brands SEE returns but do not action them
 * (admin owns approve/reject/refund). Customer PII is masked: we surface a
 * first name + masked phone tail only, never the raw phone.
 *
 * Join hinge (verified against schema 001 + 048):
 *   follower_returns.transaction_id → follower_transactions.id
 *   follower_transactions.brand_id  → brands.id (NOT NULL)
 *   brands.user_id                  → req.user.sub
 *
 * filter: 'open'   → return_status IN ('requested','approved','received')
 *         'closed' → return_status IN ('rejected','refunded')
 *         (default / anything else) → all
 */
const listBrandReturns = asyncHandler(async (req, res) => {
  const { rows: brandRows } = await db.query(
    `SELECT id FROM brands WHERE user_id = $1`,
    [req.user.sub]
  );
  const brandId = brandRows[0]?.id;
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const filter = req.query.filter;
  const conds = ['ft.brand_id = $1'];
  const params = [brandId];
  if (filter === 'open') {
    conds.push(`fr.return_status IN ('requested','approved','received')`);
  } else if (filter === 'closed') {
    conds.push(`fr.return_status IN ('rejected','refunded')`);
  }

  const { rows } = await db.query(
    `SELECT fr.id, fr.transaction_id, fr.product_id, fr.variant_id,
            fr.reason, fr.reason_text, fr.return_status, fr.refund_amount,
            fr.admin_notes, fr.created_at, fr.reviewed_at, fr.refunded_at,
            bp.name AS product_name, bp.image_url AS product_image_url,
            pv.size AS variant_size, pv.color AS variant_color,
            ft.net_amount AS transaction_amount,
            -- Customer PII masked: first name + last 4 of phone only
            split_part(u.name, ' ', 1) AS customer_first_name,
            CASE WHEN u.phone IS NOT NULL
                 THEN '••••' || RIGHT(u.phone, 4) ELSE NULL END AS customer_phone_masked
       FROM follower_returns fr
       JOIN follower_transactions ft ON ft.id = fr.transaction_id
       JOIN followers f ON f.id = ft.follower_id
       JOIN users u ON u.id = f.user_id
       LEFT JOIN brand_products bp ON bp.id = fr.product_id
       LEFT JOIN product_variants pv ON pv.id = fr.variant_id
      WHERE ${conds.join(' AND ')}
      ORDER BY fr.created_at DESC`,
    params
  );
  return success(res, { returns: rows });
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
            COALESCE(ol.name, bp.name) AS product_name, COALESCE(ol.image_url, bp.image_url) AS product_image_url,
            COALESCE(ol.size, pv.size) AS variant_size, COALESCE(ol.colour, pv.color) AS variant_color,
            b.business_name AS brand_name, b.id AS brand_id,
            u.name AS follower_name, u.phone AS follower_phone,
            -- W14: for an item of an order placed through a post, the amount is what was paid for THAT item
            COALESCE(ol.paid_total, ft.net_amount) AS transaction_amount,
            fr.order_line_id, fr.request_id, ol.qty AS line_qty, fo.payment_method,
            (SELECT count(*)::int FROM follower_returns x WHERE x.request_id = fr.request_id) AS request_items
       FROM follower_returns fr
       LEFT JOIN order_lines ol ON ol.id = fr.order_line_id
       LEFT JOIN follower_orders fo ON fo.id = fr.order_id
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
  // shopper-walk-fixes (W14): an item of an order placed through a post. Its refund is what was paid
  // for the items of the request — never a typed amount — and everything returned together is approved together.
  if (await shopperReturns.isLineReturn(req.params.id)) {
    return success(res, await shopperReturns.decide(req.params.id, { approve: true, adminUserId: req.user.sub, notes: admin_notes }));
  }
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
  if (await shopperReturns.isLineReturn(req.params.id)) {
    return success(res, await shopperReturns.decide(req.params.id, { approve: false, adminUserId: req.user.sub, notes: admin_notes }));
  }
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
  // W14: the item is back — it is undone as a cancel undoes one, and an online payment is refunded here.
  if (await shopperReturns.isLineReturn(req.params.id)) {
    return success(res, await shopperReturns.complete(req.params.id, { adminUserId: req.user.sub }));
  }
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

  // ── Money G-3: PER-ITEM PRO-RATED commission claw-back ──────────────────────
  // A refunded item must claw back only ITS share of the influencer commission +
  // the brand's net (not the whole order). One return row = one item (product_id
  // + variant_id). Pro-rate by the returned line's share of the order item total.
  //   returnedShare      = line_total / itemsTotal   (line_total = price*qty from items_json)
  //   reversedCommission = round(influencer_commission * share)
  //   reversedBrandNet   = round(brand_net           * share)
  // Idempotent: only runs when follower_returns.reversed_at IS NULL.
  await clawbackOnRefund(rows[0].id).catch(e =>
    console.error('[returns] claw-back failed for return', rows[0].id, e.message)
  );

  notifyFollowerOfReturnDecision(rows[0].id, 'refunded').catch(e =>
    console.error('[NOTIFY] return.refunded customer notify failed:', e.message)
  );
  return success(res, rows[0]);
});

// ── Money G-3: per-item pro-rated commission claw-back ───────────────────────

/**
 * Pro-rated claw-back for a just-refunded return. Idempotent on
 * follower_returns.reversed_at. Runs atomically in one DB transaction:
 *   - compute the returned item's line_total / itemsTotal share from the
 *     order's items_json (single-brand single-category order → one window),
 *   - reverse that share of influencer_commission (from pending_balance if the
 *     commission is still HELD, else from wallet_balance if already confirmed),
 *   - accumulate follower_transactions.commission_reversed / brand_net_reversed,
 *   - stamp follower_returns.reversed_commission / reversed_at,
 *   - flip the txn to status='refunded' + brand_settlement_status='reversed'
 *     when the WHOLE order is gone, so the commerce-settlement job skips it;
 *     otherwise leave it 'pending' so the job later settles the kept remainder,
 *   - append an influencer_ledger 'return_clawback' debit row.
 */
async function clawbackOnRefund(returnId) {
  await db.withTransaction(async (client) => {
    // Lock the return row + its txn; pull the order's items_json for pro-ration.
    const { rows: ctxRows } = await client.query(
      `SELECT fr.id AS return_id, fr.product_id, fr.variant_id, fr.reversed_at,
              ft.id AS txn_id, ft.influencer_commission, ft.brand_net,
              ft.commission_confirmed_at, ft.commission_reversed, ft.brand_net_reversed,
              ci.influencer_id,
              fo.items_json
         FROM follower_returns fr
         JOIN follower_transactions ft ON ft.id = fr.transaction_id
         LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
         LEFT JOIN follower_orders fo ON fo.transaction_id = ft.id
        WHERE fr.id = $1
        FOR UPDATE OF fr, ft`,
      [returnId]
    );
    const c = ctxRows[0];
    if (!c) return;
    if (c.reversed_at) return; // already clawed back — idempotent

    const orderCommission = _round2(c.influencer_commission);
    const orderBrandNet    = _round2(c.brand_net);

    // Pro-ration: returned line's share of the order's item total.
    let items = c.items_json;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch (_) { items = null; } }
    items = Array.isArray(items) ? items : [];

    const lineTotal = (it) => (parseFloat(it.price) || 0) * (parseInt(it.quantity, 10) || 0);
    const itemsTotal = _round2(items.reduce((s, it) => s + lineTotal(it), 0));

    // Match the returned line by product_id (+ variant_id when present on items).
    const matched = items.find((it) =>
      String(it.product_id) === String(c.product_id) &&
      (c.variant_id == null || it.variant_id == null || String(it.variant_id) === String(c.variant_id))
    );

    // returnedShare: matched line's share. Fallbacks keep money safe when
    // items_json is absent/unmatched (e.g. single-item flows that don't write
    // an order): treat the whole order as returned (share = 1).
    let returnedShare;
    if (matched && itemsTotal > 0) {
      returnedShare = lineTotal(matched) / itemsTotal;
    } else {
      returnedShare = 1;
    }
    if (returnedShare > 1) returnedShare = 1;

    let reversedCommission = _round2(orderCommission * returnedShare);
    let reversedBrandNet   = _round2(orderBrandNet  * returnedShare);

    // Never reverse more than what remains un-reversed on the txn.
    const alreadyRevComm = _round2(c.commission_reversed);
    const alreadyRevNet  = _round2(c.brand_net_reversed);
    reversedCommission = _round2(Math.min(reversedCommission, Math.max(0, orderCommission - alreadyRevComm)));
    reversedBrandNet   = _round2(Math.min(reversedBrandNet,   Math.max(0, orderBrandNet  - alreadyRevNet)));

    // Stamp idempotency + the per-return reversed amount FIRST (the reversed_at
    // guard above makes the whole block run-once).
    await client.query(
      `UPDATE follower_returns
          SET reversed_commission = $1, reversed_at = NOW()
        WHERE id = $2`,
      [reversedCommission, returnId]
    );

    // Accumulate reversed totals on the transaction.
    const newRevComm = _round2(alreadyRevComm + reversedCommission);
    const newRevNet   = _round2(alreadyRevNet  + reversedBrandNet);
    await client.query(
      `UPDATE follower_transactions
          SET commission_reversed = $1, brand_net_reversed = $2
        WHERE id = $3`,
      [newRevComm, newRevNet, c.txn_id]
    );

    // Reverse the influencer's commission share. If still HELD (unconfirmed),
    // claw from pending_balance + total_earned. If already confirmed/paid to
    // wallet, claw from wallet_balance instead (GREATEST(0,...) safety).
    let balanceAfter = null;
    let balanceField = 'pending_balance';
    let ledgerNote = `Pro-rated return claw-back (share ${(returnedShare * 100).toFixed(1)}%)`;
    if (c.influencer_id && reversedCommission > 0) {
      if (!c.commission_confirmed_at) {
        const { rows: ir } = await client.query(
          `UPDATE influencers
              SET pending_balance = GREATEST(0, pending_balance - $1),
                  total_earned    = GREATEST(0, total_earned    - $1)
            WHERE id = $2
            RETURNING pending_balance`,
          [reversedCommission, c.influencer_id]
        );
        balanceAfter = ir[0] ? parseFloat(ir[0].pending_balance) : null;
      } else {
        balanceField = 'wallet_balance';
        ledgerNote += ' — confirmed commission reversed from wallet';
        const { rows: ir } = await client.query(
          `UPDATE influencers
              SET wallet_balance = GREATEST(0, wallet_balance - $1),
                  total_earned   = GREATEST(0, total_earned   - $1)
            WHERE id = $2
            RETURNING wallet_balance`,
          [reversedCommission, c.influencer_id]
        );
        balanceAfter = ir[0] ? parseFloat(ir[0].wallet_balance) : null;
      }

      await appendInfluencerLedger({
        client,
        influencerId: c.influencer_id,
        type: 'return_clawback',
        amount: reversedCommission,
        direction: 'debit',
        balanceField,
        balanceAfter,
        source: 'return',
        sourceRefId: returnId,
        note: ledgerNote,
      });
    }

    // Whole-order returned? Decide by BRAND NET remainder (the true signal for
    // whether the brand is still owed anything), NOT by commission — commission can
    // be unevenly distributed across lines, so a high-commission single-item return
    // could otherwise mis-flag a multi-item order as whole and under-pay the brand
    // for the kept lines. Fall back to commission only when there is no brand net.
    const wholeOrder =
      (orderBrandNet > 0 && newRevNet >= orderBrandNet) ||
      (orderBrandNet === 0 && orderCommission > 0 && newRevComm >= orderCommission);
    if (wholeOrder) {
      // Fully gone: mark refunded + reversed so the settle job never pays the brand.
      await client.query(
        `UPDATE follower_transactions
            SET status = 'refunded', brand_settlement_status = 'reversed'
          WHERE id = $1 AND brand_settlement_status <> 'settled'`,
        [c.txn_id]
      );
    }
    // Partial: leave status='completed' + brand_settlement_status='pending' so the
    // commerce-settlement job later settles the kept remainder (brand_net − reversed).
  });
}

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
  listBrandReturns,
  adminListReturns,
  adminApproveReturn,
  adminRejectReturn,
  adminMarkRefunded,
};
