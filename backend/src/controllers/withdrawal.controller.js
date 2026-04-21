'use strict';

const db = require('../config/db');
const withdrawalService = require('../services/withdrawal.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Helper
async function getInfluencerByUserId(userId) {
  const { rows } = await db.query(
    `SELECT i.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

// POST /influencers/me/withdraw
const initiateWithdrawal = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const { amount_requested, method } = req.body;

  if (!amount_requested || isNaN(amount_requested)) {
    throw new AppError('VALIDATION_ERROR', 'amount_requested is required and must be a number', 422, 'amount_requested');
  }
  if (!['upi', 'bank_transfer'].includes(method)) {
    throw new AppError('VALIDATION_ERROR', 'method must be upi or bank_transfer', 422, 'method');
  }

  // amount_requested is in RUPEES
  const amount = parseFloat(amount_requested);

  if (amount < 100) {
    throw new AppError('WITHDRAWAL_TOO_SMALL', 'Minimum withdrawal amount is \u20B9100', 422);
  }
  if (amount > parseFloat(influencer.wallet_balance)) {
    throw new AppError('INSUFFICIENT_BALANCE', 'Insufficient wallet balance', 422);
  }
  if (!influencer.upi_id && !influencer.bank_account_no) {
    throw new AppError('PAYMENT_METHOD_MISSING', 'No payment method on file. Please add UPI ID or bank account.', 422);
  }

  const withdrawal = await withdrawalService.initiateWithdrawal(influencer, amount, method);

  return success(res, {
    withdrawal_id: withdrawal.id,
    amount_requested: parseFloat(withdrawal.amount_requested),
    tds_deducted: parseFloat(withdrawal.tds_deducted),
    net_paid: parseFloat(withdrawal.net_paid),
    method: withdrawal.method,
    status: withdrawal.status,
    razorpay_payout_id: withdrawal.razorpay_payout_id,
  }, 201);
});

// GET /influencers/me/withdrawals
const listWithdrawals = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const { rows } = await db.query(
    `SELECT id AS withdrawal_id, amount_requested, tds_deducted, net_paid,
            method, status, created_at, completed_at
     FROM influencer_withdrawals
     WHERE influencer_id = $1
     ORDER BY created_at DESC`,
    [influencer.id]
  );

  return success(res, { withdrawals: rows });
});

// POST /influencers/me/withdrawals/:id/retry
const retryWithdrawal = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const { rows } = await db.query(
    `SELECT * FROM influencer_withdrawals WHERE id = $1 AND influencer_id = $2`,
    [req.params.id, influencer.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Withdrawal not found', 404);

  const withdrawal = rows[0];
  if (withdrawal.status !== 'failed') {
    throw new AppError('VALIDATION_ERROR', 'Only failed withdrawals can be retried', 422);
  }

  const retried = await withdrawalService.retryWithdrawal(withdrawal, influencer);

  return success(res, {
    withdrawal_id: retried.id,
    amount_requested: parseFloat(retried.amount_requested),
    tds_deducted: parseFloat(retried.tds_deducted),
    net_paid: parseFloat(retried.net_paid),
    method: retried.method,
    status: retried.status,
    razorpay_payout_id: retried.razorpay_payout_id,
  });
});

module.exports = { initiateWithdrawal, listWithdrawals, retryWithdrawal };
