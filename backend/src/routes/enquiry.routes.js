'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/enquiry.controller');

const router = Router();

// Follower submits enquiry
router.post('/enquiry', authenticate, requireRole('follower'), ctrl.submitEnquiry);

module.exports = router;
