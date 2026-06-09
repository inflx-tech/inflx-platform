'use strict';

/**
 * influencerStore.controller.js — influencer storefront stocking endpoints
 * (contract: influencer-store-foundation). Auth: requireRole('influencer').
 *
 * Routes (mounted under /influencers/me in influencer.routes.js):
 *   GET    /influencers/me/store/items        — my stocked store
 *   GET    /influencers/me/store/stockable     — products I'm allowed to stock (contracted brands)
 *   POST   /influencers/me/store/items         — shelve a product { product_id, note? }
 *   DELETE /influencers/me/store/items/:id      — remove (archive) a shelved product
 */

const db = require('../config/db');
const store = require('../services/influencerStore.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function getInfluencerId(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

const listMyStore = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  if (!influencerId) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return success(res, { items: await store.listStore(influencerId) });
});

const listStockable = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  if (!influencerId) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const items = await store.listStockable(influencerId);
  const brands = await store.getContractedBrandIds(influencerId);
  return success(res, { items, contracted_brand_count: brands.length });
});

const stockItem = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  if (!influencerId) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const { product_id, note } = req.body || {};
  if (!product_id) throw new AppError('VALIDATION_ERROR', 'product_id is required', 422, 'product_id');

  const r = await store.stockProduct(influencerId, product_id, note);
  if (!r.ok) {
    const statusByCode = { NOT_FOUND: 404, FORBIDDEN: 403, VALIDATION_ERROR: 422 };
    throw new AppError(r.code, r.message, statusByCode[r.code] || 400, 'product_id');
  }
  return success(res, { item: r.item }, 201);
});

const unstockItem = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  if (!influencerId) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const r = await store.unstockProduct(influencerId, req.params.id);
  if (!r.ok) throw new AppError('NOT_FOUND', 'Stocked item not found', 404);
  return success(res, { removed: true });
});

module.exports = { listMyStore, listStockable, stockItem, unstockItem };
