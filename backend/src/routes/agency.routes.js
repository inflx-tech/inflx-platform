'use strict';

/**
 * Agency routes — Strategic Partner Agency profile, wallet, withdrawals.
 * Mounted at /agencies/* by routes/index.js. Contract 3a.
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/agency.controller');

const router = Router();

router.post('/register',        authenticate, requireRole('agency'), ctrl.register);
router.get('/me',               authenticate, requireRole('agency'), ctrl.getMe);
router.patch('/me',             authenticate, requireRole('agency'), ctrl.updateMe);
router.post('/me/withdraw',     authenticate, requireRole('agency'), ctrl.initiateWithdrawal);
router.get('/me/withdrawals',   authenticate, requireRole('agency'), ctrl.listWithdrawals);

module.exports = router;
