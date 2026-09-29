'use strict';

/**
 * adminShopper.routes.js — INFLX admin for the shopper app (follower-app-v2). Mounted at /v1/admin/shopper.
 *   comments   the reports queue: shoppers report a comment, admin removes it or keeps it (4.15)
 *   feed       the readiness panel and the preview for the learning feed (5.12)
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/shopper.controller');

const router = Router();

router.get('/comments', authenticate, requireCapability('approvals'), ctrl.reportedComments);
router.post('/comments/:id/decide', authenticate, requireCapability('approvals'), ctrl.decideComment);
router.get('/feed/readiness', authenticate, requireCapability('settings'), ctrl.feedReadiness);
router.get('/feed/preview', authenticate, requireCapability('settings'), ctrl.feedPreview);

module.exports = router;
