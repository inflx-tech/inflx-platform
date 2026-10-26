'use strict';

/**
 * adminProducts.routes.js — the Product Queue API (features/product-approval-switch).
 * Mounted at /v1/admin/products. Approvals capability — the same reviewers as the Post Queue.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminProducts.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('approvals')];

router.get('/',             ...adminAuth, ctrl.list);
router.post('/:id/approve', ...adminAuth, ctrl.approve);
router.post('/:id/reject',  ...adminAuth, ctrl.reject);

module.exports = router;
