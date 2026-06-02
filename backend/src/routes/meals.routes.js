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
const { authenticate, authenticateOptional, requireRole, requireBrandFeature } = require('../middleware/auth');

const router = Router();

// ── Public — customer in-store Offers tab (no auth required) ─────────────────
router.get('/store/:brandId', authenticateOptional, ctrl.getStore);

// Everything below requires authentication.
router.use(authenticate);

// ── Restaurant side (brand) ──────────────────────────────────────────────────
// Meals is a restaurant-only vertical subsystem. requireBrandFeature('meals')
// gates every brand-side endpoint by the brand's category schema, so a brand
// of any other vertical (car_rental, fashion, …) gets 403 even on a direct
// API call. Only restaurant.json declares features.meals=true.
const mealsBrand = [requireRole('brand'), requireBrandFeature('meals')];
router.get('/config',              ...mealsBrand, ctrl.getConfig);
router.put('/config',              ...mealsBrand, ctrl.putConfig);
router.get('/slots',               ...mealsBrand, ctrl.listSlots);
router.post('/slots',              ...mealsBrand, ctrl.createSlot);
router.get('/offer-rules',          ...mealsBrand, ctrl.listOfferRules);
router.post('/offer-rules',         ...mealsBrand, ctrl.createOfferRule);
router.post('/offer-rules/suggest', ...mealsBrand, ctrl.suggestOffers);
router.post('/restaurant-chat',     ...mealsBrand, ctrl.restaurantChat);
router.post('/offer-rules/:id/modify-chat', ...mealsBrand, ctrl.modifyOfferChat);
router.patch('/offer-rules/:id',    ...mealsBrand, ctrl.updateOfferRule);
router.get('/menu-costs',           ...mealsBrand, ctrl.getMenuCosts);
router.put('/menu-costs',           ...mealsBrand, ctrl.upsertMenuCost);
router.get('/dashboard',           ...mealsBrand, ctrl.getDashboard);
router.post('/orders/:id/deliver', ...mealsBrand, ctrl.deliverOrder);

// ── Customer side (follower) ─────────────────────────────────────────────────
router.post('/chat',               requireRole('follower'), ctrl.chat);
router.post('/intents',            requireRole('follower'), ctrl.createIntent);
router.post('/intents/:id/offers', requireRole('follower'), ctrl.computeOffers);
router.post('/orders',             requireRole('follower'), ctrl.lockAndPay);
router.get('/orders/:id',          requireRole('follower'), ctrl.getOrder);

module.exports = router;
