'use strict';

/**
 * remoteShoot.controller.js — the HTTP layer over the Remote shoot (item 11).
 * Contract: features/item11-remote · F1–F17 · approval §3.9
 *
 * Thin on purpose: auth and shape here, rules in the services. Every route in item11.routes.js
 * already carries `authenticate → requireRole → requireApproved`; the services carry the gate
 * and the mode check, and they load SCOPED TO THE CALLER so anything that is not yours is a
 * 404, never a 403 (item 10's rule, check 37).
 */

const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const shoot = require('../services/remoteShoot.service');
const address = require('../services/remoteAddress.service');
const parcel = require('../services/remoteParcel.service');
const ret = require('../services/remoteReturn.service');

/** The brand asks through its own campaign and set; the creator through her own collaboration. */
const brandScope = (req) => ({
  side: 'brand', userId: req.user.sub,
  campaignId: req.params.id, setId: req.params.sid,
});
const creatorScope = (req) => ({ side: 'creator', userId: req.user.sub });

const send = (res, data) => success(res, { shoot: data });

/* ── F1 ── */
const brandRead   = asyncHandler(async (req, res) => send(res, await shoot.read(req.params.ciId, brandScope(req))));
const creatorRead = asyncHandler(async (req, res) => send(res, await shoot.read(req.params.ciId, creatorScope(req))));

/* ── F2, F3, F4 — her address ── */
const coverage = asyncHandler(async (req, res) =>
  success(res, await address.coverage(req.params.ciId, creatorScope(req), req.body?.pincode)));
const sendAddress = asyncHandler(async (req, res) =>
  send(res, await address.send(req.params.ciId, creatorScope(req), req.body || {})));
const correctAddress = asyncHandler(async (req, res) =>
  send(res, await address.correct(req.params.ciId, creatorScope(req), req.body || {})));

/* ── F5, F6, F7 — the products and the price ── */
const products = asyncHandler(async (req, res) =>
  success(res, await parcel.products(req.params.ciId, brandScope(req), {
    q: req.query.q || null, cursor: req.query.cursor || null, limit: req.query.limit,
  })));
const saveLines = asyncHandler(async (req, res) =>
  send(res, await parcel.saveLines(req.params.ciId, brandScope(req), req.body || {})));
const quote = asyncHandler(async (req, res) =>
  success(res, await parcel.quote(req.params.ciId, brandScope(req), req.body || {})));

/* ── F8–F11 — the parcel ── */
const book = asyncHandler(async (req, res) =>
  send(res, await parcel.book(req.params.ciId, brandScope(req), req.body || {})));
const label = asyncHandler(async (req, res) =>
  success(res, await parcel.label(req.params.ciId, brandScope(req))));
/** The bytes, for the R2_MOCK path and for a client that would rather stream. */
const labelPdf = asyncHandler(async (req, res) => {
  const pdf = await parcel.labelStream(req.params.shipmentId, req.user.sub);
  res.setHeader('Content-Type', pdf.contentType);
  res.setHeader('Content-Disposition', `inline; filename="label-${req.params.shipmentId}.pdf"`);
  return res.send(pdf.buffer);
});
const cancel = asyncHandler(async (req, res) =>
  send(res, await parcel.cancel(req.params.ciId, brandScope(req))));
const rebook = asyncHandler(async (req, res) =>
  send(res, await parcel.rebook(req.params.ciId, brandScope(req), req.body || {})));

/* ── F12–F14 — checking and the shoot ── */
const check = asyncHandler(async (req, res) =>
  send(res, await ret.check(req.params.ciId, creatorScope(req), req.body || {})));
const report = asyncHandler(async (req, res) =>
  send(res, await ret.report(req.params.ciId, brandScope(req), req.body || {})));
const acknowledge = asyncHandler(async (req, res) =>
  send(res, await ret.acknowledgeDifference(req.params.ciId, brandScope(req))));
const markDone = asyncHandler(async (req, res) =>
  send(res, await ret.markDone(req.params.ciId, creatorScope(req))));

/* ── F15–F17 — the return ── */
const returnToGift = asyncHandler(async (req, res) =>
  send(res, await ret.returnToGift(req.params.ciId, brandScope(req), req.params.lineId)));
const bookReturn = asyncHandler(async (req, res) =>
  send(res, await ret.bookReturn(req.params.ciId, creatorScope(req), req.body || {})));
const markSelfSent = asyncHandler(async (req, res) =>
  send(res, await ret.markSelfSent(req.params.ciId, creatorScope(req), req.body || {})));
const confirmReturn = asyncHandler(async (req, res) =>
  send(res, await ret.confirmReturn(req.params.ciId, brandScope(req), req.body || {})));

module.exports = {
  brandRead, creatorRead,
  coverage, sendAddress, correctAddress,
  products, saveLines, quote,
  book, label, labelPdf, cancel, rebook,
  check, report, acknowledge, markDone,
  returnToGift, bookReturn, markSelfSent, confirmReturn,
};
