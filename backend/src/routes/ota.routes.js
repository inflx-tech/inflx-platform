'use strict';

/**
 * ota.routes.js
 *
 * GET  /v1/ota/manifest    — public (called by installed apps on every launch)
 * POST /v1/ota/publish     — header-authed (called by local publish-ota script)
 */

const { Router } = require('express');
const express    = require('express');
const { getManifest, publish, configureR2Cors } = require('../controllers/ota.controller');

const router = Router();

// Increased JSON body limit for /publish — a release bundle is usually
// ~2-5 MB. Scoped here so the rest of the API keeps its normal 1 MB limit.
router.post('/publish', express.json({ limit: '20mb' }), publish);

router.get('/manifest', getManifest);

// Maintenance: apply R2 bucket CORS policy. Token-gated like /publish.
router.post('/configure-r2-cors', configureR2Cors);

module.exports = router;
