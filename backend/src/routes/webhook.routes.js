'use strict';

/**
 * Webhook routes — mounted at /v1/webhooks
 *
 * IMPORTANT: Razorpay webhook signature verification requires the RAW request body
 * (before any JSON parsing). We use express.raw() here so the raw bytes are
 * available on req.rawBody, while req.body is the parsed object.
 */

const { Router } = require('express');
const ctrl = require('../controllers/webhook.controller');

const router = Router();

// Middleware to capture raw body before parsing
function captureRawBody(req, res, next) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    try { req.body = JSON.parse(data); } catch { req.body = {}; }
    next();
  });
}

// POST /v1/webhooks/razorpay
router.post('/razorpay', captureRawBody, ctrl.handleWebhook);

module.exports = router;
