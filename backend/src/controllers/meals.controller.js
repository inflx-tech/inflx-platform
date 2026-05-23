'use strict';

/**
 * meals.controller.js — INFLX Meals HTTP layer (P1 thin vertical slice).
 *
 * Restaurant side (brand auth):
 *   PUT  /meals/config              — enable Meals + set radius/limits/clock
 *   POST /meals/slots               — create a meal slot (lunch/dinner)
 *   POST /meals/offer-rules         — create an offer rule
 *   POST /meals/orders/:id/deliver  — mark an order delivered (manual)
 *
 * Customer side (follower auth):
 *   POST /meals/intents                  — state an intent
 *   POST /meals/intents/:id/offers       — compute the deterministic shortlist
 *   POST /meals/orders                   — lock + pay an offer
 *   GET  /meals/orders/:id               — track an order
 *
 * Thin wrappers over meals.service — all rupee math lives in the service.
 */

const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const meals = require('../services/meals.service');

// ── Restaurant side ──────────────────────────────────────────────────────────

const putConfig = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const config = await meals.upsertConfig(brandId, req.body || {});
  return success(res, { config });
});

const createSlot = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const slot = await meals.createSlot(brandId, req.body || {});
  return success(res, { slot }, 201);
});

const createOfferRule = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const rule = await meals.createOfferRule(brandId, req.body || {});
  return success(res, { offer_rule: rule }, 201);
});

const deliverOrder = asyncHandler(async (req, res) => {
  const order = await meals.markDelivered(req.user.sub, req.params.id);
  return success(res, { order });
});

const getConfig = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const config = await meals.getConfig(brandId);
  return success(res, { config });
});

const listSlots = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const slots = await meals.listSlots(brandId);
  return success(res, { slots });
});

const listOfferRules = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const rules = await meals.listOfferRules(brandId, {
    party_size: req.query.party_size || null,
    status: req.query.status || null,
  });
  return success(res, { offer_rules: rules });
});

const updateOfferRule = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const rule = await meals.updateOfferRule(brandId, req.params.id, req.body || {});
  return success(res, { offer_rule: rule });
});

const getDashboard = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const data = await meals.getDashboard(brandId, {
    slot_date: req.query.slot_date || null,
    slot_id: req.query.slot_id || null,
  });
  return success(res, data);
});

// Public — the customer in-store Offers tab (C0).
const getStore = asyncHandler(async (req, res) => {
  const data = await meals.getStore(req.params.brandId);
  return success(res, data);
});

// ── Customer side ────────────────────────────────────────────────────────────

const createIntent = asyncHandler(async (req, res) => {
  const intent = await meals.createIntent(req.user.sub, req.body || {});
  return success(res, { intent }, 201);
});

const computeOffers = asyncHandler(async (req, res) => {
  const result = await meals.computeOffers(req.params.id);
  return success(res, result);
});

const lockAndPay = asyncHandler(async (req, res) => {
  const { meal_offer_id } = req.body || {};
  if (!meal_offer_id) throw new AppError('VALIDATION_ERROR', 'meal_offer_id is required', 422);
  const order = await meals.lockAndPay(req.user.sub, meal_offer_id);
  return success(res, { order }, 201);
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await meals.getOrder(req.user.sub, req.params.id);
  return success(res, { order });
});

const chat = asyncHandler(async (req, res) => {
  const { message, slot_date, brand_id, drop_location, partial_intent } = req.body || {};
  const result = await meals.chat(req.user.sub, {
    message: message || null,
    slot_date: slot_date || null,
    brand_id: brand_id || null,
    drop_location: drop_location || null,
    partial_intent: partial_intent || null,
  });
  return success(res, result);
});

// ── Admin — platform Meals settings (admin radius + tolerance + lead) ────────
const adminGetSettings = asyncHandler(async (_req, res) => {
  const settings = await meals.getPlatformSettings();
  return success(res, { settings });
});

const adminPutSettings = asyncHandler(async (req, res) => {
  const settings = await meals.updatePlatformSettings(req.body || {});
  return success(res, { settings });
});

const suggestOffers = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const result = await meals.suggestOffersForBrand(brandId);
  return success(res, result);
});

// P-RCHAT — restaurant chat to create an offer in natural language.
const restaurantChat = asyncHandler(async (req, res) => {
  const brandId = await meals.brandIdForUser(req.user.sub);
  const { message, partial_offer } = req.body || {};
  const result = await meals.restaurantChatCreateOffer(brandId, {
    message: message || null,
    partial_offer: partial_offer || null,
  });
  return success(res, result);
});

module.exports = {
  putConfig,
  createSlot,
  createOfferRule,
  deliverOrder,
  getConfig,
  listSlots,
  listOfferRules,
  updateOfferRule,
  getDashboard,
  getStore,
  createIntent,
  computeOffers,
  lockAndPay,
  getOrder,
  chat,
  adminGetSettings,
  adminPutSettings,
  suggestOffers,
  restaurantChat,
};
