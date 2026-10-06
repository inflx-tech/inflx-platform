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

  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
  OTP_TEMPLATE_ID: process.env.OTP_TEMPLATE_ID,

  APIFY_MOCK: process.env.APIFY_MOCK !== 'false',
  APIFY_TOKEN: process.env.APIFY_TOKEN,

  // The Apify actor that reads a YouTube channel. A creator's channel is asked for at
  // signup and was never measured until now — the admin saw her Instagram numbers and had
  // no way to tell a YouTube-first creator from a small one. Same APIFY_TOKEN, same
  // mock switch, same run-sync call as the Instagram side.
  //
  // Overridable because actor quality on Apify moves: swapping actors is an env change on
  // Render and a restart, not a code deploy. Use ~ not / in the id.
  // Contract: features/admin-creator-review-completeness
  APIFY_YOUTUBE_ACTOR: process.env.APIFY_YOUTUBE_ACTOR || 'streamers~youtube-scraper',

  // Item 3b — social numbers pipeline (rules v1.12 §2A). Contract: features/item3b-social-numbers
  // Actors confirmed by the Step-0 probe on 2026-09-11; ~ not / in the ids.
  APIFY_IG_PROFILE_ACTOR: process.env.APIFY_IG_PROFILE_ACTOR || 'apify~instagram-profile-scraper',
  APIFY_IG_POSTS_ACTOR: process.env.APIFY_IG_POSTS_ACTOR || 'apify~instagram-post-scraper',
  // Free plan = US$5 of usage a month; the guard counts ALL INFLX runs (founder Q6).
  APIFY_MONTHLY_BUDGET_USD: parseFloat(process.env.APIFY_MONTHLY_BUDGET_USD || '5'),
  SOCIAL_PROFILE_EVERY_DAYS: parseInt(process.env.SOCIAL_PROFILE_EVERY_DAYS || '7', 10),
  SOCIAL_POSTS_EVERY_DAYS: parseInt(process.env.SOCIAL_POSTS_EVERY_DAYS || '15', 10),
  SOCIAL_WINDOW_DAYS: 90,
  SOCIAL_CEILING: parseInt(process.env.SOCIAL_CEILING || '500', 10),
  // The newest N posts the numbers are computed from, inside SOCIAL_WINDOW_DAYS. Also the number
  // of posts we ask Apify for, so it is the main lever on scrape cost.
  SOCIAL_MAX_POSTS: parseInt(process.env.SOCIAL_MAX_POSTS || '30', 10),
  SOCIAL_BATCH_SIZE: parseInt(process.env.SOCIAL_BATCH_SIZE || '10', 10),
  SOCIAL_CONCURRENCY: parseInt(process.env.SOCIAL_CONCURRENCY || '3', 10),
  SOCIAL_RUN_TIMEOUT_SECS: parseInt(process.env.SOCIAL_RUN_TIMEOUT_SECS || '600', 10),
  SOCIAL_BACKFILL_DAYS: parseInt(process.env.SOCIAL_BACKFILL_DAYS || '3', 10),
  SOCIAL_CHECK_AGAIN_HOURS: 24,

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

  // ── Item 11: the shipping layer (features/item11-remote §6) ───────────────
  // SHIPPING_PROVIDER chooses the provider for NEW shipments. An existing shipment always
  // uses the provider written on its own row, so switching this never redirects a parcel
  // already in flight. 'simulator' is the only live provider in item 11.
  //
  // The Shiprocket adapter is switched off TWICE on purpose: index.js refuses to hand it out
  // unless SHIPPING_PROVIDER === 'shiprocket', AND the adapter's own client throws unless
  // SHIPROCKET_ENABLED === 'true'. A test asserts no HTTP call leaves the server while off.
  // NONE of these is set on Render. Going live is the founder's decision, after a few real
  // test shipments.
  SHIPPING_PROVIDER: process.env.SHIPPING_PROVIDER || 'simulator',
  SHIPROCKET_ENABLED: process.env.SHIPROCKET_ENABLED === 'true',
  SHIPROCKET_EMAIL: process.env.SHIPROCKET_EMAIL || '',
  SHIPROCKET_PASSWORD: process.env.SHIPROCKET_PASSWORD || '',
  SHIPROCKET_BASE_URL: process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in',
  SHIPROCKET_WEBHOOK_SECRET: process.env.SHIPROCKET_WEBHOOK_SECRET || '',
  SHIPROCKET_CHANNEL_ID: process.env.SHIPROCKET_CHANNEL_ID || '',
  // features/shiprocket-connector-repair — the one open money question a real parcel answers:
  // does Shiprocket's quoted `rate` already contain GST? Assumed yes. If the first real booking
  // takes more from the INFLX Shiprocket wallet than was quoted, set this to 'true' and the
  // connector adds 18% before the brand is shown a price.
  SHIPROCKET_RATES_EXCLUDE_GST: process.env.SHIPROCKET_RATES_EXCLUDE_GST === 'true',
  // Approval §2.3 — a switch that makes the SIMULATOR refuse to quote a return, so the
  // "lock falls back to the outbound price" path is tested and not merely written.
  SIMULATOR_NO_RETURN_QUOTE: process.env.SIMULATOR_NO_RETURN_QUOTE === 'true',

  PLATFORM_FEE_PCT: parseFloat(process.env.PLATFORM_FEE_PCT || '8'),
  TDS_PCT: parseFloat(process.env.TDS_PCT || '10'),
  RETURN_WINDOW_DAYS: parseInt(process.env.RETURN_WINDOW_DAYS || '30', 10),
  OFFER_EXPIRY_HOURS: parseInt(process.env.OFFER_EXPIRY_HOURS || '48', 10),

  // Section-engine offer source (D0 Workstream B / OR cutover). When ON, the follower
  // offer shelves read brandOffers.adapter (offers from creator assignments +
  // engagement showcase + store-direct) instead of the legacy (empty) campaign_offers.
  // Default: ON in production (prod data validated 2026-06-09), OFF in test (so the
  // existing section-engine suite keeps testing the legacy path), OFF in local dev.
  // An explicit env value always wins → kill-switch = set SECTION_ENGINE_OFFERS=false.
  SECTION_ENGINE_OFFERS: (() => {
    if (process.env.SECTION_ENGINE_OFFERS != null) return process.env.SECTION_ENGINE_OFFERS === 'true';
    if (process.env.NODE_ENV === 'test') return false;
    return process.env.NODE_ENV === 'production'
      || (process.env.DATABASE_URL || '').includes('supabase.com');
  })(),

  ENABLE_CRONS: process.env.ENABLE_CRONS !== 'false',
  CRON_TIMEZONE: process.env.CRON_TIMEZONE || 'Asia/Kolkata',
  CATEGORY_BENCHMARK_ER: parseFloat(process.env.CATEGORY_BENCHMARK_ER || '3.8'),
  RAZORPAY_PAYOUT_KEY_ID: process.env.RAZORPAY_PAYOUT_KEY_ID || '',
  RAZORPAY_PAYOUT_KEY_SECRET: process.env.RAZORPAY_PAYOUT_KEY_SECRET || '',
};
