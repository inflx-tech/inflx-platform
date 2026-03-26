'use strict';

const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/env');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// In-memory store for pending Razorpay orders (mock mode only).
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

  return success(res, {
    wallet_balance: brand.wallet_balance,
    brand_id: brand.id,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/wallet/topup
// Creates a Razorpay order (or mock order) for the given amount.
// ─────────────────────────────────────────────────────────────────────────────

const createTopup = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { amount } = req.body;

  if (!amount || parseFloat(amount) <= 0) {
    throw new AppError('VALIDATION_ERROR', 'amount must be greater than 0', 422, 'amount');
  }

  const amountNum = parseFloat(amount);

  if (env.RAZORPAY_MOCK) {
    // Generate a mock order ID and store the amount in memory
    const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    pendingOrders.set(orderId, { amount: amountNum, brandId: brand.id });
    console.log(`[RAZORPAY MOCK] Created order ${orderId} for ₹${amountNum}`);

    return success(res, {
      order_id: orderId,
      amount: amountNum,
      currency: 'INR',
      key_id: env.RAZORPAY_KEY_ID,
    }, 201);
  }

  // Production: call Razorpay Orders API
  // POST https://api.razorpay.com/v1/orders
  // { amount: amountNum * 100, currency: 'INR', receipt: 'brand_topup_...' }
  throw new AppError('INTERNAL_ERROR', 'Set RAZORPAY_MOCK=false to enable live payments', 500);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/wallet/topup/verify
// Verifies payment and credits the brand wallet.
// When RAZORPAY_MOCK=true, skips HMAC check and auto-credits.
// ─────────────────────────────────────────────────────────────────────────────

const verifyTopup = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    throw new AppError(
      'VALIDATION_ERROR',
      'razorpay_order_id and razorpay_payment_id are required',
      422
    );
  }

  let amount;

  if (env.RAZORPAY_MOCK) {
    // In mock mode, look up the pending order to get the amount
    const pending = pendingOrders.get(razorpay_order_id);
    if (!pending) {
      throw new AppError('NOT_FOUND', 'Order not found or already processed', 404);
    }
    amount = pending.amount;
    pendingOrders.delete(razorpay_order_id);
    console.log(`[RAZORPAY MOCK] Verified payment ${razorpay_payment_id} for order ${razorpay_order_id} ₹${amount}`);
  } else {
    // Production: verify HMAC signature
    if (!razorpay_signature) {
      throw new AppError('VALIDATION_ERROR', 'razorpay_signature is required', 422);
    }
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      throw new AppError('UNAUTHORIZED', 'Invalid payment signature', 401);
    }

    // In production, fetch order amount from Razorpay API
    // For now, throw — implement when going live
    throw new AppError('INTERNAL_ERROR', 'Set RAZORPAY_MOCK=false to enable live payments', 500);
  }

  // Credit wallet atomically
  let newBalance;
  let transaction;

  await db.withTransaction(async (client) => {
    // Get current balance (row-lock for concurrency safety)
    const { rows: brandRows } = await client.query(
      `SELECT wallet_balance FROM brands WHERE id = $1 FOR UPDATE`,
      [brand.id]
    );
    const currentBalance = parseFloat(brandRows[0].wallet_balance);
    newBalance = currentBalance + amount;

    // Update wallet balance
    await client.query(
      `UPDATE brands SET wallet_balance = $1 WHERE id = $2`,
      [newBalance, brand.id]
    );

    // Record wallet transaction
    const { rows: txRows } = await client.query(
      `INSERT INTO wallet_transactions
         (brand_id, type, amount, direction, balance_after, razorpay_payment_id, notes)
       VALUES ($1, 'topup', $2, 'credit', $3, $4, $5)
       RETURNING *`,
      [brand.id, amount, newBalance, razorpay_payment_id, 'Wallet top-up via Razorpay']
    );
    transaction = txRows[0];
  });

  return success(res, {
    wallet_balance: newBalance,
    transaction,
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

  return success(res, { transactions: rows }, 200, {
    page: pageNum,
    limit: limitNum,
    total,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { getWallet, createTopup, verifyTopup, getTransactions };
