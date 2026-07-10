'use strict';

/**
 * adminExperiencePreview.routes.js — Adaptive Renderer preview API
 * (Creator Experience Engine Phase 4a, features/adaptive-renderer/).
 * Mounted at /v1/admin. Admin-only via the 'sections' capability. Read-only.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminExperiencePreview.controller');

const router = Router();
router.get('/experience-preview', authenticate, requireCapability('sections'), ctrl.preview);

module.exports = router;
