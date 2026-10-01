'use strict';

/**
 * Wallet sub-router — mounted at /brands/me/wallet inside brand.routes.js
 * All routes here require authenticate + requireRole('brand') (enforced by parent).
 */

const { Router } = require('express');
const ctrl = require('../controllers/wallet.controller');

const router = Router();

router.get('/',                   ctrl.getWallet);
router.post('/topup',             ctrl.createTopup);
router.post('/topup/verify',      ctrl.verifyTopup);
router.get('/transactions',       ctrl.getTransactions);
// Item 17 — the wallet's reads and the one withdrawal model (rules v1.31 §17A).
router.get('/withdraw',           ctrl.withdrawOptions);
router.get('/locked',             ctrl.getLocked);
router.get('/sales',              ctrl.getSales);
router.get('/sales/:lineId',      ctrl.getSale);
router.get('/history',            ctrl.getHistory);
router.post('/withdraw',          ctrl.requestWithdrawal);
router.get('/withdrawals',        ctrl.listWithdrawals);

module.exports = router;
