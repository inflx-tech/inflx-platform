'use strict';

/**
 * deliverable.routes.js
 * Phase 3 — Blocks C & D + Media Upload
 *
 * GET  /v1/deliverables/:id               — get single deliverable (brand or influencer)
 * POST /v1/deliverables/:id/upload-url    — get presigned upload URL (influencer)
 * GET  /v1/deliverables/:id/media-url     — get download URL for media (brand or influencer)
 * POST /v1/deliverables/:id/submit        — influencer submits content URL or media_key
 * POST /v1/deliverables/:id/review        — brand reviews (approve/request_revision)
 * POST /v1/deliverables/:id/submit-live   — influencer submits live public URL
 * POST /v1/deliverables/:id/confirm-live  — brand confirms content is live (T2 release)
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { getById, submit, review, submitLive, confirmLive, getUploadUrl, getMediaUrl } = require('../controllers/deliverable.controller');

const router = Router();

// Get single deliverable (brand or influencer)
router.get('/:id', authenticate, getById);

// Get presigned upload URL (influencer)
router.post('/:id/upload-url', authenticate, requireRole('influencer'), getUploadUrl);

// Get media download URL (brand or influencer)
router.get('/:id/media-url', authenticate, getMediaUrl);

// Influencer submits content URL or media
router.post('/:id/submit', authenticate, requireRole('influencer'), submit);

// Brand reviews submitted content
router.post('/:id/review', authenticate, requireRole('brand'), review);

// Influencer submits live URL
router.post('/:id/submit-live', authenticate, requireRole('influencer'), submitLive);

// Brand confirms content is live → T2 release
router.post('/:id/confirm-live', authenticate, requireRole('brand'), confirmLive);

module.exports = router;
