'use strict';

/**
 * adminSections.routes.js — Admin Section Manager (Creator Vibe, Phase B).
 * Mounted at /v1/admin/sections. Admin-only (requireAnyAdminRole — the founder's
 * daily account isn't always superadmin). Contract: features/admin-section-manager/.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminSections.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('sections')];

// P5 (section-analytics-city) — BEFORE /:screen so 'analytics' isn't swallowed.
router.get('/analytics',  ...adminAuth, ctrl.sectionAnalytics);
// Section image presign (app-builder-image-content-fixes) — BEFORE /:screen so
// the literal path isn't captured by :screen. Own 'sections' capability.
router.post('/stock-upload-url', ...adminAuth, ctrl.stockUploadUrl);
router.get('/:screen',    ...adminAuth, ctrl.listSections);
router.put('/:screen',    ...adminAuth, ctrl.saveSections);
router.delete('/id/:id',  ...adminAuth, ctrl.deleteSection);

module.exports = router;
