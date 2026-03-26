'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/offer.controller');

const router = Router();

// Influencer-only offer actions
router.post('/:id/accept',    authenticate, requireRole('influencer'), ctrl.accept);
router.post('/:id/decline',   authenticate, requireRole('influencer'), ctrl.decline);
router.post('/:id/negotiate', authenticate, requireRole('influencer'), ctrl.negotiate);

module.exports = router;
