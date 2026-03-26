'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/commission.controller');

const router = Router();

// Influencer commission tracker
router.get('/me/commissions', authenticate, requireRole('influencer'), ctrl.getCommissions);

module.exports = router;
