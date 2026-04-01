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

/**
 * Per-campaign earnings breakdown for influencer.
 * Groups escrow tranches + follower commissions by campaign.
 */
async function getInfluencerCampaignEarnings(influencerId) {
  // 1. Get all campaign_influencer records with campaign info
  const { rows: ciRows } = await db.query(
    `SELECT
       ci.id AS campaign_influencer_id,
       ci.agreed_fee,
       ci.status AS ci_status,
       c.id AS campaign_id,
       c.name AS campaign_name,
       cs.goal,
       b.business_name AS brand_name
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c      ON c.id = cs.campaign_id
     JOIN brands b         ON b.id = c.brand_id
     WHERE ci.influencer_id = $1
       AND ci.status NOT IN ('invited', 'declined', 'expired')
     ORDER BY c.created_at DESC`,
    [influencerId]
  );

  if (!ciRows.length) return { campaigns: [] };

  const ciIds = ciRows.map(r => r.campaign_influencer_id);

  // 2. Get escrow entries for all campaign_influencer IDs
  const { rows: escrowRows } = await db.query(
    `SELECT
       ee.campaign_influencer_id,
       ee.tranche_number,
       ee.net_to_influencer,
       ee.status,
       ee.released_at,
       ee.trigger_event,
       ee.created_at
     FROM escrow_entries ee
     WHERE ee.campaign_influencer_id = ANY($1)
     ORDER BY ee.tranche_number ASC`,
    [ciIds]
  );

  // 3. Get follower commissions grouped by campaign_influencer_id
  const { rows: commRows } = await db.query(
    `SELECT
       ft.campaign_influencer_id,
       ft.influencer_commission AS commission_amount,
       ft.commission_confirmed_at,
       ft.return_window_ends_at,
       ft.transaction_type,
       ft.created_at
     FROM follower_transactions ft
     WHERE ft.campaign_influencer_id = ANY($1)
       AND ft.status = 'completed'
     ORDER BY ft.created_at DESC`,
    [ciIds]
  );

  // Group escrow and commissions by campaign_influencer_id
  const escrowMap = {};
  for (const e of escrowRows) {
    if (!escrowMap[e.campaign_influencer_id]) escrowMap[e.campaign_influencer_id] = [];
    escrowMap[e.campaign_influencer_id].push(e);
  }

  const commMap = {};
  for (const c of commRows) {
    if (!commMap[c.campaign_influencer_id]) commMap[c.campaign_influencer_id] = [];
    commMap[c.campaign_influencer_id].push(c);
  }

  const campaigns = ciRows.map(ci => {
    const tranches = (escrowMap[ci.campaign_influencer_id] || []).map(e => ({
      tranche_number: e.tranche_number,
      amount: parseFloat(e.net_to_influencer),
      status: e.status,
      released_at: e.released_at,
      trigger_event: e.trigger_event,
      created_at: e.created_at,
    }));

    const commissions = (commMap[ci.campaign_influencer_id] || []).map(c => ({
      commission_amount: parseFloat(c.commission_amount),
      status: c.commission_confirmed_at ? 'confirmed' : 'pending',
      transaction_type: c.transaction_type,
      return_window_ends_at: c.return_window_ends_at,
      created_at: c.created_at,
    }));

    const trancheEarned = tranches
      .filter(t => t.status === 'released')
      .reduce((s, t) => s + t.amount, 0);
    const tranchePending = tranches
      .filter(t => t.status === 'locked')
      .reduce((s, t) => s + t.amount, 0);

    const commConfirmed = commissions
      .filter(c => c.status === 'confirmed')
      .reduce((s, c) => s + c.commission_amount, 0);
    const commPending = commissions
      .filter(c => c.status === 'pending')
      .reduce((s, c) => s + c.commission_amount, 0);

    const totalEarned = trancheEarned + commConfirmed;
    const totalPending = tranchePending + commPending;

    return {
      campaign_influencer_id: ci.campaign_influencer_id,
      campaign_id: ci.campaign_id,
      campaign_name: ci.campaign_name,
      brand_name: ci.brand_name,
      goal: ci.goal,
      ci_status: ci.ci_status,
      agreed_fee: ci.agreed_fee ? parseFloat(ci.agreed_fee) : null,
      total_earned: totalEarned,
      total_pending: totalPending,
      tranche_earned: trancheEarned,
      tranche_pending: tranchePending,
      commission_confirmed: commConfirmed,
      commission_pending: commPending,
      tranche_count: tranches.length,
      commission_count: commissions.length,
    };
  });

  return { campaigns };
}

