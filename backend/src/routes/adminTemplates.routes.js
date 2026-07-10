'use strict';

/**
 * adminTemplates.routes.js — Experience Templates (Creator Experience Engine
 * Phase 5, features/experience-templates/, migrations 133-134).
 * Mounted at /v1/admin/experience-templates. Admin-only via 'sections' capability.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminTemplates.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('sections')];

router.get('/',            ...adminAuth, ctrl.list);
router.get('/:id',         ...adminAuth, ctrl.getOne);
router.post('/',           ...adminAuth, ctrl.create);
router.patch('/:id',       ...adminAuth, ctrl.update);
router.post('/:id/place',  ...adminAuth, ctrl.place);
router.post('/:id/unplace', ...adminAuth, ctrl.unplace);

module.exports = router;
