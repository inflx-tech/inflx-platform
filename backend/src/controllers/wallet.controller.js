'use strict';

const crypto   = require('crypto');
const Razorpay = require('razorpay');
const db       = require('../config/db');
const env      = require('../config/env');
const { success } = require('../utils/response');
const AppError    = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toPaise, fromPaise } = require('../utils/money');

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

  // Also fetch total deposited and escrow locked
  const { rows: txRows } = await db.query(
    `SELECT COALESCE(SUM(amount),0) AS total_deposited
     FROM wallet_transactions
     WHERE brand_id = $1 AND type = 'topup' AND direction = 'credit'`,
    [brand.id]
  );
  const { rows: escrowRows } = await db.query(
    `SELECT COALESCE(SUM(amount),0) AS escrow_locked
     FROM wallet_transactions
     WHERE brand_id = $1 AND type = 'escrow_lock' AND direction = 'debit'`,
    [brand.id]
  );

  return success(res, {
    wallet: {
      wallet_balance:  parseFloat(brand.wallet_balance),
      escrow_locked:   parseFloat(escrowRows[0].escrow_locked),
      total_deposited: parseFloat(txRows[0].total_deposited),
      brand_id:        brand.id,
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
       RETURNING *`,
      [brand.id, amountRupees, newBalance, razorpay_payment_id, 'Wallet top-up via Razorpay']
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

  return success(res, { transactions: rows }, 200, { page: pageNum, limit: limitNum, total });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { getWallet, createTopup, verifyTopup, getTransactions };
