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
