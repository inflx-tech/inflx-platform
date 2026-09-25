'use strict';

/**
 * content.controller.js — the HTTP layer over the content step (item 12).
 * Contract: features/item12-content · G1–G13 · approval §3.7
 *
 * Thin on purpose, item 11's shape: auth and shape here, rules in the services. Every route in
 * item12.routes.js carries `authenticate → requireRole → requireApproved`; the service asks the
 * content gate SCOPED TO THE CALLER, so anything that is not yours is a 404, never a 403.
 */

const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const content = require('../services/content.service');

const brandScope = (req) => ({ side: 'brand', userId: req.user.sub, campaignId: req.params.id, setId: req.params.sid });
const creatorScope = (req) => ({ side: 'creator', userId: req.user.sub });
const adminScope = (req) => ({ side: 'admin', userId: req.user.sub });

/* ── G2, G3 — files (Phase 2b) ── */
const requestUpload = asyncHandler(async (req, res) =>
  success(res, { upload: await content.requestUpload(req.params.ciId, creatorScope(req), req.body || {}) }));
const confirmUpload = asyncHandler(async (req, res) =>
  success(res, { file: await content.confirmUpload(req.params.ciId, creatorScope(req), req.params.fileId) }));
const removeFile = asyncHandler(async (req, res) =>
  success(res, await content.removeFile(req.params.ciId, creatorScope(req), req.params.fileId)));

/* ── G12 — view a file ── */
const creatorFileUrl = asyncHandler(async (req, res) =>
  success(res, { view: await content.fileUrl(req.params.ciId, creatorScope(req), req.params.fileId) }));
const brandFileUrl = asyncHandler(async (req, res) =>
  success(res, { view: await content.fileUrl(req.params.ciId, brandScope(req), req.params.fileId) }));
const adminFileUrl = asyncHandler(async (req, res) =>
  success(res, { view: await content.fileUrl(req.params.ciId, adminScope(req), req.params.fileId) }));

/* ── The device proof (Phase 2b) ── */
const probe = require('../services/uploadProbe.service');
const probeStatus = asyncHandler(async (req, res) => success(res, probe.status()));
const probeUrl = asyncHandler(async (req, res) => success(res, await probe.url(req.user.sub, req.body || {})));
const probeConfirm = asyncHandler(async (req, res) => success(res, await probe.confirm(req.user.sub, req.body || {})));

module.exports = {
  brandScope, creatorScope, adminScope,
  requestUpload, confirmUpload, removeFile,
  creatorFileUrl, brandFileUrl, adminFileUrl,
  probeStatus, probeUrl, probeConfirm,
};
