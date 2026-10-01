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
// Item 17 — the wallet's reads, and the one withdrawal model.
const walletRead = require('../services/walletRead.service');
const withdrawals = require('../services/withdrawalRequest.service');

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

  // Item 17 (rules v1.31 §17A, BW1): the four figures, each from its own source.
  const figures = await walletRead.brandSummary(brand.id);
  const open = (await withdrawals.options('brand', req.user.sub)).open;
  // The older "reserved" figure (the website's home page and older phone builds read it) is now the
  // same number: what is locked in escrow rows. Worked out from ledger rows, it could never come
  // down when INFLX returned locked money to the brand.
  const reservedNow = figures.locked;

  return success(res, {
    figures,                      // { available, onHold, locked, lockedCount, salesComing, salesComingCount }
    withdrawal_waiting: open,     // the request on hold, or null (BW2)
    wallet: {
      brand_id:          brand.id,
      // Wave 2 — three-state breakdown (named fields)
      total_loaded:      totalLoaded,
      available_balance: availableBalance,
      reserved_balance:  reservedNow,
      settled_balance:   settledBalance,
      // Backward-compatible legacy fields (pre-Wave-2 consumers)
      wallet_balance:    availableBalance,
      escrow_locked:     reservedNow,
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
    // Item 17: the order is a ROW now (the in-memory map was emptied by every restart).
    await db.query(`INSERT INTO wallet_topup_orders (order_id, brand_id, amount) VALUES ($1, $2, $3)`, [orderId, brand.id, amountRupees]);
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

  await db.query(
    `INSERT INTO wallet_topup_orders (order_id, brand_id, amount) VALUES ($1, $2, $3) ON CONFLICT (order_id) DO NOTHING`,
    [order.id, brand.id, amountRupees]);

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
    const { rows: [pending] } = await db.query(
      `SELECT amount, brand_id FROM wallet_topup_orders WHERE order_id = $1`, [razorpay_order_id]);
    if (!pending || pending.brand_id !== brand.id) {
      throw new AppError('NOT_FOUND', 'Order not found', 404);
    }
    amountRupees = parseFloat(pending.amount);
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
    // Item 17 (review): every Razorpay order on this account shares one key — a shopper's order or
    // a plan upgrade verifies with the same signature. Only an order createTopup made for THIS
    // brand (it stamps both notes) may become wallet money.
    const orderNotes = rzpOrder.notes || {};
    if (orderNotes.type !== 'wallet_topup' || orderNotes.brand_id !== brand.id) {
      throw new AppError('NOT_FOUND', 'Order not found', 404);
    }

    amountRupees = fromPaise(rzpOrder.amount);
  }

  // ── Credit wallet atomically (rupees everywhere inside our DB) ──────────
  const credited = await creditTopup({ brandId: brand.id, orderId: razorpay_order_id, paymentId: razorpay_payment_id, amountRupees, how: 'verify' });
  return success(res, credited);
});

/**
 * Item 17 (rules v1.31 §17A, check 1) — ONE credit per payment, however often verify is called
 * and whoever calls it (the phone, a retry, or Admin's repair, AM9). The order row is taken
 * FOR UPDATE and its status is the compare-and-swap; the unique index on the payment id is the
 * backstop. A second call returns the same balance and moves nothing.
 */
