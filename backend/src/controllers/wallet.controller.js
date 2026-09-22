'use strict';

const crypto   = require('crypto');
const Razorpay = require('razorpay');
const db       = require('../config/db');
const env      = require('../config/env');
const { success } = require('../utils/response');
const AppError    = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toPaise, fromPaise } = require('../utils/money');
// Item 11 — money in settles what is owed (v1.27 §11.2, approval Q4).
const remoteMoney = require('../services/remoteMoney.service');
const paymentConfigSvc = require('../services/paymentConfig.service');

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay client (lazy — only initialised when RAZORPAY_MOCK=false)
// ─────────────────────────────────────────────────────────────────────────────
let _rzp = null;
function getRzp() {
  if (!_rzp) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new AppError('INTERNAL_ERROR', 'Razorpay keys not configured in .env', 500);
    }
    _rzp = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return _rzp;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory store for pending orders (mock mode only)
// Maps order_id → { amount, brandId }
// ─────────────────────────────────────────────────────────────────────────────
const pendingOrders = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getBrandOrThrow(userId) {
  const { rows } = await db.query(
    `SELECT id, user_id, wallet_balance FROM brands WHERE user_id = $1`,
    [userId]
  );
  if (!rows[0]) {
    throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);
  }
  return rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/wallet
// ─────────────────────────────────────────────────────────────────────────────

