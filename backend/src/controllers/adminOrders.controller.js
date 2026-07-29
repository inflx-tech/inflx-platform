'use strict';

/**
 * adminOrders.controller.js — platform-wide order oversight (Order Fulfillment
 * Engine Unit 3). Admin can list every brand's orders and override status / cancel.
 * Refunds run through the existing returns flow (returns.controller). requireAnyAdminRole.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');

const VALID_STATUSES = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled'];
const TS_COL = {
  packed: 'packed_at', dispatched: 'dispatched_at',
  out_for_delivery: 'out_for_delivery_at', delivered: 'delivered_at', cancelled: 'cancelled_at',
};

// GET /admin/orders?status=&q=&page=&limit= — all online orders across brands.
const listOrders = asyncHandler(async (req, res) => {
  const { status, q, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const cond = [`ft.transaction_type = 'online_order'`];
  const params = [];
  if (status && VALID_STATUSES.includes(status)) {
    params.push(status); cond.push(`fo.order_status = $${params.length}`);
  }
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    cond.push(`(u_f.name ILIKE $${params.length} OR b.business_name ILIKE $${params.length} OR fo.id::text ILIKE $${params.length} OR fo.tracking_number ILIKE $${params.length})`);
  }
  const where = cond.join(' AND ');

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM follower_orders fo
       JOIN follower_transactions ft ON ft.id = fo.transaction_id
       JOIN brands b ON b.id = ft.brand_id
       JOIN followers f ON f.id = ft.follower_id
       JOIN users u_f ON u_f.id = f.user_id
      WHERE ${where}`, params);
  const total = parseInt(countRows[0].count, 10);

  params.push(limitNum, offset);
  const { rows } = await db.query(
    `SELECT fo.id, fo.order_status, fo.courier_name, fo.tracking_number,
            fo.created_at, fo.packed_at, fo.dispatched_at, fo.out_for_delivery_at,
            fo.delivered_at, fo.cancelled_at, fo.items_json,
            ft.net_amount, ft.influencer_commission, ft.platform_fee,
            ft.gross_amount, ft.discount_amount, ft.brand_net, ft.offer_source,
            ft.brand_settlement_status, ft.brand_settled_at,
            ft.commission_confirmed_at, ft.status AS tx_status, ft.return_window_ends_at,
            b.business_name AS brand_name,
            u_f.name AS follower_name, u_f.phone AS follower_phone,
            inf.instagram_handle AS creator_handle,
            a.label AS address_label,
            NULLIF(CONCAT_WS(', ', a.line1, a.line2, a.city, a.pincode), '') AS delivery_address
       FROM follower_orders fo
       JOIN follower_transactions ft ON ft.id = fo.transaction_id
       JOIN brands b ON b.id = ft.brand_id
       JOIN followers f ON f.id = ft.follower_id
       JOIN users u_f ON u_f.id = f.user_id
       LEFT JOIN follower_addresses a ON a.id = fo.address_id
       LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
       LEFT JOIN influencers inf ON inf.id = ci.influencer_id
      WHERE ${where}
      ORDER BY fo.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`, params);

  return success(res, { orders: rows }, 200, { page: pageNum, limit: limitNum, total });
});

// PATCH /admin/orders/:id/status — admin override of any order's status (+courier/tracking).
const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { order_status, courier_name, tracking_number } = req.body;
  if (!VALID_STATUSES.includes(order_status)) {
    throw new AppError('VALIDATION_ERROR', `order_status must be one of: ${VALID_STATUSES.join(', ')}`, 422);
  }

  const { rows: existing } = await db.query(
    `SELECT fo.id, u_f.id AS follower_user_id, u_f.fcm_token
       FROM follower_orders fo
       JOIN follower_transactions ft ON ft.id = fo.transaction_id
       JOIN followers f ON f.id = ft.follower_id
       JOIN users u_f ON u_f.id = f.user_id
      WHERE fo.id = $1`, [id]);
  if (!existing[0]) throw new AppError('NOT_FOUND', 'Order not found', 404);

  const tsCol = TS_COL[order_status] || null;
  const { rows } = await db.query(
    `UPDATE follower_orders SET
        order_status    = $1,
        courier_name    = COALESCE($2, courier_name),
        tracking_number = COALESCE($3, tracking_number)
        ${tsCol ? `, ${tsCol} = COALESCE(${tsCol}, now())` : ''}
      WHERE id = $4 RETURNING *`,
    [order_status, courier_name || null, tracking_number || null, id]);

  const msgMap = {
    packed: 'Your order is packed and ready to ship.',
    dispatched: 'Your order has been shipped!',
    out_for_delivery: 'Your order is out for delivery.',
    delivered: 'Your order has been delivered!',
    cancelled: 'Your order has been cancelled.',
  };
  if (msgMap[order_status]) {
    notificationService.send({
      userId: existing[0].follower_user_id,
      type: `order.${order_status}`,
      title: msgMap[order_status],
      body: msgMap[order_status],
      fcmToken: existing[0].fcm_token,
    }).catch(e => console.error('[NOTIFY] admin order status failed:', e.message));
  }

  return success(res, { order: rows[0] });
});

// GET /admin/commerce-summary?days=30 — online-order rollup for the admin orders
// page (stakeholder-sale-info S-A): count · GMV · fees · commission · brand net ·
// pending settlement (brand_net not yet settled).
const getCommerceSummary = asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days || '30', 10)));
  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int                              AS online_order_count,
       COALESCE(SUM(ft.net_amount), 0)            AS gmv,
       COALESCE(SUM(ft.platform_fee), 0)          AS platform_fees,
       COALESCE(SUM(ft.influencer_commission), 0) AS influencer_commission,
       COALESCE(SUM(ft.brand_net), 0)             AS brand_net,
       COALESCE(SUM(CASE WHEN ft.brand_settlement_status IS DISTINCT FROM 'settled'
                         THEN ft.brand_net ELSE 0 END), 0) AS pending_settlement
       FROM follower_transactions ft
      WHERE ft.transaction_type = 'online_order'
        AND ft.status = 'completed'
        AND ft.created_at >= now() - make_interval(days => $1)`,
    [days]
  );
  return success(res, { days, summary: rows[0] });
});

module.exports = { listOrders, updateStatus, getCommerceSummary };
