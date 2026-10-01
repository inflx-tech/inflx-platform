'use strict';

/**
 * Item 17 — the Wallet. Mounted at '/'.
 * Contract: features/item17-wallet · master rules v1.31 §17A · boards CW1–CW7 (creator), AM1–AM12 (Admin)
 *
 * The brand's wallet routes live in wallet.routes.js (under /brands/me/wallet), where they always
 * were. This file holds the creator's wallet and Admin's Money section.
 */

const { Router } = require('express');
const { authenticate, requireRole, requireApproved, requireCapability } = require('../middleware/auth');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const walletRead = require('../services/walletRead.service');
const withdrawals = require('../services/withdrawalRequest.service');
const adminMoney = require('../services/adminMoney.service');

const router = Router();
const creator = [authenticate, requireRole('influencer')];
const W = '/influencers/me/wallet';

async function her(req) {
  const i = await walletRead.creatorOf(req.user.sub);
  if (!i) throw new AppError('NOT_FOUND', 'Creator profile not found', 404);
  return i;
}

// ── Creator ──────────────────────────────────────────────────────────────────
// CW1/CW2 — Available, On hold, Still to come.
router.get(W, ...creator, asyncHandler(async (req, res) => {
  const i = await her(req);
  const opt = await withdrawals.options('creator', req.user.sub);
  return success(res, {
    figures: await walletRead.creatorSummary(i.id),
    withdrawal_waiting: opt.open,
    details: { has_upi: i.has_upi, has_bank_account: i.has_bank },
  });
}));
// CW3 — her collaboration payments, with their dates.
router.get(`${W}/payments`, ...creator, asyncHandler(async (req, res) => success(res, await walletRead.creatorPayments((await her(req)).id))));
// CW4 — commission per collaboration and per sale.
router.get(`${W}/commission`, ...creator, asyncHandler(async (req, res) =>
  success(res, await walletRead.creatorCommission((await her(req)).id, { filter: req.query.filter, limit: req.query.limit, offset: req.query.offset }))));
// CW7 — history in her words.
router.get(`${W}/history`, ...creator, asyncHandler(async (req, res) =>
  success(res, { rows: await walletRead.creatorHistory((await her(req)).id, { filter: req.query.filter, limit: req.query.limit, offset: req.query.offset }) })));
// CW5/CW6 — the withdrawal request. The full amount; nothing deducted (TDS paused, W6).
router.get(`${W}/withdraw`, ...creator, asyncHandler(async (req, res) => success(res, await withdrawals.options('creator', req.user.sub))));
router.post(`${W}/withdraw`, ...creator, requireApproved, asyncHandler(async (req, res) => {
  const b = req.body || {};
  return success(res, { withdrawal: await withdrawals.request('creator', req.user.sub, { amount: b.amount, method: b.method }) }, 201);
}));
router.get(`${W}/withdrawals`, ...creator, asyncHandler(async (req, res) => success(res, { withdrawals: await withdrawals.listMine('creator', req.user.sub) })));

// ── Admin · Money (one section; rules v1.31 §17A) ────────────────────────────
const admin = [authenticate, requireCapability('payouts')];
const M = '/admin/money';
const ok = (fn) => asyncHandler(async (req, res) => success(res, await fn(req)));

router.get(`${M}/overview`, ...admin, ok(() => adminMoney.overview()));                                               // AM1
router.get(`${M}/withdrawals`, ...admin, ok((req) => withdrawals.adminList({ status: req.query.status })));            // AM2
router.get(`${M}/withdrawals/:id`, ...admin, ok((req) => withdrawals.adminOne(req.params.id)));                        // AM3 (full account)
router.post(`${M}/withdrawals/:id/processed`, ...admin, ok((req) => withdrawals.markProcessed(req.user.sub, req.params.id, req.body || {})));          // AM3
router.post(`${M}/withdrawals/:id/could-not-process`, ...admin, ok((req) => withdrawals.couldNotProcess(req.user.sub, req.params.id, req.body || {}))); // AM4
router.get(`${M}/balances`, ...admin, ok((req) => adminMoney.balances({ kind: req.query.kind, q: req.query.q })));     // AM5
router.get(`${M}/balances/:kind/:id`, ...admin, ok((req) => adminMoney.person(req.params.kind, req.params.id, { tab: req.query.tab }))); // AM6
router.get(`${M}/sales`, ...admin, ok((req) => adminMoney.sales({ filter: req.query.filter, limit: req.query.limit, offset: req.query.offset, month: req.query.month }))); // AM7
router.get(`${M}/collaborations`, ...admin, ok((req) => adminMoney.collaborations({ tab: req.query.tab })));           // AM8
router.get(`${M}/added`, ...admin, ok((req) => adminMoney.added({ limit: req.query.limit, offset: req.query.offset }))); // AM9
router.post(`${M}/added/:orderId/credit`, ...admin, ok((req) => adminMoney.creditTopup(req.user.sub, req.params.orderId, req.body || {}))); // AM9
router.get(`${M}/movements`, ...admin, ok((req) => adminMoney.movements({ q: req.query.q, group: req.query.group, limit: req.query.limit, offset: req.query.offset }))); // AM10
router.get(`${M}/corrections`, ...admin, ok(() => adminMoney.corrections()));                                          // AM11
router.post(`${M}/corrections/release-payment`, ...admin, ok((req) => adminMoney.releasePayment(req.user.sub, req.body || {})));
router.post(`${M}/corrections/return-locked`, ...admin, ok((req) => adminMoney.returnLocked(req.user.sub, req.body || {})));
router.post(`${M}/corrections/correct-balance`, ...admin, ok((req) => adminMoney.correctBalance(req.user.sub, req.body || {})));

module.exports = router;
