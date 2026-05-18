'use strict';

/**
 * followerWallet.controller.js — Path C-2 follower wallet.
 *
 * Reward balance is DERIVED from follower_transactions (the canonical
 * creator-attribution table) so no transaction-completion path had to
 * be modified. The ledger persists only redeem/adjust entries.
 *
 *   GET /follower/wallet               getWallet
 *   GET /follower/wallet/transactions  listWalletTransactions
 *
 * Reward = REWARD_PCT of net_amount on the follower's completed,
 * creator-attributed transactions. Modest (3%) — tune later / move to
 * admin config when the economics are validated.
 */

const db           = require('../config/db');
const { success }  = require('../utils/response');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const REWARD_PCT = 3; // % of net_amount credited as follower wallet reward

async function followerIdForUser(userId) {
  const { rows } = await db.query(`SELECT id FROM followers WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /follower/wallet
// ─────────────────────────────────────────────────────────────────────────────

const getWallet = asyncHandler(async (req, res) => {
  const followerId = await followerIdForUser(req.user.sub);
  if (!followerId) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  // Derived lifetime rewards from completed, creator-attributed txns.
  const { rows: rwRows } = await db.query(
    `SELECT COALESCE(SUM(net_amount), 0)::numeric AS net_sum
       FROM follower_transactions
      WHERE follower_id = $1
        AND status = 'completed'
        AND campaign_influencer_id IS NOT NULL`,
    [followerId]
  );
  const lifetime = +((Number(rwRows[0].net_sum) || 0) * REWARD_PCT / 100).toFixed(2);

  // Ledger: redemptions subtract, adjustments add.
  const { rows: ledRows } = await db.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE entry_type = 'redeem'), 0)::numeric AS redeemed,
       COALESCE(SUM(amount) FILTER (WHERE entry_type = 'adjust'), 0)::numeric AS adjusted
     FROM follower_wallet_ledger
     WHERE follower_id = $1`,
    [followerId]
  );
  const redeemed = Number(ledRows[0].redeemed) || 0;
  const adjusted = Number(ledRows[0].adjusted) || 0;
  const available = Math.max(0, +(lifetime - redeemed + adjusted).toFixed(2));

  return success(res, {
    wallet: {
      available,
      pending: 0,            // no pending window in the pilot
      lifetime,
      redeemed,
      reward_pct: REWARD_PCT,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /follower/wallet/transactions
// Merged view: derived reward rows (from follower_transactions) + ledger
// rows, newest first.
// ─────────────────────────────────────────────────────────────────────────────

const listWalletTransactions = asyncHandler(async (req, res) => {
  const followerId = await followerIdForUser(req.user.sub);
  if (!followerId) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { rows: rewards } = await db.query(
    `SELECT ft.id, ft.created_at, ft.net_amount,
            b.business_name AS brand_name,
            i.instagram_handle AS influencer_handle
       FROM follower_transactions ft
       JOIN brands b ON b.id = ft.brand_id
       LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
       LEFT JOIN influencers i ON i.id = ci.influencer_id
      WHERE ft.follower_id = $1
        AND ft.status = 'completed'
        AND ft.campaign_influencer_id IS NOT NULL
      ORDER BY ft.created_at DESC
      LIMIT 50`,
    [followerId]
  );

  const { rows: ledger } = await db.query(
    `SELECT id, entry_type, amount, note, created_at
       FROM follower_wallet_ledger
      WHERE follower_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
    [followerId]
  );

  const rewardRows = rewards.map(r => ({
    id: `rw_${r.id}`,
    kind: 'reward',
    amount: +((Number(r.net_amount) || 0) * REWARD_PCT / 100).toFixed(2),
    brand_name: r.brand_name,
    influencer_handle: r.influencer_handle,
    status: 'available',
    created_at: r.created_at,
  }));
  const ledgerRows = ledger.map(l => ({
    id: `lg_${l.id}`,
    kind: l.entry_type,
    amount: Number(l.amount) || 0,
    brand_name: null,
    influencer_handle: null,
    status: 'available',
    note: l.note,
    created_at: l.created_at,
  }));

  const transactions = [...rewardRows, ...ledgerRows]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return success(res, { transactions });
});

module.exports = { getWallet, listWalletTransactions };
