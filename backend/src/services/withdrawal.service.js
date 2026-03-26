'use strict';

const db = require('../config/db');
const env = require('../config/env');
const notificationService = require('./notification.service');

/**
 * Initiate an influencer withdrawal.
 * TDS = 10% deducted at withdrawal time.
 * Minimum ₹100 = 10000 paise.
 *
 * Note: caller (controller) validates inputs before calling this service.
 * Service also validates as a safety net.
 */
async function initiateWithdrawal(influencer, amountRequested, method) {
  // Safety-net validation (controller also validates)
  if (amountRequested < 10000) {
    const err = new Error('Minimum withdrawal amount is ₹100');
    err.code = 'WITHDRAWAL_TOO_SMALL';
    err.statusCode = 422;
    throw err;
  }

  const walletBalance = parseFloat(influencer.wallet_balance);
  if (amountRequested > walletBalance) {
    const err = new Error('Insufficient wallet balance');
    err.code = 'INSUFFICIENT_BALANCE';
    err.statusCode = 422;
    throw err;
  }

  if (!influencer.upi_id && !influencer.bank_account_no) {
    const err = new Error('No payment method on file. Please add UPI ID or bank account.');
    err.code = 'PAYMENT_METHOD_MISSING';
    err.statusCode = 422;
    throw err;
  }

  const tdsDeducted = Math.floor(amountRequested * 0.10);
  const netPaid = amountRequested - tdsDeducted;

  // Deduct wallet immediately (prevents double-withdrawal)
  await db.query(
    `UPDATE influencers SET wallet_balance = wallet_balance - $1 WHERE id = $2`,
    [amountRequested, influencer.id]
  );

  // Determine Razorpay payout
  let razorpayPayoutId;
  let status;

  if (env.RAZORPAY_MOCK) {
    razorpayPayoutId = `mock_payout_${Date.now()}`;
    status = 'completed';
    console.log(`[RAZORPAY MOCK] Withdrawal payout — ${razorpayPayoutId} ₹${(netPaid / 100).toFixed(2)} via ${method}`);
  } else {
    // Production: call Razorpay Payout API
    status = 'processing';
    throw new Error('Set RAZORPAY_MOCK=false and implement live Razorpay payouts');
  }

  // Create withdrawal record
  const { rows } = await db.query(
    `INSERT INTO influencer_withdrawals
       (influencer_id, amount_requested, tds_deducted, net_paid, method,
        upi_id, bank_account_no, bank_ifsc, razorpay_payout_id, status,
        completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      influencer.id,
      amountRequested,
      tdsDeducted,
      netPaid,
      method,
      method === 'upi' ? influencer.upi_id : null,
      method === 'bank_transfer' ? influencer.bank_account_no : null,
      method === 'bank_transfer' ? influencer.bank_ifsc : null,
      razorpayPayoutId,
      status,
      status === 'completed' ? new Date() : null,
    ]
  );

  const withdrawal = rows[0];

  // Send notification
  const netRupees = (netPaid / 100).toFixed(2);
  const tdsRupees = (tdsDeducted / 100).toFixed(2);
  await notificationService.send({
    userId: influencer.user_id,
    type: 'withdrawal.initiated',
    title: 'Withdrawal Processed',
    body: `₹${netRupees} sent to your ${method === 'upi' ? 'UPI' : 'bank account'}. TDS deducted: ₹${tdsRupees}`,
    data: { screen: 'withdrawals', withdrawal_id: withdrawal.id },
    fcmToken: influencer.fcm_token,
    sendSms: true,
    phone: influencer.phone,
  });

  return withdrawal;
}

/**
 * Retry a failed withdrawal.
 */
async function retryWithdrawal(withdrawal, influencer) {
  if (withdrawal.status !== 'failed') {
    const err = new Error('Only failed withdrawals can be retried');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }

  // Refund the deducted amount back to wallet before re-initiating
  await db.query(
    `UPDATE influencers SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
    [withdrawal.amount_requested, influencer.id]
  );

  // Reset withdrawal status to initiated
  await db.query(
    `UPDATE influencer_withdrawals SET status = 'initiated', razorpay_payout_id = NULL WHERE id = $1`,
    [withdrawal.id]
  );

  // Re-initiate with updated wallet balance
  const updatedInfluencer = {
    ...influencer,
    wallet_balance: parseFloat(influencer.wallet_balance) + parseFloat(withdrawal.amount_requested),
  };
  return initiateWithdrawal(updatedInfluencer, parseFloat(withdrawal.amount_requested), withdrawal.method);
}

module.exports = { initiateWithdrawal, retryWithdrawal };
