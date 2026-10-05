'use strict';

/**
 * shopperOrders.controller.js — ordering for the shopper app, and the brand's parcels.
 * Contract: features/shopper-ordering · rules v1.13 §6.
 *
 * Deal pages and bag prices work for guests (their bag lives on the phone, 5.2); everything that
 * places, pays, lists or cancels an order needs her signed in (O8).
 */

const checkout = require('../services/shopperCheckout.service');
const orders = require('../services/shopperOrders.service');
const sp = require('../services/shopperPosts.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const db = require('../config/db');

const me = (req) => checkout.followerIdOf(req.user.sub);
const deviceOf = (req) => String(req.headers['x-device-id'] || '').slice(0, 128) || null;
const ok = (fn) => asyncHandler(async (req, res) => success(res, await fn(req)));

async function brandIdOf(req) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [req.user.sub]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  return rows[0].id;
}

/** The bag, priced, as the bag screen reads it (O6, O7, D11). */
async function bagOut(followerId) {
  const lines = await checkout.readBag(followerId);
  const priced = lines.length ? await checkout.priceBag(lines) : null;
  if (priced) delete priced._contexts;
  return { lines, priced };
}

module.exports = {
  // ── the deal page (D1, P, B, V, K, G) ─────────────────────────────────────
  deal: ok(async (req) => orders.dealPage(req.params.id, await sp.resolveWho(sp.whoOf(req)))),
  dealPrice: ok((req) => orders.priceDeal(req.params.id, (req.body || {}).lines)),

  // ── the bag (O6, O7, O8) ──────────────────────────────────────────────────
  bagPrice: ok(async (req) => { const b = await checkout.priceBag((req.body || {}).lines || []); delete b._contexts; return b; }),
  getBag: ok(async (req) => bagOut(await me(req))),
  putBag: ok(async (req) => { const fid = await me(req); await checkout.writeBag(fid, (req.body || {}).lines || []); return bagOut(fid); }),
  mergeBag: ok(async (req) => { const fid = await me(req); await checkout.mergeIntoBag(fid, (req.body || {}).lines || []); return bagOut(fid); }),

  // ── review and pay (O11, O12, O13) ────────────────────────────────────────
  review: ok(async (req) => checkout.publicReview(await checkout.review(await me(req), req.body || {}))),
  place: ok(async (req) => checkout.place(await me(req), req.body || {}, { deviceId: deviceOf(req) })),
  verify: ok(async (req) => checkout.verify(await me(req), req.body || {})),
  // shopper-app-fixes (F1): she cancelled the payment, or it failed — release what was held for it.
  abandon: ok(async (req) => checkout.abandon(await me(req), req.params.id)),
  checkoutDetail: ok(async (req) => orders.checkoutDetail(await me(req), req.params.id)),

  // ── my orders (O14, O15) and cancelling (O16, O17) ───────────────────────
  listOrders: ok(async (req) => orders.listOrders(await me(req), req.query || {})),
  lineDetail: ok(async (req) => orders.lineDetail(await me(req), req.params.id)),
  cancelPreview: ok(async (req) => orders.cancelPreview(await me(req), req.params.id)),
  // shopper-walk-fixes (W14): the shopper's Return, on a delivered item inside INFLX's return window.
  returnPreview: ok(async (req) => require('../services/shopperReturns.service').preview(await me(req), req.params.id)),
  returnRequest: ok(async (req) => require('../services/shopperReturns.service').request({ followerId: await me(req), lineId: req.params.id, reason: (req.body || {}).reason, note: (req.body || {}).note })),
  cancel: ok(async (req) => orders.cancel({ actor: 'shopper', followerId: await me(req), lineId: req.params.id,
    reason: (req.body || {}).reason, note: (req.body || {}).note })),

  // ── the brand (S10) ───────────────────────────────────────────────────────
  brandParcels: ok(async (req) => orders.brandParcels(await brandIdOf(req), req.query || {})),
  brandStatus: ok(async (req) => orders.setParcelStatus({ brandId: await brandIdOf(req), orderId: req.params.id, ...(req.body || {}) })),
  brandCancel: ok(async (req) => orders.cancel({ actor: 'brand', brandId: await brandIdOf(req), lineId: req.params.id,
    reason: (req.body || {}).reason, note: (req.body || {}).note })),

  // ── INFLX admin ───────────────────────────────────────────────────────────
  adminStatus: ok((req) => orders.setParcelStatus({ orderId: req.params.id, ...(req.body || {}) })),
  adminCancel: ok((req) => orders.cancel({ actor: 'admin', lineId: req.params.id, reason: (req.body || {}).reason, note: (req.body || {}).note })),
};
