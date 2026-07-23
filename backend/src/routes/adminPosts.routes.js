'use strict';

/**
 * adminPosts.routes.js — Post Moderation Queue API (Post/Concept P2, mig 140).
 * Mounted at /v1/admin/posts. Approvals capability — moderation is account-
 * approval-adjacent work, same reviewers. Contract: features/concept-p2-posts/.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminPosts.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('approvals')];

router.get('/',            ...adminAuth, ctrl.list);
router.post('/:id/approve', ...adminAuth, ctrl.approve);
router.post('/:id/reject',  ...adminAuth, ctrl.reject);

module.exports = router;
