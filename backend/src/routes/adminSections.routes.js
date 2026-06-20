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

router.get('/:screen',    ...adminAuth, ctrl.listSections);
router.put('/:screen',    ...adminAuth, ctrl.saveSections);
router.delete('/id/:id',  ...adminAuth, ctrl.deleteSection);

module.exports = router;
