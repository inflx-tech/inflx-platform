'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/influencer.controller');
const offerCtrl = require('../controllers/offer.controller');
const withdrawalCtrl = require('../controllers/withdrawal.controller');

const router = Router();

// ── Brand/Admin search endpoints (must come BEFORE /me/* to avoid shadowing) ─
router.get('/search', authenticate, requireRole('brand', 'admin'), ctrl.search);

// ── Influencer self-service routes ───────────────────────────────────────────
router.post('/register',  authenticate, requireRole('influencer'), ctrl.register);
router.get('/me',         authenticate, requireRole('influencer'), ctrl.getMe);
router.patch('/me',       authenticate, requireRole('influencer'), ctrl.updateMe);

// ── Offer inbox (Block B) ─────────────────────────────────────────────────────
router.get('/me/offers',   authenticate, requireRole('influencer'), offerCtrl.getMyOffers);

// ── Earnings overview (Phase 3 — Block E) ─────────────────────────────────────
router.get('/me/earnings', authenticate, requireRole('influencer'), ctrl.getEarnings);

// ── Withdrawals (Phase 5) ─────────────────────────────────────────────────────
router.post('/me/withdraw',              authenticate, requireRole('influencer'), withdrawalCtrl.initiateWithdrawal);
router.get('/me/withdrawals',            authenticate, requireRole('influencer'), withdrawalCtrl.listWithdrawals);
router.post('/me/withdrawals/:id/retry', authenticate, requireRole('influencer'), withdrawalCtrl.retryWithdrawal);

// ── Public profile view (brand + admin) ──────────────────────────────────────
router.get('/:id', authenticate, requireRole('brand', 'admin'), ctrl.getPublicById);

module.exports = router;
