'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/engagement.controller');

const router = Router();

// GET /brands/me/campaigns/:id/engagement
router.get('/me/campaigns/:id/engagement', authenticate, requireRole('brand'), ctrl.getCampaignEngagement);

module.exports = router;
