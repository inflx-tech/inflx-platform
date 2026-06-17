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
            ft.commission_confirmed_at, ft.status AS tx_status, ft.return_window_ends_at,
            b.business_name AS brand_name,
            u_f.name AS follower_name, u_f.phone AS follower_phone,
            inf.instagram_handle AS creator_handle,
            a.label AS address_label,
            NULLIF(CONCAT_WS(', ', a.line1, a.line2, a.city, a.state, a.pincode), '') AS delivery_address
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

module.exports = { listOrders, updateStatus };
