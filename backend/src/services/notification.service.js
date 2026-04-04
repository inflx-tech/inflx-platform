'use strict';

const db = require('../config/db');
const env = require('../config/env');

/**
 * Send a notification to a user.
 *
 * This does three things:
 *   1. Inserts a row into the notifications table (always — powers the in-app bell)
 *   2. Sends a push notification via OneSignal (mocked in dev: console.log)
 *   3. Sends SMS via MSG91 for critical events (mocked in dev: console.log)
 *
 * @param {object} opts
 * @param {string} opts.userId        - Recipient user ID
 * @param {string} opts.type          - Notification type key (e.g. 'account.approved')
 * @param {string} opts.title         - Short title (≤ 100 chars)
 * @param {string} opts.body          - Full message body
 * @param {object} [opts.data]        - Deep-link params e.g. { screen: 'dashboard' }
 * @param {string} [opts.fcmToken]    - Legacy FCM token (still supported)
 * @param {string} [opts.imageUrl]    - Big picture URL for rich notification
 * @param {boolean} [opts.sendSms]    - Whether to also send SMS
 * @param {string} [opts.phone]       - Required if sendSms is true
 * @returns {string} notification id
 */
async function send({ userId, type, title, body, data = null, fcmToken = null, imageUrl = null, sendSms = false, phone = null }) {
  // 1. Persist to DB (in-app notification)
  const { rows } = await db.query(
    `INSERT INTO notifications (user_id, type, title, body, data_json)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, type, title, body, data ? JSON.stringify(data) : null]
  );
  const notificationId = rows[0].id;

  // 2. Push notification via OneSignal
  // Look up the user's OneSignal player ID if not provided
  await _sendOneSignalPush(userId, title, body, data, imageUrl);

  // 3. SMS for critical events
  if (sendSms && phone) {
    await _sendSms(phone, body);
  }

  return notificationId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send push via OneSignal REST API.
 * Falls back to console.log when ONESIGNAL_MOCK=true (dev default).
 */
async function _sendOneSignalPush(userId, title, body, data, imageUrl) {
  // Fetch user's OneSignal player ID from DB
  const { rows } = await db.query(
    `SELECT onesignal_player_id, fcm_token FROM users WHERE id = $1`,
    [userId]
  );

  if (!rows.length) return;

  const user = rows[0];
  const playerId = user.onesignal_player_id;

  if (!playerId) {
    // No OneSignal ID registered for this user — try legacy FCM
    if (user.fcm_token) {
      await _sendLegacyFcmPush(user.fcm_token, title, body, data);
    }
    return;
  }

  if (env.ONESIGNAL_MOCK) {
    console.log(`[ONESIGNAL MOCK] Push → player:${playerId.slice(0, 12)}... | "${title}" | ${body}`);
    return;
  }

  if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_API_KEY) {
    console.warn('[ONESIGNAL] Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY — skipping push');
    return;
  }

  try {
    // Build the OneSignal notification payload
    const payload = {
      app_id: env.ONESIGNAL_APP_ID,
      include_subscription_ids: [playerId],
      headings: { en: title },
      contents: { en: body },
    };

    // Rich notification: big image (shows in expanded notification)
    if (imageUrl) {
      payload.big_picture = imageUrl;              // Android
      payload.ios_attachments = { img: imageUrl };  // iOS
    }

    // Deep-link data: passed to the app on notification tap
    if (data) {
      // OneSignal requires all data values to be strings
      payload.data = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      );
    }

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${env.ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[ONESIGNAL] Push failed (${response.status}):`, errBody);
    }
  } catch (err) {
    // Log but don't throw — push failure should not break the caller
    console.error(`[ONESIGNAL] Push send failed for player ${playerId.slice(0, 12)}...:`, err.message);
  }
}

/**
 * Legacy FCM push — kept for backwards compatibility during migration.
 * Will be removed once all users have migrated to OneSignal.
 */
async function _sendLegacyFcmPush(fcmToken, title, body, data) {
  if (env.FCM_MOCK) {
    console.log(`[FCM MOCK] Push → ${fcmToken.slice(0, 12)}... | "${title}"`);
    return;
  }

  const firebaseAdmin = require('../config/firebase');
  if (!firebaseAdmin) {
    console.warn('[FCM] Firebase Admin not initialized — skipping push');
    return;
  }

  try {
    const stringData = data
      ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
      : undefined;

    await firebaseAdmin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: stringData,
    });
  } catch (err) {
    console.error(`[FCM] Push send failed for token ${fcmToken.slice(0, 12)}...:`, err.message);
  }
}

async function _sendSms(phone, message) {
  if (env.OTP_MOCK) {
    console.log(`[SMS MOCK] → ${phone}: ${message}`);
    return;
  }
  // Production: POST to MSG91 SMS endpoint
}

module.exports = { send };
