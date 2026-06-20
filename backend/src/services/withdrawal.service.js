'use strict';

const axios             = require('axios');
const db                = require('../config/db');
const env               = require('../config/env');
const { decrypt }       = require('../utils/encrypt');
const { toPaise }       = require('../utils/money');
const paymentConfigSvc  = require('./paymentConfig.service');
const notificationService = require('./notification.service');
const ledgerService     = require('./ledger.service');

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Payout API helper
// Uses X-Payout API (RazorpayX) — separate key pair from Payment API
// ─────────────────────────────────────────────────────────────────────────────

// amountPaise is the only place paise lives in this file — it sits at the
// Razorpay API boundary. Everything else is rupees.
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
  // amountRequested is in RUPEES.
  const cfg = await paymentConfigSvc.getConfig();
  const minWithdrawal = parseFloat(cfg.minWithdrawalInr);
  if (amountRequested < minWithdrawal) {
    const err = new Error(`Minimum withdrawal amount is \u20B9${minWithdrawal}`);
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

  // Wave 1 — per-influencer TDS lookup:
  //   1. influencer.tds_exempt = true  → 0 TDS (e.g. exemption certificate on file)
  //   2. influencer.tds_override_pct   → use the per-influencer override
  //   3. fall back to global payment_config.tds_pct
  // Defensive: pre-M073 the new columns are undefined → safely falls through
  // to the global tds_pct (matches pre-Wave-1 behaviour).
  const effectiveTdsPct = influencer.tds_exempt
    ? 0
    : (influencer.tds_override_pct != null
        ? parseFloat(influencer.tds_override_pct)
        : parseFloat(cfg.tdsPct));
  const tdsDeducted = parseFloat((amountRequested * (effectiveTdsPct / 100)).toFixed(2));
  const netPaid     = parseFloat((amountRequested - tdsDeducted).toFixed(2));

  // ── Deduct wallet immediately (prevents double-withdrawal) ────────────────
  const { rows: deductRows } = await db.query(
    `UPDATE influencers SET wallet_balance = wallet_balance - $1 WHERE id = $2
     RETURNING wallet_balance`,
    [amountRequested, influencer.id]
  );
  // G-5 ledger: withdrawal debit from wallet_balance.
  await ledgerService.appendInfluencerLedger({
    client: db,
    influencerId: influencer.id,
    type: 'withdrawal',
    amount: amountRequested,
    direction: 'debit',
    balanceField: 'wallet_balance',
    balanceAfter: deductRows[0] ? parseFloat(deductRows[0].wallet_balance) : null,
    source: 'withdrawal',
    note: 'Withdrawal requested',
  });

  // ── Razorpay payout ───────────────────────────────────────────────────────
  let razorpayPayoutId;
  let status;
  const referenceId = `w_${influencer.id.slice(0, 8)}_${Date.now()}`;

  if (env.RAZORPAY_MOCK) {
    razorpayPayoutId = `mock_payout_${Date.now()}`;
    status           = 'completed';
    console.log(`[RAZORPAY MOCK] Payout ${razorpayPayoutId} \u2014 \u20B9${netPaid.toFixed(2)} via ${method}`);
  } else {
    try {
      const fundAccountId = await ensureFundAccount(influencer);
      const payoutRes = await createRazorpayPayout({
        fundAccountId,
        amountPaise:  toPaise(netPaid),
        purpose:      'payout',
        referenceId,
        narration:    'INFLX Influencer Payout',
      });
      razorpayPayoutId = payoutRes.id;
      // Razorpay payout status: queued → processing → processed / reversed
      status = payoutRes.status === 'processed' ? 'completed' : 'processing';
    } catch (err) {
      // Rollback wallet deduction on payout failure
      const { rows: revRows } = await db.query(
        `UPDATE influencers SET wallet_balance = wallet_balance + $1 WHERE id = $2
         RETURNING wallet_balance`,
        [amountRequested, influencer.id]
      );
      // G-5 ledger: withdrawal reversal credit back to wallet_balance.
      await ledgerService.appendInfluencerLedger({
        client: db,
        influencerId: influencer.id,
        type: 'withdrawal_reversal',
        amount: amountRequested,
        direction: 'credit',
        balanceField: 'wallet_balance',
        balanceAfter: revRows[0] ? parseFloat(revRows[0].wallet_balance) : null,
        source: 'withdrawal',
        note: 'Withdrawal reversed — Razorpay payout failed',
      });
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
  await notificationService.send({
    userId:   influencer.user_id,
    type:     'withdrawal.initiated',
    title:    status === 'completed' ? 'Withdrawal Processed' : 'Withdrawal Initiated',
    body:     `\u20B9${netPaid.toFixed(2)} sent to your ${method === 'upi' ? 'UPI' : 'bank account'}. TDS deducted: \u20B9${tdsDeducted.toFixed(2)}`,
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
  const { rows: refundRows } = await db.query(
    `UPDATE influencers SET wallet_balance = wallet_balance + $1 WHERE id = $2
     RETURNING wallet_balance`,
    [withdrawal.amount_requested, influencer.id]
  );
  // G-5 ledger: failed-withdrawal refund back to wallet before re-initiation.
  await ledgerService.appendInfluencerLedger({
    client: db,
    influencerId: influencer.id,
    type: 'withdrawal_reversal',
    amount: parseFloat(withdrawal.amount_requested),
    direction: 'credit',
    balanceField: 'wallet_balance',
    balanceAfter: refundRows[0] ? parseFloat(refundRows[0].wallet_balance) : null,
    source: 'withdrawal',
    sourceRefId: withdrawal.id,
    note: 'Failed withdrawal refunded for retry',
  });

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

// ─────────────────────────────────────────────────────────────────────────────
// Brand withdrawals (Wave 2 commit 2)
//
// Unlike influencers, brands have NO encrypted payment method on their profile.
// Their payout destination lives in brands.listing_data.bank_details (plaintext,
// saved from the wallet page) and is snapshotted onto the brand_withdrawals row
// at request time. So there is no decrypt step here. The wallet deduction +
// pending row are written by wallet.controller.requestWithdrawal; the actual
// RazorpayX payout only fires when an admin approves (admin-gated).
// ─────────────────────────────────────────────────────────────────────────────

async function ensureBrandFundAccount(brand, withdrawal) {
  const keyId     = env.RAZORPAY_PAYOUT_KEY_ID    || env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_PAYOUT_KEY_SECRET || env.RAZORPAY_KEY_SECRET;

  // ── Step 1: Create/reuse Razorpay Contact (stored on brands.razorpay_contact_id) ──
  let contactId = brand.razorpay_contact_id;
  if (!contactId) {
    const contactRes = await axios.post(
      'https://api.razorpay.com/v1/contacts',
      {
        name:         brand.business_name,
        type:         'customer',
        reference_id: brand.id,
        contact:      brand.phone,
      },
      { auth: { username: keyId, password: keySecret }, timeout: 10000 }
    );
    contactId = contactRes.data.id;
    await db.query(
      `UPDATE brands SET razorpay_contact_id = $1 WHERE id = $2`,
      [contactId, brand.id]
    );
  }

  // ── Step 2: Create Fund Account from the withdrawal-row snapshot (plaintext) ──
  let faPayload;
  if (withdrawal.method === 'upi') {
    faPayload = {
      contact_id:   contactId,
      account_type: 'vpa',
      vpa:          { address: withdrawal.upi_id },
    };
  } else {
    faPayload = {
      contact_id:   contactId,
      account_type: 'bank_account',
      bank_account: {
        name:           withdrawal.account_holder_name || brand.business_name,
        ifsc:           withdrawal.bank_ifsc,
        account_number: withdrawal.bank_account_no,
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

// Fires the RazorpayX payout for an approved brand withdrawal. The wallet was
// already debited at request time, so this neither deducts nor refunds — the
// admin.controller handles refund-on-failure. amount_requested is RUPEES; paise
// only crosses at the Razorpay boundary.
async function executeBrandPayout(brand, withdrawal) {
  const referenceId   = `bw_${withdrawal.id.slice(0, 8)}_${Date.now()}`;
  const fundAccountId = await ensureBrandFundAccount(brand, withdrawal);
  const payoutRes = await createRazorpayPayout({
    fundAccountId,
    amountPaise:  toPaise(parseFloat(withdrawal.amount_requested)),
    purpose:      'payout',
    referenceId,
    narration:    'INFLX Brand Withdrawal',
  });
  return {
    razorpayPayoutId: payoutRes.id,
    // Razorpay payout status: queued → processing → processed / reversed
    status: payoutRes.status === 'processed' ? 'completed' : 'processing',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agency withdrawals (Contract 3a)
//
// Mirrors the influencer path but with TDS 194H (brokerage, default 5% from
// payment_config.agency_tds_pct) instead of 194J/194C 10%. Agency payout fields
// (upi_id / bank_account_no) are AES-256-GCM encrypted like influencers'.
// ─────────────────────────────────────────────────────────────────────────────

async function ensureAgencyFundAccount(agency) {
  const keyId     = env.RAZORPAY_PAYOUT_KEY_ID     || env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_PAYOUT_KEY_SECRET  || env.RAZORPAY_KEY_SECRET;

  let contactId = agency.razorpay_contact_id;
  if (!contactId) {
    const contactRes = await axios.post(
      'https://api.razorpay.com/v1/contacts',
      {
        name:         agency.account_holder_name || agency.agency_name,
        type:         'vendor',
        reference_id: agency.id,
        email:        agency.contact_email || undefined,
        contact:      agency.phone,
      },
      { auth: { username: keyId, password: keySecret }, timeout: 10000 }
    );
    contactId = contactRes.data.id;
    await db.query(
      `UPDATE agencies SET razorpay_contact_id = $1 WHERE id = $2`,
      [contactId, agency.id]
    );
  }

  let faPayload;
  if (agency.upi_id) {
    faPayload = {
      contact_id:   contactId,
      account_type: 'vpa',
      vpa:          { address: decrypt(agency.upi_id) },
    };
  } else {
    faPayload = {
      contact_id:   contactId,
      account_type: 'bank_account',
      bank_account: {
        name:           agency.account_holder_name || agency.agency_name,
        ifsc:           agency.bank_ifsc,
        account_number: decrypt(agency.bank_account_no),
      },
    };
  }

  const faRes = await axios.post(
    'https://api.razorpay.com/v1/fund_accounts',
    faPayload,
    { auth: { username: keyId, password: keySecret }, timeout: 10000 }
  );
  return faRes.data.id;
}

async function initiateAgencyWithdrawal(agency, amountRequested, method) {
  // amountRequested is in RUPEES.
  const cfg = await paymentConfigSvc.getConfig();
  const minWithdrawal = parseFloat(cfg.minWithdrawalInr);
  if (amountRequested < minWithdrawal) {
    const err = new Error(`Minimum withdrawal amount is ₹${minWithdrawal}`);
    err.code = 'WITHDRAWAL_TOO_SMALL'; err.statusCode = 422;
    throw err;
  }

  const walletBalance = parseFloat(agency.wallet_balance);
  if (amountRequested > walletBalance) {
    const err = new Error('Insufficient wallet balance');
    err.code = 'INSUFFICIENT_BALANCE'; err.statusCode = 422;
    throw err;
  }

  if (!agency.upi_id && !agency.bank_account_no) {
    const err = new Error('No payment method on file. Please add UPI ID or bank account.');
    err.code = 'PAYMENT_METHOD_MISSING'; err.statusCode = 422;
    throw err;
  }

  // TDS 194H (brokerage) — agency override / exemption honored, else global
  // payment_config.agency_tds_pct (default 5%).
  const effectiveTdsPct = agency.tds_exempt
    ? 0
    : (agency.tds_override_pct != null
        ? parseFloat(agency.tds_override_pct)
        : parseFloat(cfg.agencyTdsPct));
  const tdsDeducted = parseFloat((amountRequested * (effectiveTdsPct / 100)).toFixed(2));
  const netPaid     = parseFloat((amountRequested - tdsDeducted).toFixed(2));

  // Deduct wallet immediately (prevents double-withdrawal)
  await db.query(
    `UPDATE agencies SET wallet_balance = wallet_balance - $1 WHERE id = $2`,
    [amountRequested, agency.id]
  );

  let razorpayPayoutId;
  let status;
  const referenceId = `aw_${agency.id.slice(0, 8)}_${Date.now()}`;

  if (env.RAZORPAY_MOCK) {
    razorpayPayoutId = `mock_payout_${Date.now()}`;
    status           = 'completed';
    console.log(`[RAZORPAY MOCK] Agency payout ${razorpayPayoutId} — ₹${netPaid.toFixed(2)} via ${method}`);
  } else {
    try {
      const fundAccountId = await ensureAgencyFundAccount(agency);
      const payoutRes = await createRazorpayPayout({
        fundAccountId,
        amountPaise:  toPaise(netPaid),
        purpose:      'payout',
        referenceId,
        narration:    'INFLX Agency Payout',
      });
      razorpayPayoutId = payoutRes.id;
      status = payoutRes.status === 'processed' ? 'completed' : 'processing';
    } catch (err) {
      // Rollback wallet deduction on payout failure
      await db.query(
        `UPDATE agencies SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
        [amountRequested, agency.id]
      );
      const msg = err?.response?.data?.error?.description || err.message;
      const e   = new Error(`Razorpay payout failed: ${msg}`);
      e.code = 'PAYOUT_FAILED'; e.statusCode = 502;
      throw e;
    }
  }

  const { rows } = await db.query(
    `INSERT INTO agency_withdrawals
       (agency_id, amount_requested, tds_deducted, net_paid, method,
        upi_id, bank_account_no, bank_ifsc, razorpay_payout_id, status, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      agency.id,
      amountRequested,
      tdsDeducted,
      netPaid,
      method,
      method === 'upi'           ? agency.upi_id          : null,
      method === 'bank_transfer' ? agency.bank_account_no : null,
      method === 'bank_transfer' ? agency.bank_ifsc       : null,
      razorpayPayoutId,
      status,
      status === 'completed' ? new Date() : null,
    ]
  );

  const withdrawal = rows[0];

  await notificationService.send({
    userId:   agency.user_id,
    type:     'withdrawal.initiated',
    title:    status === 'completed' ? 'Withdrawal Processed' : 'Withdrawal Initiated',
    body:     `₹${netPaid.toFixed(2)} sent to your ${method === 'upi' ? 'UPI' : 'bank account'}. TDS deducted: ₹${tdsDeducted.toFixed(2)}`,
    data:     { screen: 'withdrawals', withdrawal_id: withdrawal.id },
    fcmToken: agency.fcm_token,
    sendSms:  true,
    phone:    agency.phone,
  });

  return withdrawal;
}

module.exports = {
  initiateWithdrawal, retryWithdrawal, ensureBrandFundAccount, executeBrandPayout,
  initiateAgencyWithdrawal, ensureAgencyFundAccount,
};
