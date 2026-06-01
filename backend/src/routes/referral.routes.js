'use strict';

/**
 * Referral routes (non-admin) — the code-redeem flow.
 * Mounted at /referrals/* by routes/index.js. Contract 3a.
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/referral.controller');

const router = Router();

router.post('/redeem', authenticate, requireRole('brand', 'influencer'), ctrl.redeemCode);

module.exports = router;
