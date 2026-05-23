'use strict';

/**
 * Loads and validates all required environment variables at startup.
 * The app will refuse to start if any required variable is missing.
 */

require('dotenv').config();

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRY',
  'REFRESH_TOKEN_EXPIRY',
  'ENCRYPTION_KEY',
];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`\n[INFLX] Missing required environment variables:\n  ${missing.join('\n  ')}`);
  console.error('Copy .env.example to .env and fill in the values.\n');
  process.exit(1);
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),

  DATABASE_URL: process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRY: process.env.JWT_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '30d',

  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  OTP_MOCK: process.env.OTP_MOCK !== 'false',
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
  OTP_TEMPLATE_ID: process.env.OTP_TEMPLATE_ID,

  APIFY_MOCK: process.env.APIFY_MOCK !== 'false',
  APIFY_TOKEN: process.env.APIFY_TOKEN,

  FCM_MOCK: process.env.FCM_MOCK !== 'false',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',

  // OneSignal push notifications (replaces Firebase FCM)
  ONESIGNAL_MOCK: process.env.ONESIGNAL_MOCK !== 'false',
  ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID || '',
  ONESIGNAL_REST_API_KEY: process.env.ONESIGNAL_REST_API_KEY || '',

  RAZORPAY_MOCK: process.env.RAZORPAY_MOCK !== 'false',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  RAZORPAY_PAYOUT_ACCOUNT_NUMBER: process.env.RAZORPAY_PAYOUT_ACCOUNT_NUMBER || '',
  RAZORPAY_PAYOUT_CONTACT_ID: process.env.RAZORPAY_PAYOUT_CONTACT_ID || 'mock_contact_id',

  // Cloudflare R2 / local storage
  R2_MOCK: process.env.R2_MOCK !== 'false',
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET: process.env.R2_BUCKET || 'inflx-dev',
  PDF_STORAGE_PATH: process.env.PDF_STORAGE_PATH || './tmp/contracts',

  // INFLX Meals AI (Anthropic). Mock by default for local/test
  // determinism; set AI_MOCK=false + ANTHROPIC_API_KEY in prod. Key
  // never committed. AI returns STRUCTURE (intent/levers/rankings),
  // never prices — those come from the deterministic engine.
  AI_MOCK: process.env.AI_MOCK !== 'false',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  AI_MODEL_EXTRACT: process.env.AI_MODEL_EXTRACT || 'claude-haiku-4-5-20251001',
  AI_MODEL_REASON: process.env.AI_MODEL_REASON || 'claude-sonnet-4-6',

  // OTA publish endpoint — the shared secret that the local publish-ota
  // script sends in the X-OTA-Token header to authorise bundle uploads.
  // If unset in prod, the publish endpoint refuses all requests.
  OTA_PUBLISH_TOKEN: process.env.OTA_PUBLISH_TOKEN || '',

  // Ingest endpoint — shared secret with the external Marketing Automation
  // system. Sent in the X-Ingest-Token header on every push to
  // /v1/internal/ingest/*. If unset in prod, the endpoints refuse all requests.
  // In dev/test a fixed value is used so smoke tests work without configuration.
  INFLX_INGEST_TOKEN: process.env.INFLX_INGEST_TOKEN ||
    (process.env.NODE_ENV === 'production' ? '' : 'dev-ingest-token'),

  // n8n base URL — used by the marketing admin controller to trigger the
  // A2 scrape workflow webhook after a new lead is inserted via admin intake.
  // If unset, the intake endpoint succeeds but no scrape is fired (dev mode).
  N8N_BASE_URL: process.env.N8N_BASE_URL || '',

  // External-only ingest mode disables the in-platform Apify cron
  // (apify-engagement-scrape). Set to 'external' once the marketing
  // automation pipeline is the source of truth. Default 'internal' keeps
  // existing behaviour.
  APIFY_INGEST_MODE: process.env.APIFY_INGEST_MODE || 'internal',

  PLATFORM_FEE_PCT: parseFloat(process.env.PLATFORM_FEE_PCT || '8'),
  TDS_PCT: parseFloat(process.env.TDS_PCT || '10'),
  RETURN_WINDOW_DAYS: parseInt(process.env.RETURN_WINDOW_DAYS || '30', 10),
  OFFER_EXPIRY_HOURS: parseInt(process.env.OFFER_EXPIRY_HOURS || '48', 10),

  ENABLE_CRONS: process.env.ENABLE_CRONS !== 'false',
  CRON_TIMEZONE: process.env.CRON_TIMEZONE || 'Asia/Kolkata',
  CATEGORY_BENCHMARK_ER: parseFloat(process.env.CATEGORY_BENCHMARK_ER || '3.8'),
  RAZORPAY_PAYOUT_KEY_ID: process.env.RAZORPAY_PAYOUT_KEY_ID || '',
  RAZORPAY_PAYOUT_KEY_SECRET: process.env.RAZORPAY_PAYOUT_KEY_SECRET || '',
};
