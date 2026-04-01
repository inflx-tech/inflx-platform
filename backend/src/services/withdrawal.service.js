'use strict';

const axios             = require('axios');
const db                = require('../config/db');
const env               = require('../config/env');
const { decrypt }       = require('../utils/encrypt');
const paymentConfigSvc  = require('./paymentConfig.service');
const notificationService = require('./notification.service');

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Payout API helper
// Uses X-Payout API (RazorpayX) — separate key pair from Payment API
// ─────────────────────────────────────────────────────────────────────────────

async function createRazorpayPayout({ fundAccountId, amountPaise, purpose, referenceId, narration }) {
  const keyId     = env.RAZORPAY_PAYOUT_KEY_ID     || env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_PAYOUT_KEY_SECRET  || env.RAZORPAY_KEY_SECRET;
  const accountNo = env.RAZORPAY_PAYOUT_ACCOUNT_NUMBER;

  if (!accountNo) {
    throw new Error('RAZORPAY_PAYOUT_ACCOUNT_NUMBER not set in .env');
  }

  const payload = {
    account_number: accountNo,
    fund_account_id: fundAccountId,
    amount:         amountPaise,
    currency:       'INR',
    mode:           'UPI',   // UPI or NEFT/IMPS for bank
    purpose:        purpose || 'payout',
    queue_if_low_balance: true,
    reference_id:   referenceId,
    narration:      narration || 'INFLX Influencer Payout',
  };

  const response = await axios.post(
    'https://api.razorpay.com/v1/payouts',
    payload,
    {
      auth:    { username: keyId, password: keySecret },
      headers: { 'X-Payout-Idempotency': referenceId },
      timeout: 10000,
    }
  );

  return response.data; // { id, status, ... }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create or fetch Razorpay Fund Account for influencer
// Stored as razorpay_contact_id on influencers table (re-used across payouts)
// ─────────────────────────────────────────────────────────────────────────────

async function ensureFundAccount(influencer) {
  const keyId     = env.RAZORPAY_PAYOUT_KEY_ID     || env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_PAYOUT_KEY_SECRET  || env.RAZORPAY_KEY_SECRET;

  // ── Step 1: Create/reuse Razorpay Contact ─────────────────────────────────
  let contactId = influencer.razorpay_contact_id;

  if (!contactId) {
    const contactRes = await axios.post(
      'https://api.razorpay.com/v1/contacts',
      {
        name:         influencer.full_name || influencer.instagram_handle,
        type:         'employee',
        reference_id: influencer.id,
        email:        influencer.email || undefined,
        contact:      influencer.phone,
      },
      { auth: { username: keyId, password: keySecret }, timeout: 10000 }
    );
    contactId = contactRes.data.id;

    // Persist contact_id for future payouts
    await db.query(
      `UPDATE influencers SET razorpay_contact_id = $1 WHERE id = $2`,
      [contactId, influencer.id]
    );
  }

  // ── Step 2: Create Fund Account (UPI or Bank) ─────────────────────────────
  // upi_id and bank_account_no are stored encrypted — decrypt before sending
  let faPayload;
  if (influencer.upi_id) {
    faPayload = {
      contact_id:   contactId,
      account_type: 'vpa',
      vpa:          { address: decrypt(influencer.upi_id) },
    };
  } else {
    faPayload = {
      contact_id:   contactId,
      account_type: 'bank_account',
      bank_account: {
        name:           influencer.full_name || influencer.instagram_handle,
        ifsc:           influencer.bank_ifsc,
        account_number: decrypt(influencer.bank_account_no),
      },
    };
  }

  const faRes = await axios.post(
    'https://api.razorpay.com/v1/fund_accounts',
    faPayload,
    { auth: { username: keyId, password: keySecret }, timeout: 10000 }
  );

  return faRes.data.id; // fund_account_id
}

// ─────────────────────────────────────────────────────────────────────────────
// initiateWithdrawal
// ─────────────────────────────────────────────────────────────────────────────

async function initiateWithdrawal(influencer, amountRequested, method) {
  // ── Validations ────────────────────────────────────────────────────────────
  const cfg = await paymentConfigSvc.getConfig();
  const minWithdrawalPaise = Math.round(cfg.minWithdrawalInr * 100);
  if (amountRequested < minWithdrawalPaise) {
    const err = new Error(`Minimum withdrawal amount is ₹${cfg.minWithdrawalInr}`);
    err.code = 'WITHDRAWAL_TOO_SMALL'; err.statusCode = 422;
    throw err;
  }

  const walletBalance = parseFloat(influencer.wallet_balance);
  if (amountRequested > walletBalance) {
    const err = new Error('Insufficient wallet balance');
    err.code = 'INSUFFICIENT_BALANCE'; err.statusCode = 422;
    throw err;
  }

  if (!influencer.upi_id && !influencer.bank_account_no) {
    const err = new Error('No payment method on file. Please add UPI ID or bank account.');
    err.code = 'PAYMENT_METHOD_MISSING'; err.statusCode = 422;
    throw err;
  }

  const tdsDeducted = Math.floor(amountRequested * (cfg.tdsPct / 100));
  const netPaid     = amountRequested - tdsDeducted;

  // ── Deduct wallet immediately (prevents double-withdrawal) ────────────────
  await db.query(
    `UPDATE influencers SET wallet_balance = wallet_balance - $1 WHERE id = $2`,
    [amountRequested, influencer.id]
  );

  // ── Razorpay payout ───────────────────────────────────────────────────────
  let razorpayPayoutId;
  let status;
  const referenceId = `w_${influencer.id.slice(0, 8)}_${Date.now()}`;

  if (env.RAZORPAY_MOCK) {
    razorpayPayoutId = `mock_payout_${Date.now()}`;
    status           = 'completed';
    console.log(`[RAZORPAY MOCK] Payout ${razorpayPayoutId} — ₹${netPaid / 100} via ${method}`);
  } else {
    try {
      const fundAccountId = await ensureFundAccount(influencer);
      const payoutRes = await createRazorpayPayout({
        fundAccountId,
        amountPaise:  netPaid,
        purpose:      'payout',
        referenceId,
        narration:    'INFLX Influencer Payout',
      });
      razorpayPayoutId = payoutRes.id;
      // Razorpay payout status: queued → processing → processed / reversed
      status = payoutRes.status === 'processed' ? 'completed' : 'processing';
    } catch (err) {
      // Rollback wallet deduction on payout failure
      await db.query(
        `UPDATE influencers SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
        [amountRequested, influencer.id]
      );
      const msg = err?.response?.data?.error?.description || err.message;
      const e   = new Error(`Razorpay payout failed: ${msg}`);
      e.code = 'PAYOUT_FAILED'; e.statusCode = 502;
      throw e;
    }
  }

  // ── Create withdrawal record ───────────────────────────────────────────────
  const { rows } = await db.query(
    `INSERT INTO influencer_withdrawals
       (influencer_id, amount_requested, tds_deducted, net_paid, method,
        upi_id, bank_account_no, bank_ifsc, razorpay_payout_id, status, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      influencer.id,
      amountRequested,
      tdsDeducted,
      netPaid,
      method,
      method === 'upi'           ? influencer.upi_id         : null,
      method === 'bank_transfer' ? influencer.bank_account_no : null,
      method === 'bank_transfer' ? influencer.bank_ifsc        : null,
      razorpayPayoutId,
      status,
      status === 'completed' ? new Date() : null,
    ]
  );

  const withdrawal = rows[0];

  // ── Notify influencer ─────────────────────────────────────────────────────
  const netRupees = (netPaid / 100).toFixed(2);
  const tdsRupees = (tdsDeducted / 100).toFixed(2);
  await notificationService.send({
    userId:   influencer.user_id,
    type:     'withdrawal.initiated',
    title:    status === 'completed' ? 'Withdrawal Processed' : 'Withdrawal Initiated',
    body:     `₹${netRupees} sent to your ${method === 'upi' ? 'UPI' : 'bank account'}. TDS deducted: ₹${tdsRupees}`,
    data:     { screen: 'withdrawals', withdrawal_id: withdrawal.id },
    fcmToken: influencer.fcm_token,
    sendSms:  true,
    phone:    influencer.phone,
  });

  return withdrawal;
}

// ─────────────────────────────────────────────────────────────────────────────
// retryWithdrawal
// ─────────────────────────────────────────────────────────────────────────────

async function retryWithdrawal(withdrawal, influencer) {
  if (withdrawal.status !== 'failed') {
    const err = new Error('Only failed withdrawals can be retried');
    err.code = 'VALIDATION_ERROR'; err.statusCode = 422;
    throw err;
  }

  // Refund amount back to wallet
  await db.query(
    `UPDATE influencers SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
    [withdrawal.amount_requested, influencer.id]
  );

  await db.query(
    `UPDATE influencer_withdrawals SET status = 'initiated', razorpay_payout_id = NULL WHERE id = $1`,
    [withdrawal.id]
  );

  const updatedInfluencer = {
    ...influencer,
    wallet_balance: parseFloat(influencer.wallet_balance) + parseFloat(withdrawal.amount_requested),
  };
  return initiateWithdrawal(updatedInfluencer, parseFloat(withdrawal.amount_requested), withdrawal.method);
}

module.exports = { initiateWithdrawal, retryWithdrawal };
