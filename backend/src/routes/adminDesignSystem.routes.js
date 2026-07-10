'use strict';

/**
 * adminDesignSystem.routes.js — Creator Experience Engine Phase 1
 * (features/design-system-tokens/, migrations 127-128).
 * Mounted at /v1/admin/design-system. Admin-only via the 'sections' capability
 * (the design vocabulary feeds the same section/theme engine the App Builder
 * composes). Read-only in v1.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminDesignSystem.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('sections')];

router.get('/tokens',  ...adminAuth, ctrl.listTokens);
router.get('/presets', ...adminAuth, ctrl.listPresets);

module.exports = router;
