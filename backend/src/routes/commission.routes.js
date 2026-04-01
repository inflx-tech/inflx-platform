'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/commission.controller');

const router = Router();

// Influencer commission tracker
router.get('/me/commissions', authenticate, requireRole('influencer'), ctrl.getCommissions);

// Per-campaign earnings breakdown
router.get('/me/commissions/by-campaign', authenticate, requireRole('influencer'), ctrl.getCampaignEarnings);

// Single campaign commission detail
router.get('/me/commissions/campaign/:campaignInfluencerId', authenticate, requireRole('influencer'), ctrl.getCampaignCommissionDetail);

module.exports = router;