async function creditTopup({ brandId, orderId, paymentId, amountRupees, how, adminUserId = null }) {
  let newBalance;
  let transaction;
  let duesSettled = [];
  let already = false;
  const brand = { id: brandId };
  const razorpay_payment_id = paymentId;

  await db.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO wallet_topup_orders (order_id, brand_id, amount) VALUES ($1, $2, $3) ON CONFLICT (order_id) DO NOTHING`,
      [orderId, brandId, amountRupees]);
    const { rows: [ord] } = await client.query(`SELECT * FROM wallet_topup_orders WHERE order_id = $1 FOR UPDATE`, [orderId]);
    if (ord.brand_id !== brandId) throw new AppError('NOT_FOUND', 'Order not found', 404);
    const { rows: [dup] } = await client.query(
      `SELECT * FROM wallet_transactions WHERE type = 'topup' AND razorpay_payment_id = $1`, [paymentId]);
    if (ord.status === 'credited' || dup) {
      already = true;
      transaction = dup || null;
      const { rows: [b] } = await client.query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brandId]);
      newBalance = parseFloat(b.wallet_balance);
      if (ord.status !== 'credited') {
        await client.query(`UPDATE wallet_topup_orders SET status = 'credited', payment_id = $2, credited_at = now(), credited_how = $3 WHERE order_id = $1`, [orderId, paymentId, how]);
      }
      return;
    }
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
    await client.query(
      `UPDATE wallet_topup_orders SET status = 'credited', payment_id = $2, credited_at = now(), credited_how = $3, credited_by = $4 WHERE order_id = $1`,
      [orderId, paymentId, how, adminUserId]);
  });

  return { wallet_balance: newBalance, transaction, dues_settled: duesSettled, already_credited: already };
}

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
// Item 17 — withdrawals, the one model (rules v1.31 §17A; BW7–BW9).
//
// A request puts the amount ON HOLD at once; INFLX pays it from its bank and marks it processed,
// and only then does the brand's total go down. No approval step and no automatic payout — the
// Wave 2 flow (debit at request, admin approve → RazorpayX) is retired; `brand_withdrawals` keeps
// its history and is no longer written. The destination is the brand's own saved bank account
// (brands.bank_account_no + bank_ifsc, the ONE place it is stored), read on the server.
// ─────────────────────────────────────────────────────────────────────────────

/** GET /brands/me/wallet/withdraw — what the Withdraw screen needs (available, minimum, where to, what blocks it). */
const withdrawOptions = asyncHandler(async (req, res) => success(res, await withdrawals.options('brand', req.user.sub)));

/** POST /brands/me/wallet/withdraw { amount } */
const requestWithdrawal = asyncHandler(async (req, res) => {
  const w = await withdrawals.request('brand', req.user.sub, { amount: (req.body || {}).amount, method: 'bank' });
  return success(res, { withdrawal: w, withdrawal_id: w.id, amount_requested: w.amount, status: w.status }, 201);
});

/** GET /brands/me/wallet/withdrawals */
const listWithdrawals = asyncHandler(async (req, res) => success(res, { withdrawals: await withdrawals.listMine('brand', req.user.sub) }));

// ── Item 17 — the reads behind BW3–BW6 and BW10 ─────────────────────────────

/** GET /brands/me/wallet/locked — locked money, collaboration by collaboration (BW3, BW4). */
const getLocked = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  return success(res, await walletRead.brandLocked(brand.id));
});

/** GET /brands/me/wallet/sales?filter=all|coming|added|cancelled — every sale and its three shares (BW5). */
const getSales = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  return success(res, await walletRead.brandSales(brand.id, { filter: req.query.filter, limit: req.query.limit, offset: req.query.offset }));
});

/** GET /brands/me/wallet/sales/:lineId — one sale (BW6). */
const getSale = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const sale = /^[0-9a-f-]{36}$/i.test(req.params.lineId) ? await walletRead.brandSale(brand.id, req.params.lineId) : null;
  if (!sale) throw new AppError('NOT_FOUND', 'Not found', 404);
  return success(res, { sale });
});

/** GET /brands/me/wallet/history?filter=all|added|collaborations|sales|withdrawals|courier — in plain words (BW10). */
const getHistory = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  return success(res, { rows: await walletRead.brandHistory(brand.id, { filter: req.query.filter, limit: req.query.limit, offset: req.query.offset }) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getWallet, createTopup, verifyTopup, creditTopup, getTransactions,
  withdrawOptions, requestWithdrawal, listWithdrawals, getLocked, getSales, getSale, getHistory,
};
