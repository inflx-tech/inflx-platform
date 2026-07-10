'use strict';

/**
 * adminDesignLayouts.routes.js — Design Library (Creator Experience Engine
 * Phase 3, features/design-library/, migrations 131-132).
 * Mounted at /v1/admin (design-layouts + section-styles). Admin-only via the
 * 'sections' capability. Read-only in v1.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminDesignLayouts.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('sections')];

router.get('/design-layouts', ...adminAuth, ctrl.listLayouts);
router.get('/section-styles', ...adminAuth, ctrl.listSectionStyles);

module.exports = router;
