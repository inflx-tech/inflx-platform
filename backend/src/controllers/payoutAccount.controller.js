'use strict';

/**
 * payoutAccount.controller.js — Wave 3 (commerce settlement).
 *
 * Brand payout-account onboarding via Razorpay Route "linked accounts". The
 * brand connects a payout destination (built from its saved bank details +
 * business info); commerce settlements (Wave 3 commit 2) then transfer the
 * brand's net share to this account. Mock mode synthesizes the account so the
 * flow is testable before Route is enabled.
 *
 *   GET  /v1/brands/me/payout-account   — current linked-account status
 *   POST /v1/brands/me/payout-account   — create the linked account
 */

const db           = require('../config/db');
const { success }  = require('../utils/response');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const routeService = require('../services/razorpayRoute.service');

async function getBrandRow(userId) {
  const { rows } = await db.query(
    `SELECT b.id, b.business_name, b.gstin, b.listing_data,
            b.razorpay_linked_account_id, b.linked_account_status,
            u.phone
       FROM brands b
       JOIN users u ON u.id = b.user_id
      WHERE b.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

const getPayoutAccount = asyncHandler(async (req, res) => {
  const brand = await getBrandRow(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const bank = (brand.listing_data && brand.listing_data.bank_details) || {};
  const hasBank = !!(bank.account_number && bank.ifsc_code);

  // If a linked account exists, refresh its status (reconciliation). Stored
  // value is the fallback if Razorpay is unreachable.
  let status = brand.linked_account_status || 'not_created';
  if (brand.razorpay_linked_account_id) {
    try {
      const s = await routeService.getLinkedAccountStatus(brand.razorpay_linked_account_id);
      if (s.status && s.status !== status) {
        status = s.status;
        await db.query(`UPDATE brands SET linked_account_status = $1 WHERE id = $2`, [status, brand.id]);
      }
    } catch (_) { /* keep stored status */ }
  }

  return success(res, {
    linked_account_id:     brand.razorpay_linked_account_id || null,
    linked_account_status: status,
    has_bank_details:      hasBank,
    bank_last4:            hasBank ? String(bank.account_number).slice(-4) : null,
    bank_ifsc:             hasBank ? bank.ifsc_code : null,
  });
});

const createPayoutAccount = asyncHandler(async (req, res) => {
  const brand = await getBrandRow(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  if (brand.razorpay_linked_account_id) {
    throw new AppError('CONFLICT', 'A payout account is already connected.', 409);
  }

  const bank = (brand.listing_data && brand.listing_data.bank_details) || {};
  if (!bank.account_number || !bank.ifsc_code) {
    throw new AppError(
      'PAYMENT_METHOD_MISSING',
      'Add your bank account (account number + IFSC) in Wallet before connecting a payout account.',
      422
    );
  }

  const details = {
    email:               req.body.email || undefined,
    phone:               brand.phone,
    legal_business_name: brand.business_name,
    contact_name:        bank.account_holder_name || brand.business_name,
    legal_info:          brand.gstin ? { gst: brand.gstin } : undefined,
    bank: {
      account_number: bank.account_number,
      ifsc:           bank.ifsc_code,
      name:           bank.account_holder_name || brand.business_name,
    },
  };

  let acc;
  try {
    acc = await routeService.createLinkedAccount({ id: brand.id, business_name: brand.business_name }, details);
  } catch (err) {
    console.error('[payout-account] createLinkedAccount failed:', err.message);
    throw new AppError('PAYMENT_PROVIDER_UNAVAILABLE', 'Could not connect the payout account right now. Please try again shortly.', 502);
  }

  await db.query(
    `UPDATE brands SET razorpay_linked_account_id = $1, linked_account_status = $2 WHERE id = $3`,
    [acc.id, acc.status || 'created', brand.id]
  );

  return success(res, {
    linked_account_id:     acc.id,
    linked_account_status: acc.status || 'created',
  }, 201);
});

module.exports = { getPayoutAccount, createPayoutAccount };
