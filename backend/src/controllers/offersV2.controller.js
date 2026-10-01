'use strict';

/**
 * offersV2.controller — the brand website's offer builder. Contract: features/offer-builder-v2
 * Mounted under /brands/me (brandOffer.routes.js). Every call is the signed-in brand's own; another
 * brand's offer, pool line, gift item or product answers 404.
 */

const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const life = require('../services/offerLife.service');
const pool = require('../services/offerPool.service');
const gifts = require('../services/giftItems.service');
const { todayInIndia } = require('../utils/indiaDay');

const brandOf = (req) => life.brandIdFor(req.user.sub);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const listParam = (v) => (v === undefined || v === '' ? [] : (Array.isArray(v) ? v : String(v).split(',')).map((s) => String(s).trim()).filter(Boolean));

// ── offers ───────────────────────────────────────────────────────────────────
const list = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const data = await life.list(brandId, { type: req.query.type, q: req.query.q, status: req.query.status, on: req.query.on });
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const offer = await life.createDraft(brandId, req.body || {});
  return success(res, { offer }, 201);
});

const getOne = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  return success(res, await life.view(brandId, req.params.id));
});

const update = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const { notes } = await life.updateDraft(brandId, req.params.id, req.body || {});
  return success(res, { ...(await life.view(brandId, req.params.id)), notes });
});

const remove = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  return success(res, await life.deleteDraft(brandId, req.params.id));
});

// ── the pool ─────────────────────────────────────────────────────────────────
const addSource = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  await life.addSource(brandId, req.params.id, req.body || {});
  return success(res, await life.view(brandId, req.params.id), 201);
});

const removeSource = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  await life.removeSource(brandId, req.params.id, req.params.sourceId);
  return success(res, await life.view(brandId, req.params.id));
});

const candidates = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const offer = await life.getOwn(brandId, req.params.id);
  if (req.query.kind === 'gift_items') {
    return success(res, { gift_items: await pool.giftItemCandidates(offer) });
  }
  const filters = {
    leaf_ids: listParam(req.query.leaf_ids),
    brands: listParam(req.query.brands),
    price_min: req.query.price_min, price_max: req.query.price_max,
  };
  const products = await pool.candidates(offer, {
    node: req.query.node || null, filters, q: req.query.q ? String(req.query.q) : null,
    from: offer.status === 'draft' ? null : life.joinsFrom(offer),
  });
  return success(res, { products });
});

const filterOptions = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  if (!req.query.node) throw new AppError('VALIDATION_ERROR', 'Choose a category.', 422, 'node');
  return success(res, await pool.filterOptions(brandId, req.query.node));
});

// ── publishing and after ─────────────────────────────────────────────────────
const publish = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const seen = Array.isArray(req.body && req.body.seen_product_ids) ? req.body.seen_product_ids : null;
  try {
    const out = await life.publish(brandId, req.params.id, { seenProductIds: seen });
    return success(res, out);
  } catch (e) {
    if (e.code === 'PUBLISH_BLOCKED' && e.details) {
      return res.status(422).json({ success: false, error: { code: e.code, message: e.message, field: null }, data: { checks: e.details.checks } });
    }
    throw e;
  }
});

const endNow = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  return success(res, await life.endNow(brandId, req.params.id));
});

const removePreview = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  return success(res, await life.removePreview(brandId, req.params.id, listParam(req.query.product_ids)));
});

const removeProducts = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const ids = Array.isArray(req.body && req.body.product_ids) ? req.body.product_ids : [];
  return success(res, await life.removeProducts(brandId, req.params.id, ids));
});

const addProducts = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const ids = Array.isArray(req.body && req.body.product_ids) ? req.body.product_ids : [];
  return success(res, await life.addProducts(brandId, req.params.id, ids));
});

// ── Listings ─────────────────────────────────────────────────────────────────
const productsWithoutOffers = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const day = DATE_RE.test(String(req.query.date || '')) ? req.query.date : todayInIndia();
  const products = await pool.productsWithoutOffers(brandId, {
    day, q: req.query.q ? String(req.query.q) : null, node: req.query.node || null,
    price_min: req.query.price_min, price_max: req.query.price_max,
  });
  return success(res, { date: day, products });
});

const offersByProduct = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const ids = listParam(req.query.product_ids);
  return success(res, { products: await pool.offersByProduct(brandId, { productIds: ids.length ? ids : null }) });
});

const productOfferPanel = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  const map = await pool.offersByProduct(brandId, { productIds: [req.params.productId] });
  const e = map[req.params.productId] || { now: null, next: null };
  let creators = 0;
  if (e.now) creators = (await life.creatorsOf(e.now.offer_id)).length;
  return success(res, { now: e.now ? { ...e.now, creators, posts: 0 } : null, next: e.next });
});

const priceImpact = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  if (!req.query.product_id) throw new AppError('VALIDATION_ERROR', 'Which product?', 422, 'product_id');
  return success(res, await life.priceImpact(brandId, String(req.query.product_id), req.query.price));
});

// ── gift items ───────────────────────────────────────────────────────────────
const listGiftItems = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  return success(res, { gift_items: await gifts.list(brandId) });
});
const createGiftItem = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  return success(res, { gift_item: await gifts.create(brandId, req.body || {}) }, 201);
});
const updateGiftItem = asyncHandler(async (req, res) => {
  const brandId = await brandOf(req);
  return success(res, { gift_item: await gifts.update(brandId, req.params.id, req.body || {}) });
});

module.exports = {
  list, create, getOne, update, remove, addSource, removeSource, candidates, filterOptions,
  publish, endNow, removePreview, removeProducts, addProducts,
  productsWithoutOffers, offersByProduct, productOfferPanel, priceImpact,
  listGiftItems, createGiftItem, updateGiftItem,
};
