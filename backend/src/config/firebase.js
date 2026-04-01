'use strict';

/**
 * Firebase Admin SDK initialization.
 *
 * Required env vars (only when FCM_MOCK=false):
 *   - FIREBASE_PROJECT_ID
 *   - FIREBASE_CLIENT_EMAIL
 *   - FIREBASE_PRIVATE_KEY  (the PEM string, with literal \n)
 *
 * In dev (FCM_MOCK=true, the default) this module exports null —
 * notification.service.js checks for that and falls back to console.log.
 */

const env = require('./env');

let admin = null;

if (!env.FCM_MOCK) {
  try {
    const firebaseAdmin = require('firebase-admin');

    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.error(
        '[FIREBASE] FCM_MOCK is false but Firebase credentials are missing. ' +
        'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
      );
    } else {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      admin = firebaseAdmin;
      console.log('[FIREBASE] Admin SDK initialized successfully');
    }
  } catch (err) {
    console.error('[FIREBASE] Failed to initialize Admin SDK:', err.message);
  }
} else {
  console.log('[FIREBASE] FCM_MOCK=true — Firebase Admin SDK not initialized');
}

module.exports = admin;