/**
 * Detailed commission/escrow data for a single campaign_influencer record.
 */
async function getCampaignCommissionDetail(campaignInfluencerId, influencerId) {
  // Verify ownership
  const { rows: ciRows } = await db.query(
    `SELECT
       ci.id AS campaign_influencer_id,
       ci.agreed_fee,
       ci.status AS ci_status,
       ci.commission_pct,
       c.id AS campaign_id,
       c.name AS campaign_name,
       c.status AS campaign_status,
       cs.goal,
       b.business_name AS brand_name
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c      ON c.id = cs.campaign_id
     JOIN brands b         ON b.id = c.brand_id
     WHERE ci.id = $1 AND ci.influencer_id = $2`,
    [campaignInfluencerId, influencerId]
  );
  if (!ciRows[0]) {
    const AppError = require('../utils/AppError');
    throw new AppError('NOT_FOUND', 'Campaign assignment not found', 404);
  }
  const ci = ciRows[0];

  // Escrow tranches
  const { rows: tranches } = await db.query(
    `SELECT
       ee.tranche_number,
       ee.net_to_influencer,
       ee.status,
       ee.released_at,
       ee.trigger_event,
       ee.created_at
     FROM escrow_entries ee
     WHERE ee.campaign_influencer_id = $1
     ORDER BY ee.tranche_number ASC`,
    [campaignInfluencerId]
  );

  // Follower commissions
  const { rows: commissions } = await db.query(
    `SELECT
       ft.id AS transaction_id,
       ft.gross_amount,
       ft.net_amount,
       ft.influencer_commission AS commission_amount,
       ft.transaction_type,
       ft.commission_confirmed_at,
       ft.return_window_ends_at,
       ft.coupon_code_used AS coupon_code,
       ft.created_at
     FROM follower_transactions ft
     WHERE ft.campaign_influencer_id = $1
       AND ft.status = 'completed'
     ORDER BY ft.created_at DESC`,
    [campaignInfluencerId]
  );

  const now = new Date();

  const trancheData = tranches.map(t => ({
    tranche_number: t.tranche_number,
    amount: parseFloat(t.net_to_influencer),
    status: t.status,
    released_at: t.released_at,
    trigger_event: t.trigger_event,
    created_at: t.created_at,
    label: t.tranche_number === 1 ? 'Contract Signed'
         : t.tranche_number === 2 ? 'Content Live'
         : 'Day 30 Post-Live',
  }));

  const commissionData = commissions.map(c => {
    const isPending = !c.commission_confirmed_at;
    const daysLeft = isPending && c.return_window_ends_at
      ? Math.max(0, Math.ceil((new Date(c.return_window_ends_at) - now) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      transaction_id: c.transaction_id,
      gross_amount: parseFloat(c.gross_amount),
      net_amount: parseFloat(c.net_amount),
      commission_amount: parseFloat(c.commission_amount),
      transaction_type: c.transaction_type,
      status: isPending ? 'pending' : 'confirmed',
      days_until_confirmed: daysLeft,
      coupon_code: c.coupon_code,
      created_at: c.created_at,
    };
  });

  const trancheEarned = trancheData.filter(t => t.status === 'released').reduce((s, t) => s + t.amount, 0);
  const tranchePending = trancheData.filter(t => t.status === 'locked').reduce((s, t) => s + t.amount, 0);
  const commConfirmed = commissionData.filter(c => c.status === 'confirmed').reduce((s, c) => s + c.commission_amount, 0);
  const commPending = commissionData.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0);

  return {
    campaign_influencer_id: ci.campaign_influencer_id,
    campaign_id: ci.campaign_id,
    campaign_name: ci.campaign_name,
    brand_name: ci.brand_name,
    goal: ci.goal,
    ci_status: ci.ci_status,
    campaign_status: ci.campaign_status,
    agreed_fee: ci.agreed_fee ? parseFloat(ci.agreed_fee) : null,
    commission_pct: ci.commission_pct ? parseFloat(ci.commission_pct) : null,
    tranches: trancheData,
    commissions: commissionData,
    summary: {
      tranche_earned: trancheEarned,
      tranche_pending: tranchePending,
      commission_confirmed: commConfirmed,
      commission_pending: commPending,
      total_earned: trancheEarned + commConfirmed,
      total_pending: tranchePending + commPending,
    },
  };
}

module.exports = { getInfluencerCommissions, getBrandConversions, getInfluencerCampaignEarnings, getCampaignCommissionDetail };
