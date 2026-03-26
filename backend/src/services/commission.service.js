'use strict';

/**
 * commission.service.js
 * Phase 4 — Block G
 *
 * getInfluencerCommissions — list + summary for influencer earnings screen
 * getBrandConversions      — campaign conversion analytics for brand
 */

const db = require('../config/db');
const env = require('../config/env');

/**
 * Get all follower_transactions for this influencer (via campaign_influencers).
 * status filter: 'pending' | 'confirmed' | 'all'
 */
async function getInfluencerCommissions(influencerId, statusFilter = 'all') {
  let sql = `
    SELECT
      ft.id               AS transaction_id,
      ft.gross_amount,
      ft.net_amount,
      ft.influencer_commission AS commission_amount,
      ft.transaction_type,
      ft.status           AS tx_status,
      ft.commission_confirmed_at,
      ft.return_window_ends_at,
      ft.coupon_code_used AS coupon_code,
      ft.created_at,
      ci.commission_pct,
      b.business_name     AS brand_name
    FROM follower_transactions ft
    JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
    JOIN brands b                ON b.id  = ft.brand_id
    WHERE ci.influencer_id = $1
      AND ft.status = 'completed'
  `;
  const params = [influencerId];

  if (statusFilter === 'pending') {
    sql += ` AND ft.commission_confirmed_at IS NULL`;
  } else if (statusFilter === 'confirmed') {
    sql += ` AND ft.commission_confirmed_at IS NOT NULL`;
  }

  sql += ` ORDER BY ft.created_at DESC`;

  const { rows } = await db.query(sql, params);

  const now = new Date();
  const RETURN_WINDOW_DAYS = env.RETURN_WINDOW_DAYS || 30;

  const commissions = rows.map(r => {
    const isPending = !r.commission_confirmed_at;
    const daysUntilConfirmed = isPending && r.return_window_ends_at
      ? Math.max(0, Math.ceil((new Date(r.return_window_ends_at) - now) / (1000 * 60 * 60 * 24)))
      : 0;

    const txIdShort = r.transaction_id.replace(/-/g, '').slice(-4).toUpperCase();
    return {
      transaction_id: r.transaction_id,
      sale_id_display: `#INFLX-${txIdShort}`,
      item_description: `${r.transaction_type.replace(/_/g, ' ')} — ${r.brand_name}`,
      gross_amount: parseFloat(r.gross_amount),
      net_amount: parseFloat(r.net_amount),
      commission_amount: parseFloat(r.commission_amount),
      commission_pct: parseFloat(r.commission_pct),
      status: isPending ? 'pending' : 'confirmed',
      days_until_confirmed: daysUntilConfirmed,
      coupon_code: r.coupon_code,
      created_at: r.created_at,
    };
  });

  // Summary
  const pending = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.commission_amount, 0);
  const confirmed = commissions
    .filter(c => c.status === 'confirmed')
    .reduce((sum, c) => sum + c.commission_amount, 0);
  const total = pending + confirmed;

  return {
    commissions,
    summary: {
      total_commission_earned: total,
      pending_commission: pending,
      confirmed_commission: confirmed,
      commission_rate: commissions[0]?.commission_pct || 0,
    },
  };
}

/**
 * Brand conversion analytics for a campaign.
 */
async function getBrandConversions(campaignId, brandId) {
  // Verify ownership
  const { rows: campRows } = await db.query(
    `SELECT id FROM campaigns WHERE id = $1 AND brand_id = $2`,
    [campaignId, brandId]
  );
  if (!campRows[0]) {
    const AppError = require('../utils/AppError');
    throw new AppError('FORBIDDEN', 'Campaign not found or access denied', 403);
  }

  const { rows } = await db.query(
    `SELECT
       ft.transaction_type,
       ft.net_amount,
       ft.influencer_commission,
       ci.coupon_code,
       ci.influencer_id,
       u.name AS influencer_name
     FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     JOIN influencers inf          ON inf.id = ci.influencer_id
     JOIN users u                  ON u.id  = inf.user_id
     WHERE ft.campaign_id = $1
       AND ft.status = 'completed'`,
    [campaignId]
  );

  const totalSales = rows.length;
  const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.net_amount), 0);
  const totalCommission = rows.reduce((s, r) => s + parseFloat(r.influencer_commission), 0);
  const blendedRoi = totalCommission > 0 ? parseFloat((totalRevenue / totalCommission).toFixed(2)) : 0;

  // By channel
  const channels = { pay_at_store: { count: 0, revenue: 0 }, online_order: { count: 0, revenue: 0 }, prebook: { count: 0, revenue: 0 } };
  for (const r of rows) {
    const ch = channels[r.transaction_type];
    if (ch) { ch.count++; ch.revenue += parseFloat(r.net_amount); }
  }
  for (const ch of Object.values(channels)) {
    ch.pct = totalSales > 0 ? Math.round(ch.count / totalSales * 100) : 0;
  }

  // By influencer
  const byInf = {};
  for (const r of rows) {
    if (!byInf[r.influencer_id]) {
      byInf[r.influencer_id] = {
        influencer_id: r.influencer_id,
        name: r.influencer_name,
        coupon_code: r.coupon_code,
        sales_count: 0,
        revenue: 0,
        commission_paid: 0,
      };
    }
    byInf[r.influencer_id].sales_count++;
    byInf[r.influencer_id].revenue += parseFloat(r.net_amount);
    byInf[r.influencer_id].commission_paid += parseFloat(r.influencer_commission);
  }

  const byInfluencer = Object.values(byInf).map(i => ({
    ...i,
    roi: i.commission_paid > 0 ? parseFloat((i.revenue / i.commission_paid).toFixed(2)) : 0,
  }));

  return {
    campaign_id: campaignId,
    totals: { total_sales: totalSales, total_revenue: totalRevenue, total_commission_paid: totalCommission, blended_roi: blendedRoi },
    by_channel: channels,
    by_influencer: byInfluencer,
  };
}

module.exports = { getInfluencerCommissions, getBrandConversions };
