'use strict';

/**
 * adminThemes.routes.js — Theme Library (Creator Experience Engine Phase 2,
 * features/theme-library/, migrations 129-130).
 * Mounted at /v1/admin/themes. Admin-only via the 'sections' capability.
 * NOTE: /blueprints is declared before /:id so it isn't captured as an id.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminThemes.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('sections')];

router.get('/blueprints',   ...adminAuth, ctrl.blueprints);
router.get('/',             ...adminAuth, ctrl.list);
router.get('/:id',          ...adminAuth, ctrl.getOne);
router.post('/',            ...adminAuth, ctrl.create);
router.patch('/:id',        ...adminAuth, ctrl.update);
router.post('/:id/publish', ...adminAuth, ctrl.publish);

module.exports = router;
