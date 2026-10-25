'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/engagement.controller');

const router = Router();

// GET /brands/me/campaigns/:id/engagement — post-performance-v2: views, likes, comments by set, creator and link
router.get('/me/campaigns/:id/engagement', authenticate, requireRole('brand'), ctrl.getCampaignEngagement);
// POST /brands/me/campaigns/:id/engagement/refresh — the website's one "Update now" (once a day, budget-gated)
router.post('/me/campaigns/:id/engagement/refresh', authenticate, requireRole('brand'), ctrl.refreshCampaignEngagement);

module.exports = router;
