'use strict';

/**
 * Razorpay Webhook Controller
 * POST /v1/webhooks/razorpay
 *
 * Handles:
 *  - payment.authorized  → no-op (topup is verified via /topup/verify callback)
 *  - payment.failed      → log only
 *  - payout.processed    → mark influencer withdrawal as completed
 *  - payout.reversed     → mark influencer withdrawal as failed, refund wallet
 */

const crypto = require('crypto');
const db     = require('../config/db');
const env    = require('../config/env');
const notificationService = require('../services/notification.service');

// ─────────────────────────────────────────────────────────────────────────────
// Signature verification
// ─────────────────────────────────────────────────────────────────────────────

function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return true; // skip if not configured (dev)
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handlePaymentAuthorized(payload) {
  const payment = payload?.payment?.entity;
  console.log(`[WEBHOOK] payment.authorized — payment_id: ${payment?.id} amount: ₹${(payment?.amount || 0) / 100}`);
  // Top-up is credited via /topup/verify flow (client callback).
  // This event is a safety fallback — log only.
}

async function handlePaymentFailed(payload) {
  const payment = payload?.payment?.entity;
  console.warn(`[WEBHOOK] payment.failed — payment_id: ${payment?.id} reason: ${payment?.error_description}`);
}

async function handlePayoutProcessed(payload) {
  const payout = payload?.payout?.entity;
  if (!payout?.id) return;

  console.log(`[WEBHOOK] payout.processed — payout_id: ${payout.id}`);

  // Find matching withdrawal record
  const { rows } = await db.query(
    `SELECT iw.*, i.user_id, i.fcm_token, u.phone
     FROM influencer_withdrawals iw
     JOIN influencers i ON i.id = iw.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE iw.razorpay_payout_id = $1`,
    [payout.id]
  );

  if (!rows[0]) {
    console.warn(`[WEBHOOK] payout.processed — no withdrawal found for payout_id ${payout.id}`);
    return;
  }

  const withdrawal = rows[0];

  if (withdrawal.status === 'completed') return; // already processed (idempotency)

  await db.query(
    `UPDATE influencer_withdrawals
     SET status = 'completed', completed_at = NOW()
     WHERE razorpay_payout_id = $1`,
    [payout.id]
  );

  await notificationService.send({
    userId:   withdrawal.user_id,
    type:     'withdrawal.completed',
    title:    'Withdrawal Successful',
    body:     `\u20B9${parseFloat(withdrawal.net_paid).toFixed(2)} has been credited to your ${withdrawal.method === 'upi' ? 'UPI' : 'bank account'}.`,
    data:     { screen: 'withdrawals', withdrawal_id: withdrawal.id },
    fcmToken: withdrawal.fcm_token,
    sendSms:  true,
    phone:    withdrawal.phone,
  });
}

async function handlePayoutReversed(payload) {
  const payout = payload?.payout?.entity;
  if (!payout?.id) return;

  console.warn(`[WEBHOOK] payout.reversed — payout_id: ${payout.id}`);

  const { rows } = await db.query(
    `SELECT iw.*, i.user_id, i.fcm_token, u.phone
     FROM influencer_withdrawals iw
     JOIN influencers i ON i.id = iw.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE iw.razorpay_payout_id = $1`,
    [payout.id]
  );

  if (!rows[0]) return;
  const withdrawal = rows[0];
  if (withdrawal.status === 'failed') return; // idempotency

  // Mark failed + refund wallet
  await db.query(
    `UPDATE influencer_withdrawals SET status = 'failed' WHERE razorpay_payout_id = $1`,
    [payout.id]
  );

  await db.query(
    `UPDATE influencers SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
    [withdrawal.amount_requested, withdrawal.influencer_id]
  );

  await notificationService.send({
    userId:   withdrawal.user_id,
    type:     'withdrawal.failed',
    title:    'Withdrawal Failed',
    body:     `Your withdrawal of \u20B9${parseFloat(withdrawal.amount_requested).toFixed(2)} was reversed. Amount refunded to your wallet.`,
    data:     { screen: 'withdrawals', withdrawal_id: withdrawal.id },
    fcmToken: withdrawal.fcm_token,
    sendSms:  true,
    phone:    withdrawal.phone,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main webhook handler
// NOTE: app.js must pass raw body to this route (see webhook.routes.js)
// ─────────────────────────────────────────────────────────────────────────────

async function handleWebhook(req, res) {
  // Razorpay sends signature in header
  const signature = req.headers['x-razorpay-signature'];
  const rawBody   = req.rawBody; // set by express.raw() in webhook route

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[WEBHOOK] Invalid signature — rejected');
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid webhook signature' } });
  }

  let event;
  try {
    event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON payload' } });
  }

  const eventType = event?.event;
  console.log(`[WEBHOOK] Received: ${eventType}`);

  try {
    switch (eventType) {
      case 'payment.authorized': await handlePaymentAuthorized(event.payload); break;
      case 'payment.failed':     await handlePaymentFailed(event.payload);     break;
      case 'payout.processed':   await handlePayoutProcessed(event.payload);   break;
      case 'payout.reversed':    await handlePayoutReversed(event.payload);    break;
      default:
        console.log(`[WEBHOOK] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`[WEBHOOK] Error handling ${eventType}:`, err.message);
    // Return 200 anyway — Razorpay will retry on non-2xx
    return res.status(200).json({ success: true, note: 'event processing error logged' });
  }

  return res.status(200).json({ success: true });
}

module.exports = { handleWebhook };
