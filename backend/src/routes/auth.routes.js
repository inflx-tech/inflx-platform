'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { sendOtp, verifyOtp, refresh, logout, registerFcmToken } = require('../controllers/auth.controller');

const router = Router();

// Public (no auth required)
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/refresh', refresh);

// Requires a valid access token
router.post('/logout', authenticate, logout);
router.post('/fcm-token', authenticate, registerFcmToken);

module.exports = router;
