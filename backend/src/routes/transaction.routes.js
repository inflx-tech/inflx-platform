'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/transaction.controller');

const router = Router();

const followerAuth = [authenticate, requireRole('follower')];
const brandAuth    = [authenticate, requireRole('brand')];

// ── Pay-at-store ──────────────────────────────────────────────────────────────
router.post('/pay-at-store',        ...followerAuth, ctrl.initiatePayAtStore);
router.post('/pay-at-store/verify', ...followerAuth, ctrl.verifyPayAtStore);

// ── Slots ─────────────────────────────────────────────────────────────────────
router.get('/slots', ctrl.getSlots); // no auth — publicly accessible

// ── Pre-booking ───────────────────────────────────────────────────────────────
router.post('/prebook',        ...followerAuth, ctrl.initiatePrebook);
router.post('/prebook/verify', ...followerAuth, ctrl.verifyPrebook);

// ── Online orders ─────────────────────────────────────────────────────────────
router.post('/orders',        ...followerAuth, ctrl.placeOrder);
router.post('/orders/verify', ...followerAuth, ctrl.verifyOrder);
router.get('/orders',         ...followerAuth, ctrl.listOrders);
router.get('/orders/:id',     ...followerAuth, ctrl.getOrder);

// Brand-side order status update
router.patch('/orders/:id/status', ...brandAuth, ctrl.updateOrderStatus);

module.exports = router;
