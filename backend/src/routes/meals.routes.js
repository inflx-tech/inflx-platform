'use strict';

/**
 * meals.routes.js — INFLX Meals (P1 thin vertical slice).
 * Mounted at /meals in routes/index.js.
 *
 * One router: authenticate once, then gate each route by role inline
 * (restaurant endpoints need 'brand', customer endpoints need
 * 'follower'). Per-route gating avoids a shared role middleware
 * wrongly intercepting the other audience's calls on the same prefix.
 */

const { Router } = require('express');
const ctrl = require('../controllers/meals.controller');
const { authenticate, authenticateOptional, requireRole } = require('../middleware/auth');

const router = Router();

// ── Public — customer in-store Offers tab (no auth required) ─────────────────
router.get('/store/:brandId', authenticateOptional, ctrl.getStore);

// Everything below requires authentication.
router.use(authenticate);

// ── Restaurant side (brand) ──────────────────────────────────────────────────
router.get('/config',              requireRole('brand'), ctrl.getConfig);
router.put('/config',              requireRole('brand'), ctrl.putConfig);
router.get('/slots',               requireRole('brand'), ctrl.listSlots);
router.post('/slots',              requireRole('brand'), ctrl.createSlot);
router.get('/offer-rules',          requireRole('brand'), ctrl.listOfferRules);
router.post('/offer-rules',         requireRole('brand'), ctrl.createOfferRule);
router.post('/offer-rules/suggest', requireRole('brand'), ctrl.suggestOffers);
router.post('/restaurant-chat',     requireRole('brand'), ctrl.restaurantChat);
router.patch('/offer-rules/:id',    requireRole('brand'), ctrl.updateOfferRule);
router.get('/dashboard',           requireRole('brand'), ctrl.getDashboard);
router.post('/orders/:id/deliver', requireRole('brand'), ctrl.deliverOrder);

// ── Customer side (follower) ─────────────────────────────────────────────────
router.post('/chat',               requireRole('follower'), ctrl.chat);
router.post('/intents',            requireRole('follower'), ctrl.createIntent);
router.post('/intents/:id/offers', requireRole('follower'), ctrl.computeOffers);
router.post('/orders',             requireRole('follower'), ctrl.lockAndPay);
router.get('/orders/:id',          requireRole('follower'), ctrl.getOrder);

module.exports = router;
