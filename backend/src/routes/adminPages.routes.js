'use strict';

/**
 * adminPages.routes.js — Admin custom-page registry (App Builder).
 * Mounted at /v1/admin/pages. Admin-only (requireCapability('sections') — same
 * capability as the Section Manager, since pages are part of App-Builder curation).
 * Contract: features/follower-page-builder/.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminPages.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('sections')];

router.get('/',        ...adminAuth, ctrl.listPages);
router.post('/',       ...adminAuth, ctrl.createPage);
router.patch('/:id',   ...adminAuth, ctrl.updatePage);
router.delete('/:id',  ...adminAuth, ctrl.deletePage);

module.exports = router;
