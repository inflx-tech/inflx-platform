'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { sendOtp, verifyOtp, refresh, logout, registerFcmToken, registerOneSignalPlayerId } = require('../controllers/auth.controller');

const router = Router();

// Public (no auth required)
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/refresh', refresh);

// change-login-number — a code to the old number, then the new number and its code.
// Authenticated only; deliberately NOT requireApproved (spec §3 rule 7: identity, not an action).
const changePhone = require('../controllers/changePhone.controller');
router.post('/change-phone/start',      authenticate, changePhone.start);
router.post('/change-phone/verify-old', authenticate, changePhone.verifyOld);
router.post('/change-phone/send-new',   authenticate, changePhone.sendNew);
router.post('/change-phone/confirm',    authenticate, changePhone.confirm);

// Requires a valid access token
router.post('/logout', authenticate, logout);
router.post('/fcm-token', authenticate, registerFcmToken);
router.post('/onesignal-player-id', authenticate, registerOneSignalPlayerId);

module.exports = router;
