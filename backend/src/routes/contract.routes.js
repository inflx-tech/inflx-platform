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
const { authenticate, requireRole } = require('../middleware/auth');
const { getContract, sign, brandSign } = require('../controllers/contract.controller');

const router = Router();

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

// Brand countersigns contract
router.post(
  '/:id/brand-sign',
  authenticate,
  requireRole('brand'),
  brandSign
);

module.exports = router;
