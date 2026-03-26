'use strict';

const db = require('../config/db');
const env = require('../config/env');

/**
 * Send a notification to a user.
 *
 * This does three things:
 *   1. Inserts a row into the notifications table (always — powers the in-app bell)
 *   2. Sends a Firebase FCM push (mocked in dev: console.log)
 *   3. Sends SMS via MSG91 for critical events (mocked in dev: console.log)
 *
 * @param {object} opts
 * @param {string} opts.userId        - Recipient user ID
 * @param {string} opts.type          - Notification type key (e.g. 'account.approved')
 * @param {string} opts.title         - Short title (≤ 100 chars)
 * @param {string} opts.body          - Full message body
 * @param {object} [opts.data]        - Deep-link params e.g. { screen: 'dashboard' }
 * @param {string} [opts.fcmToken]    - FCM token of recipient device
 * @param {boolean} [opts.sendSms]    - Whether to also send SMS
 * @param {string} [opts.phone]       - Required if sendSms is true
 * @returns {string} notification id
 */
async function send({ userId, type, title, body, data = null, fcmToken = null, sendSms = false, phone = null }) {
  // 1. Persist to DB (in-app notification)
  const { rows } = await db.query(
    `INSERT INTO notifications (user_id, type, title, body, data_json)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, type, title, body, data ? JSON.stringify(data) : null]
  );
  const notificationId = rows[0].id;

  // 2. Push notification
  if (fcmToken) {
    await _sendPush(fcmToken, title, body, data);
  }

  // 3. SMS for critical events
  if (sendSms && phone) {
    await _sendSms(phone, body);
  }

  return notificationId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

async function _sendPush(fcmToken, title, body, data) {
  if (env.FCM_MOCK) {
    console.log(`[FCM MOCK] Push → ${fcmToken.slice(0, 12)}... | "${title}"`);
    return;
  }
  // Production: use firebase-admin SDK
  // admin.messaging().send({ token: fcmToken, notification: { title, body }, data })
}

async function _sendSms(phone, message) {
  if (env.OTP_MOCK) {
    console.log(`[SMS MOCK] → ${phone}: ${message}`);
    return;
  }
  // Production: POST to MSG91 SMS endpoint
}

module.exports = { send };
