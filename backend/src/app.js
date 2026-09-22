'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const routes = require('./routes/index');
const trackingCtrl = require('./controllers/tracking.controller');
const errorHandler = require('./middleware/errorHandler');
const env = require('./config/env');
const storageService = require('./services/storage.service');

const app = express();

// ─── Reverse-proxy trust ─────────────────────────────────────────────────────
// Render runs us behind a single reverse proxy. Trusting exactly one hop lets
// express-rate-limit + req.ip correctly resolve to the real client IP from
// X-Forwarded-For. Without this, express-rate-limit logs a ValidationError on
// every authenticated request and rate limits collapse into one global bucket
// (the proxy IP). NOT `true` (unlimited hops) — IP-spoofing risk.
// Carved contract: features/backend-trust-proxy-render/.
app.set('trust proxy', 1);

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3002',      // brand web (local)
  'http://localhost:3003',      // admin web (local)
  'http://10.0.2.2:3002',      // Android emulator → brand web
  'http://10.0.2.2:3003',      // Android emulator → admin web
  process.env.BRAND_WEB_URL,   // production brand URL
  process.env.ADMIN_WEB_URL,   // production admin URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any *.inflx.in subdomain and inflx.in itself
    if (/^https?:\/\/(.*\.)?inflx\.in$/.test(origin)) return callback(null, true);
    // Allow Vercel preview deployments
    if (/^https?:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Static file serving for mock uploads ────────────────────────────────────
if (env.R2_MOCK) {
  app.use('/uploads', express.static(storageService.getUploadDir()));
}

// ─── Request parsing ─────────────────────────────────────────────────────────
// Razorpay webhooks need the raw request body for HMAC signature verification
// (webhook.controller.verifyWebhookSignature). express.json() consumes the
// body stream, which would make raw-body access impossible downstream. So we
// conditionally bypass json parsing for /v1/webhooks/* paths and let
// express.raw() in the webhook route capture the buffer. All other routes
// keep the existing 5mb json parsing exactly as before.
// Carved defect: features/backend-defect-webhook-body-hang/.
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/v1/webhooks/')) return next();
  return express.json({ limit: '5mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging (disabled in test to keep output clean) ─────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Rate limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit on OTP endpoint to prevent SMS abuse. Every send now costs a
// real SMS credit in every non-test environment, so it is never relaxed.
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many OTP requests. Try again in 1 hour.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone || req.ip,
});

// Rate limiting is disabled in test environment to prevent the in-memory
// counter from blocking repeated OTP and auth calls across test cases.
if (process.env.NODE_ENV !== 'test') {
  app.use('/v1/auth/send-otp', otpLimiter);
  app.use('/v1/auth', authLimiter);
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inflx-api', version: '1.0.0' });
});

// ─── Influencer share-link click tracking ─────────────────────────────────────
// Pattern: /s/:influencer_handle?cid=&sid=&oid=&iid=
// Logs the click then redirects to the follower store.
app.get('/s/:influencer_handle', trackingCtrl.trackClick);

// ─── Universal share links (contract: universal-share-links) ──────────────────
// /b/:id brand store · /p/:id product · /o/:id offer — log + redirect like /s/.
app.get('/b/:id', trackingCtrl.trackBrand);
app.get('/p/:id', trackingCtrl.trackProduct);
app.get('/o/:id', trackingCtrl.trackOffer);

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/v1', routes);

// Item 11 — what a courier update MEANS to a collaboration (money, notifications, the return
// clock). Registered HERE, at startup, because services/shipping must never import item 11:
// the dependency points one way so item 16 can reuse the layer for a customer's order.
// Registering on the app rather than in index.js means the tests get it too — they mount this
// module, not the server. Contract: features/item11-remote §6.3
require('./services/remoteEffects').register();

// ─── 404 catch-all ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

// ─── Global error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

module.exports = app;
