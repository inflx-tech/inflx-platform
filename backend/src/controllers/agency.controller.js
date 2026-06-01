'use strict';

/**
 * Agency controller — Strategic Partner Agency profile, wallet, withdrawals.
 * Contract: features/referral-agency-role (Contract 3a). Backend-only; the
 * mobile surface is Contract 3b. Payout fields are AES-256-GCM encrypted like
 * influencers'.
 */

const db = require('../config/db');
const withdrawalService = require('../services/withdrawal.service');
const referralService = require('../services/referral.service');
const notificationService = require('../services/notification.service');
const { encrypt } = require('../utils/encrypt');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function getAgencyByUserId(userId) {
  const { rows } = await db.query(
    `SELECT a.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM agencies a JOIN users u ON u.id = a.user_id
     WHERE a.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

function publicAgency(a, referralCode) {
  return {
    id: a.id,
    agency_name: a.agency_name,
    contact_person: a.contact_person,
    contact_email: a.contact_email,
    city: a.city,
    state: a.state,
    has_upi: !!a.upi_id,
    has_bank: !!a.bank_account_no,
    bank_ifsc: a.bank_ifsc || null,
    account_holder_name: a.account_holder_name || null,
    wallet_balance: parseFloat(a.wallet_balance),
    pending_balance: parseFloat(a.pending_balance),
    referral_earned_total: parseFloat(a.referral_earned_total),
    user_status: a.user_status,
    referral_code: referralCode || null,
  };
}

// POST /agencies/register
const register = asyncHandler(async (req, res) => {
  const existing = await getAgencyByUserId(req.user.sub);
  if (existing) throw new AppError('VALIDATION_ERROR', 'Agency profile already exists', 409);

  const {
    agency_name, contact_person, contact_email, city, state,
    upi_id, bank_account_no, bank_ifsc, account_holder_name,
  } = req.body || {};

  if (!agency_name || !String(agency_name).trim()) {
    throw new AppError('VALIDATION_ERROR', 'agency_name is required', 422, 'agency_name');
  }

  const { rows } = await db.query(
    `INSERT INTO agencies
       (user_id, agency_name, contact_person, contact_email, city, state,
        upi_id, bank_account_no, bank_ifsc, account_holder_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      req.user.sub, agency_name.trim(), contact_person || null, contact_email || null,
      city || null, state || null,
      upi_id ? encrypt(upi_id) : null,
      bank_account_no ? encrypt(bank_account_no) : null,
      bank_ifsc || null, account_holder_name || null,
    ]
  );

  // Fill the users.name placeholder so the admin queue is scannable.
  await db.query(
    `UPDATE users SET name = $1, city = COALESCE($2, city), state = COALESCE($3, state) WHERE id = $4`,
    [agency_name.trim(), city || null, state || null, req.user.sub]
  );

  const agency = rows[0];
  return success(res, { agency: publicAgency({ ...agency, user_status: 'pending' }), user_status: 'pending' }, 201);
});

// GET /agencies/me
const getMe = asyncHandler(async (req, res) => {
  const agency = await getAgencyByUserId(req.user.sub);
  if (!agency) throw new AppError('NOT_FOUND', 'Agency profile not found', 404);
  const code = await referralService.getOrCreateCode('agency', agency.id);
  return success(res, { agency: publicAgency(agency, code.code) });
});

// PATCH /agencies/me — update payout details (encrypted) / contact
const updateMe = asyncHandler(async (req, res) => {
  const agency = await getAgencyByUserId(req.user.sub);
  if (!agency) throw new AppError('NOT_FOUND', 'Agency profile not found', 404);

  const b = req.body || {};
  const sets = [];
  const params = [];
  const add = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

  if (b.contact_person !== undefined)      add('contact_person', b.contact_person);
  if (b.contact_email !== undefined)       add('contact_email', b.contact_email);
  if (b.city !== undefined)                add('city', b.city);
  if (b.state !== undefined)               add('state', b.state);
  if (b.upi_id !== undefined)              add('upi_id', b.upi_id ? encrypt(b.upi_id) : null);
  if (b.bank_account_no !== undefined)     add('bank_account_no', b.bank_account_no ? encrypt(b.bank_account_no) : null);
  if (b.bank_ifsc !== undefined)           add('bank_ifsc', b.bank_ifsc);
  if (b.account_holder_name !== undefined) add('account_holder_name', b.account_holder_name);

  if (sets.length === 0) throw new AppError('VALIDATION_ERROR', 'No updatable fields supplied', 422);
  params.push(agency.id);
  await db.query(`UPDATE agencies SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  const updated = await getAgencyByUserId(req.user.sub);
  return success(res, { agency: publicAgency(updated) });
});

// POST /agencies/me/withdraw
const initiateWithdrawal = asyncHandler(async (req, res) => {
  const agency = await getAgencyByUserId(req.user.sub);
  if (!agency) throw new AppError('NOT_FOUND', 'Agency profile not found', 404);
  if (agency.user_status !== 'approved') {
    throw new AppError('FORBIDDEN', 'Agency must be approved before withdrawing', 403);
  }

  const { amount_requested, method } = req.body || {};
  if (!amount_requested || isNaN(amount_requested)) {
    throw new AppError('VALIDATION_ERROR', 'amount_requested is required and must be a number', 422, 'amount_requested');
  }
  if (!['upi', 'bank_transfer'].includes(method)) {
    throw new AppError('VALIDATION_ERROR', 'method must be upi or bank_transfer', 422, 'method');
  }

  // Pre-validate as AppErrors (proper 422s) — mirrors withdrawal.controller for
  // influencers. The service keeps its own checks as a backstop.
  const amount = parseFloat(amount_requested);
  if (amount < 100) {
    throw new AppError('WITHDRAWAL_TOO_SMALL', 'Minimum withdrawal amount is ₹100', 422);
  }
  if (amount > parseFloat(agency.wallet_balance)) {
    throw new AppError('INSUFFICIENT_BALANCE', 'Insufficient wallet balance', 422);
  }
  if (!agency.upi_id && !agency.bank_account_no) {
    throw new AppError('PAYMENT_METHOD_MISSING', 'No payment method on file. Please add UPI ID or bank account.', 422);
  }

  const withdrawal = await withdrawalService.initiateAgencyWithdrawal(agency, amount, method);

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

// GET /agencies/me/withdrawals
const listWithdrawals = asyncHandler(async (req, res) => {
  const agency = await getAgencyByUserId(req.user.sub);
  if (!agency) throw new AppError('NOT_FOUND', 'Agency profile not found', 404);
  const { rows } = await db.query(
    `SELECT id AS withdrawal_id, amount_requested, tds_deducted, net_paid,
            method, status, created_at, completed_at
     FROM agency_withdrawals WHERE agency_id = $1 ORDER BY created_at DESC`,
    [agency.id]
  );
  return success(res, { withdrawals: rows });
});

module.exports = { register, getMe, updateMe, initiateWithdrawal, listWithdrawals, getAgencyByUserId };
