'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/offer.controller');

const router = Router();

// Both brand and influencer can view and respond to negotiations
router.get('/:id',          authenticate, requireRole('brand', 'influencer'), ctrl.getNegotiation);
router.post('/:id/respond', authenticate, requireRole('brand', 'influencer'), ctrl.respond);

module.exports = router;
