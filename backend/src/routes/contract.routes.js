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
  getContract, sign, brandSign,
  getContractPdf, regeneratePdf, retryContractCreate,
  approveContract,
} = require('../controllers/contract.controller');

const router = Router();

// Stream contract PDF — must be declared BEFORE the wildcard /:campaign_influencer_id.
// Uses authenticateWithQuery so brand-web can embed it in an <iframe> using
// ?download_token=<jwt>; mobile passes the token via Authorization header in WebView.
router.get(
  '/:id/pdf',
  authenticateWithQuery,
  requireRole('brand', 'influencer'),
  getContractPdf
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
