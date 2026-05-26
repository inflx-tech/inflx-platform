'use strict';

/**
 * Webhook routes — mounted at /v1/webhooks
 *
 * Razorpay webhook signature verification requires the RAW request body
 * (before any JSON parsing). The canonical Express pattern is to use
 * express.raw() on the route, which reads the raw bytes into req.body as
 * a Buffer. The global express.json() middleware in app.js conditionally
 * skips /v1/webhooks/* paths so the body stream stays unread by the time
 * express.raw() gets it.
 *
 * Pre-fix history: a hand-rolled captureRawBody middleware here attached
 * req.on('data')/req.on('end') listeners, but the global express.json()
 * had already consumed the stream — listeners never fired, handler hung,
 * Razorpay deliveries timed out. Carved defect:
 * features/backend-defect-webhook-body-hang/.
 */

const express = require('express');
const { Router } = require('express');
const ctrl = require('../controllers/webhook.controller');

const router = Router();

// POST /v1/webhooks/razorpay
// express.raw() puts the raw bytes into req.body as a Buffer; the controller
// uses those bytes for HMAC signature verification and then parses JSON.
router.post('/razorpay', express.raw({ type: '*/*', limit: '5mb' }), ctrl.handleWebhook);

module.exports = router;
