'use strict';

/**
 * razorpayRoute.service.js — Wave 3 (commerce settlement).
 *
 * Razorpay Route: a brand's payout destination is a "linked account"; a
 * captured follower payment is split to that account via a "transfer". This
 * is what lets a single customer payment route the brand's net share to the
 * brand automatically.
 *
 * Mock / live split via env.RAZORPAY_MOCK (same convention as the rest of the
 * platform). In MOCK mode every call returns synthetic IDs so the full
 * settlement flow is testable WITHOUT Route being enabled. The LIVE paths are
 * built against the Razorpay Route API but stay DORMANT until
 * RAZORPAY_MOCK=false AND Route is enabled on the Razorpay account. The exact
 * live response shapes get validated then; mock is what the test suite covers.
 *
 * Contract: features/wave3-commerce-settlement-foundation/.
 */

const env = require('../config/env');

function isMock() {
  return String(env.RAZORPAY_MOCK).toLowerCase() === 'true';
}

let _client = null;
function _getClient() {
  if (_client) return _client;
  const Razorpay = require('razorpay');
  _client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return _client;
}

/**
 * Create a Route linked account for a brand (its payout destination).
 * @param {object} brand    — { id, business_name }
 * @param {object} details  — { email, phone, legal_business_name, business_type,
 *                              contact_name, category, legal_info, addresses }
 * @returns {Promise<{ id: string, status: string }>}
 */
async function createLinkedAccount(brand, details = {}) {
  if (isMock()) {
    return { id: `acc_mock_${String(brand.id).slice(0, 8)}_${Date.now()}`, status: 'created' };
  }
  // LIVE (dormant until Route enabled) — Razorpay Accounts API.
  const client = _getClient();
  const acc = await client.accounts.create({
    email:               details.email,
    phone:               details.phone,
    type:                'route',
    legal_business_name: details.legal_business_name || brand.business_name,
    business_type:       details.business_type || 'proprietorship',
    contact_name:        details.contact_name || brand.business_name,
    profile: {
      category:    details.category || 'ecommerce',
      subcategory: details.subcategory || undefined,
      addresses:   details.addresses || undefined,
    },
    legal_info: details.legal_info || undefined, // { pan, gst }
  });
  return { id: acc.id, status: acc.status || 'created' };
}

/**
 * Fetch a linked account's current status (for onboarding reconciliation).
 * @returns {Promise<{ id: string, status: string }>}
 */
async function getLinkedAccountStatus(accountId) {
  if (isMock()) return { id: accountId, status: 'activated' };
  const client = _getClient();
  const acc = await client.accounts.fetch(accountId);
  return { id: acc.id, status: acc.status };
}

/**
 * Transfer a brand's settled share from a captured payment to its linked
 * account. amountPaise = the brand's net (gross − commission − platform fee −
 * TCS), at the Razorpay paise boundary.
 * @returns {Promise<{ id: string, status: string, amount: number }>}
 */
async function createTransfer({ paymentId, accountId, amountPaise, notes }) {
  if (isMock()) {
    return { id: `trf_mock_${Date.now()}`, status: 'processed', amount: Math.round(amountPaise) };
  }
  const client = _getClient();
  const res = await client.payments.transfer(paymentId, {
    transfers: [{
      account:  accountId,
      amount:   Math.round(amountPaise),
      currency: 'INR',
      notes:    notes || {},
    }],
  });
  const t = Array.isArray(res?.items) ? res.items[0] : (res?.transfers?.[0] || res);
  return { id: t?.id, status: t?.status || 'created', amount: t?.amount };
}

module.exports = { isMock, createLinkedAccount, getLinkedAccountStatus, createTransfer };
