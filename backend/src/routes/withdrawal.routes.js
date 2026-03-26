'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/withdrawal.controller');

const router = Router();

router.post('/me/withdraw',              authenticate, requireRole('influencer'), ctrl.initiateWithdrawal);
router.get('/me/withdrawals',            authenticate, requireRole('influencer'), ctrl.listWithdrawals);
router.post('/me/withdrawals/:id/retry', authenticate, requireRole('influencer'), ctrl.retryWithdrawal);

module.exports = router;