const getWallet = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);

  // Wave 2 — single-pass ledger aggregation for the Available / Reserved /
  // Settled breakdown. All computed from wallet_transactions (the audit
  // ledger); brands.wallet_balance is the live spendable figure (already
  // net of locks + payouts), so it IS "available".
  //
  //   total_loaded     = lifetime top-ups − refunds out
  //   reserved_balance = escrow_lock debits − escrow_release credits
  //                      (funds committed to active campaigns, not yet released)
  //   settled_balance  = payout debits (funds that have left the wallet to
  //                      influencers via tranche releases)
  //   available_balance = brands.wallet_balance (live spendable / withdrawable)
  const { rows } = await db.query(
    `SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'topup'          AND direction = 'credit'), 0) AS total_topup,
        COALESCE(SUM(amount) FILTER (WHERE type = 'refund'         AND direction = 'debit'),  0) AS total_refund_out,
        COALESCE(SUM(amount) FILTER (WHERE type = 'escrow_lock'    AND direction = 'debit'),  0) AS lock_debits,
        COALESCE(SUM(amount) FILTER (WHERE type = 'escrow_release' AND direction = 'credit'), 0) AS release_credits,
        COALESCE(SUM(amount) FILTER (WHERE type = 'payout'         AND direction = 'debit'),  0) AS payout_debits
       FROM wallet_transactions
      WHERE brand_id = $1`,
    [brand.id]
  );
  const r = rows[0];
  const totalLoaded      = parseFloat(r.total_topup) - parseFloat(r.total_refund_out);
  const reservedBalance  = Math.max(0, parseFloat(r.lock_debits) - parseFloat(r.release_credits));
  const settledBalance   = parseFloat(r.payout_debits);
  const availableBalance = parseFloat(brand.wallet_balance);

  return success(res, {
    wallet: {
      brand_id:          brand.id,
      // Wave 2 — three-state breakdown (named fields)
      total_loaded:      totalLoaded,
      available_balance: availableBalance,
      reserved_balance:  reservedBalance,
      settled_balance:   settledBalance,
      // Backward-compatible legacy fields (pre-Wave-2 consumers)
      wallet_balance:    availableBalance,
      escrow_locked:     reservedBalance,
      total_deposited:   parseFloat(r.total_topup),
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/wallet/topup
//
// Accepts `amount` in RUPEES from the client. Converts to paise only at the
// Razorpay API boundary (orders API + mock store). The order response carries
// `amount` in rupees for the client; the order body sent to Razorpay is paise.
// ─────────────────────────────────────────────────────────────────────────────

const createTopup = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const amountRupees = parseFloat(req.body.amount);

  if (!amountRupees || amountRupees < 1) {
    throw new AppError('VALIDATION_ERROR', 'amount must be at least ₹1', 422, 'amount');
  }

  const amountPaise = toPaise(amountRupees);

  if (env.RAZORPAY_MOCK) {
    const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    // Mock pending order keeps RUPEES internally; paise only for the API response.
    pendingOrders.set(orderId, { amountRupees, brandId: brand.id });
    console.log(`[RAZORPAY MOCK] Created order ${orderId} for \u20B9${amountRupees}`);

    return success(res, {
      order_id: orderId,
      amount: amountPaise,   // paise — Razorpay checkout requires this
      currency: 'INR',
      key_id: env.RAZORPAY_KEY_ID,
    }, 201);
  }

  // ── Live mode: call Razorpay Orders API (paise) ─────────────────────────
  const receipt = `brand_${brand.id.slice(0, 8)}_${Date.now()}`;
  let order;
  try {
    order = await getRzp().orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt,
      notes:    { brand_id: brand.id, type: 'wallet_topup' },
    });
  } catch (err) {
    console.error('[RAZORPAY] orders.create failed:', err?.error || err.message);
    throw new AppError('INTERNAL_ERROR', `Razorpay order creation failed: ${err?.error?.description || err.message}`, 500);
  }

  return success(res, {
    order_id: order.id,
    amount:   order.amount,   // paise — Razorpay's echo; checkout needs this
    currency: order.currency,
    key_id:   env.RAZORPAY_KEY_ID,
  }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/wallet/topup/verify
// Verifies Razorpay payment signature and credits the brand wallet.
// ─────────────────────────────────────────────────────────────────────────────

const verifyTopup = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    throw new AppError('VALIDATION_ERROR', 'razorpay_order_id and razorpay_payment_id are required', 422);
  }

  // Determine the verified amount in RUPEES. We accept paise from Razorpay
  // at the boundary and immediately convert.
  let amountRupees;

  if (env.RAZORPAY_MOCK) {
    const pending = pendingOrders.get(razorpay_order_id);
    if (!pending) {
      throw new AppError('NOT_FOUND', 'Order not found or already processed', 404);
    }
    amountRupees = pending.amountRupees;
    pendingOrders.delete(razorpay_order_id);
    console.log(`[RAZORPAY MOCK] Verified payment ${razorpay_payment_id} — \u20B9${amountRupees}`);
  } else {
    // ── Verify HMAC signature ──────────────────────────────────────────────
    if (!razorpay_signature) {
      throw new AppError('VALIDATION_ERROR', 'razorpay_signature is required', 422);
    }

    const body        = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSig = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      throw new AppError('UNAUTHORIZED', 'Payment signature verification failed', 401);
    }

    // ── Fetch order amount from Razorpay (source of truth) ────────────────
    let rzpOrder;
    try {
      rzpOrder = await getRzp().orders.fetch(razorpay_order_id);
    } catch (err) {
      console.error('[RAZORPAY] orders.fetch failed:', err?.error || err.message);
      throw new AppError('INTERNAL_ERROR', `Could not verify order with Razorpay: ${err?.error?.description || err.message}`, 500);
    }

    if (rzpOrder.status !== 'paid') {
      throw new AppError('VALIDATION_ERROR', `Order status is "${rzpOrder.status}", expected "paid"`, 422);
    }

    amountRupees = fromPaise(rzpOrder.amount);
  }

  // ── Credit wallet atomically (rupees everywhere inside our DB) ──────────
  let newBalance;
  let transaction;
  let duesSettled = [];

  await db.withTransaction(async (client) => {
    const { rows: brandRows } = await client.query(
      `SELECT wallet_balance FROM brands WHERE id = $1 FOR UPDATE`,
      [brand.id]
    );
    const currentBalance = parseFloat(brandRows[0].wallet_balance);
    newBalance = parseFloat((currentBalance + amountRupees).toFixed(2));

    await client.query(
      `UPDATE brands SET wallet_balance = $1 WHERE id = $2`,
      [newBalance, brand.id]
    );

    const { rows: txRows } = await client.query(
      `INSERT INTO wallet_transactions
         (brand_id, type, amount, direction, balance_after, razorpay_payment_id, notes)
       VALUES ($1, 'topup', $2, 'credit', $3, $4, $5)
       RETURNING *`,   // item 11: dues are settled from this credit, below
      [brand.id, amountRupees, newBalance, razorpay_payment_id, 'Wallet top-up via Razorpay']
    );
    transaction = txRows[0];

    // Item 11 (v1.27 §11.2, approval Q4) — MONEY IN SETTLES WHAT IS OWED.
    // A courier charge that arrived when the wallet was short became a brand_dues row rather
    // than blocking anything. It comes off the top of the next money in, oldest first, only as
    // far as this credit reaches, and inside THIS transaction — so a settled due and the money
    // that settled it can never come apart.
    duesSettled = (await remoteMoney.settleDuesFromCredit(client, brand.id, amountRupees)).settled;
    if (duesSettled.length) {
      newBalance = await remoteMoney.available(brand.id, client);
    }
  });

  return success(res, {
    wallet_balance: newBalance,
    transaction,
    dues_settled: duesSettled,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/wallet/transactions
// ─────────────────────────────────────────────────────────────────────────────

const getTransactions = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { page = '1', limit = '20' } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset   = (pageNum - 1) * limitNum;

  const { rows } = await db.query(
    `SELECT * FROM wallet_transactions
     WHERE brand_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [brand.id, limitNum, offset]
  );

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM wallet_transactions WHERE brand_id = $1`,
    [brand.id]
  );
  const total = parseInt(countRows[0].count, 10);

  return success(res, { transactions: rows }, 200, { page: pageNum, limit: limitNum, total });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/wallet/withdraw  { amount, method }   (Wave 2 commit 2)
//
// Admin-gated brand payout. This endpoint validates + reserves funds only:
// it debits the wallet immediately (so the brand can't double-spend the same
// balance) and writes a 'pending' brand_withdrawals row. The RazorpayX payout
// fires later, when an admin approves it in /admin/payouts.
//
// SECURITY: the payout destination is read SERVER-SIDE from
// brands.listing_data.bank_details. The client supplies only { amount, method }
// — it can never redirect funds to an arbitrary account.
// ─────────────────────────────────────────────────────────────────────────────

const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, method } = req.body;
  const amountRupees = parseFloat(amount);

  if (!amountRupees || isNaN(amountRupees) || amountRupees <= 0) {
    throw new AppError('VALIDATION_ERROR', 'amount is required and must be a positive number', 422, 'amount');
  }
  if (!['upi', 'bank_transfer'].includes(method)) {
    throw new AppError('VALIDATION_ERROR', 'method must be upi or bank_transfer', 422, 'method');
  }

  const { rows: brandRows } = await db.query(
    `SELECT b.id, b.business_name, b.wallet_balance, b.listing_data
       FROM brands b
      WHERE b.user_id = $1`,
    [req.user.sub]
  );
  if (!brandRows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);
  const brand = brandRows[0];

  // Resolve payout destination from listing_data.bank_details (server-side).
  const bank = (brand.listing_data && brand.listing_data.bank_details) || {};
  let upiId = null, bankAccountNo = null, bankIfsc = null, accountHolder = null;
  if (method === 'upi') {
    if (!bank.upi_id) {
      throw new AppError('PAYMENT_METHOD_MISSING', 'No UPI ID on file. Add one in your wallet bank details first.', 422);
    }
    upiId = bank.upi_id;
  } else {
    if (!bank.account_number || !bank.ifsc_code) {
      throw new AppError('PAYMENT_METHOD_MISSING', 'No bank account on file. Add account number + IFSC in your wallet bank details first.', 422);
    }
    bankAccountNo = bank.account_number;
    bankIfsc      = bank.ifsc_code;
    accountHolder = bank.account_holder_name || brand.business_name;
  }

  const cfg = await paymentConfigSvc.getConfig();
  const minWithdrawal = parseFloat(cfg.minWithdrawalInr);
  if (amountRupees < minWithdrawal) {
    throw new AppError('WITHDRAWAL_TOO_SMALL', `Minimum withdrawal amount is ₹${minWithdrawal}`, 422);
  }
  if (amountRupees > parseFloat(brand.wallet_balance)) {
    throw new AppError('INSUFFICIENT_BALANCE', 'Insufficient wallet balance', 422);
  }

  let withdrawal;
  await db.withTransaction(async (client) => {
    const { rows: lockRows } = await client.query(
      `SELECT wallet_balance FROM brands WHERE id = $1 FOR UPDATE`,
      [brand.id]
    );
    const liveBalance = parseFloat(lockRows[0].wallet_balance);
    if (amountRupees > liveBalance) {
      throw new AppError('INSUFFICIENT_BALANCE', 'Insufficient wallet balance', 422);
    }
    const newBalance = parseFloat((liveBalance - amountRupees).toFixed(2));

    await client.query(
      `UPDATE brands SET wallet_balance = $1 WHERE id = $2`,
      [newBalance, brand.id]
    );

    const { rows: wRows } = await client.query(
      `INSERT INTO brand_withdrawals
         (brand_id, amount_requested, method, upi_id, bank_account_no, bank_ifsc, account_holder_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [brand.id, amountRupees, method, upiId, bankAccountNo, bankIfsc, accountHolder]
    );
    withdrawal = wRows[0];

    // Audit ledger row. type='withdrawal' is intentionally distinct from
    // 'payout' (which getWallet attributes to influencer settlements), so the
    // Available/Reserved/Settled breakdown is unaffected.
    await client.query(
      `INSERT INTO wallet_transactions
         (brand_id, type, amount, direction, balance_after, notes)
       VALUES ($1, 'withdrawal', $2, 'debit', $3, $4)`,
      [brand.id, amountRupees, newBalance, 'Withdrawal requested — pending admin approval']
    );
  });

  return success(res, {
    withdrawal_id:    withdrawal.id,
    amount_requested: parseFloat(withdrawal.amount_requested),
    method:           withdrawal.method,
    status:           withdrawal.status,
  }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/wallet/withdrawals
// ─────────────────────────────────────────────────────────────────────────────

const listWithdrawals = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { rows } = await db.query(
    `SELECT id AS withdrawal_id, amount_requested, method, status,
            failure_reason, created_at, completed_at
       FROM brand_withdrawals
      WHERE brand_id = $1
      ORDER BY created_at DESC`,
    [brand.id]
  );
  return success(res, { withdrawals: rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { getWallet, createTopup, verifyTopup, getTransactions, requestWithdrawal, listWithdrawals };
