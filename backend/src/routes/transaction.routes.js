'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/transaction.controller');

const router = Router();

const followerAuth = [authenticate, requireRole('follower')];

// ── Pay-at-store ──────────────────────────────────────────────────────────────
router.post('/pay-at-store',        ...followerAuth, ctrl.initiatePayAtStore);
router.post('/pay-at-store/verify', ...followerAuth, ctrl.verifyPayAtStore);

// ── Store-direct (Offer Engine D2) — buy a store-published offer, no influencer
router.post('/store-offer/pay',     ...followerAuth, ctrl.initiateStoreOfferPay);
router.post('/store-offer/verify',  ...followerAuth, ctrl.verifyStoreOfferPay);

// ── Slots ─────────────────────────────────────────────────────────────────────
router.get('/slots', ctrl.getSlots); // no auth — publicly accessible

// ── Pre-booking (table / slot / appointment) ────────────────────────────────
router.post('/prebook',        ...followerAuth, ctrl.initiatePrebook);
router.post('/prebook/verify', ...followerAuth, ctrl.verifyPrebook);

// ── Pre-booking (date_range — car_rental, hotels) ───────────────────────────
router.post('/prebook-daterange',        ...followerAuth, ctrl.initiatePrebookDateRange);
router.post('/prebook-daterange/verify', ...followerAuth, ctrl.verifyPrebookDateRange);

// ── Activity ──────────────────────────────────────────────────────────────────
router.get('/activity',       ...followerAuth, ctrl.listActivity);

// The old online checkout (cart/price, orders, orders/verify, order list/detail/cancel, and the
// brand's status route on this path) was retired on 30 Sep 2026 with shopper-ordering: it priced
// with the retired offer engine and moved no stock or money on cancel. Ordering now lives in
// follower.routes.js (/follower/bag, /checkout/*, /orders) — contract features/shopper-ordering.

module.exports = router;
