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

module.exports = router;
