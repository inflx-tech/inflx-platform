'use strict';

/**
 * contract.routes.js
 * Phase 3 — Blocks A & B
 *
 * GET  /v1/contracts/:campaign_influencer_id   — fetch contract + deliverables
 * POST /v1/contracts/:id/sign                  — influencer signs
 * POST /v1/contracts/:id/brand-sign            — brand countersigns
 */

const { Router } = require('express');
const { authenticate, authenticateWithQuery, requireRole } = require('../middleware/auth');
const {
  getContract, sign, brandSign, bulkBrandSign, listBrandPending,
  getContractPdf, getContractPdfUrl, regeneratePdf, retryContractCreate,
  approveContract,
} = require('../controllers/contract.controller');

const router = Router();

// Brand inbox: list all pending_brand contracts across all campaigns.
// Declared BEFORE the wildcard /:campaign_influencer_id route.
router.get(
  '/brand/pending',
  authenticate,
  requireRole('brand'),
  listBrandPending
);

// Brand mass-countersign multiple contracts atomically. Body: { ids: [...] }.
router.post(
  '/bulk-sign',
  authenticate,
  requireRole('brand'),
  bulkBrandSign
);

// Stream contract PDF — must be declared BEFORE the wildcard /:campaign_influencer_id.
// Uses authenticateWithQuery so brand-web can embed it in an <iframe> using
// ?download_token=<jwt>; mobile passes the token via Authorization header in WebView.
router.get(
  '/:id/pdf',
  authenticateWithQuery,
  requireRole('brand', 'influencer'),
  getContractPdf
);

// Either party: ensures the PDF is uploaded to R2 and returns a short-lived
// presigned GET URL. This is the preferred path — the signed URL works in
// any browser / Android download manager / Google Docs Viewer without an
// Authorization header (fixes the "0 KB download" issue).
router.get(
  '/:id/pdf-url',
  authenticate,
  requireRole('brand', 'influencer'),
  getContractPdfUrl
);

// Brand-only: force-regenerate the stored PDF (clears pdf_generation_error)
router.post(
  '/:id/regenerate-pdf',
  authenticate,
  requireRole('brand'),
  regeneratePdf
);

// Either party: retry contract auto-create if it failed at offer-accept time
router.post(
  '/by-ci/:ciId/retry',
  authenticate,
  requireRole('brand', 'influencer'),
  retryContractCreate
);

// Fetch contract by campaign_influencer_id (brand or influencer)
router.get(
  '/:campaign_influencer_id',
  authenticate,
  requireRole('brand', 'influencer'),
  getContract
);

// Influencer signs contract
router.post(
  '/:id/sign',
  authenticate,
  requireRole('influencer'),
  sign
);

// Brand approves draft + (optionally) attaches clauses & bonus, then sends to influencer
router.post(
  '/:id/approve',
  authenticate,
  requireRole('brand'),
  approveContract
);

// Brand countersigns contract
router.post(
  '/:id/brand-sign',
  authenticate,
  requireRole('brand'),
  brandSign
);

module.exports = router;
