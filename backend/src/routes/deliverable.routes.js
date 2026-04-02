'use strict';

/**
 * deliverable.routes.js
 * Phase 3 — Blocks C & D
 *
 * POST /v1/deliverables/:id/submit        — influencer submits content URL
 * POST /v1/deliverables/:id/review        — brand reviews (approve/request_revision)
 * POST /v1/deliverables/:id/submit-live   — influencer submits live public URL
 * POST /v1/deliverables/:id/confirm-live  — brand confirms content is live (T2 release)
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { getById, submit, review, submitLive, confirmLive } = require('../controllers/deliverable.controller');

const router = Router();

// Get single deliverable (brand or influencer)
router.get('/:id', authenticate, getById);

// Influencer submits content URL
router.post(
  '/:id/submit',
  authenticate,
  requireRole('influencer'),
  submit
);

// Brand reviews submitted content
router.post(
  '/:id/review',
  authenticate,
  requireRole('brand'),
  review
);

// Influencer submits live URL
router.post(
  '/:id/submit-live',
  authenticate,
  requireRole('influencer'),
  submitLive
);

// Brand confirms content is live → T2 release
router.post(
  '/:id/confirm-live',
  authenticate,
  requireRole('brand'),
  confirmLive
);

module.exports = router;
