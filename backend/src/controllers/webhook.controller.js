'use strict';

/**
 * Razorpay Webhook Controller
 * POST /v1/webhooks/razorpay
 *
 * Handles (post-A6.5):
 *  - payment.authorized          → no-op (topup is verified via /topup/verify callback)
 *  - payment.failed              → A6.5: write failed subscription_invoices row + notify brand
 *  - payout.processed            → mark influencer withdrawal as completed
 *  - payout.reversed             → mark influencer withdrawal as failed, refund wallet
 *  - subscription.authenticated  → A6.5: flip brand_subscription to active + mandate active
 *  - subscription.charged        → A6.5: write paid invoice + advance cycle dates
 *  - subscription.cycle_end      → A6.5: safety-net sync of cycle dates
 *  - subscription.halted         → A6.5: flip status=past_due + notify brand + admin alert
 *
 * Idempotency: subscription event handlers do UPSERT-style updates on
 * brand_subscriptions; invoices are protected by a partial unique index on
 * (brand_subscription_id, razorpay_payment_id) — duplicate webhook
 * deliveries silently no-op.
 */

const crypto = require('crypto');
const db     = require('../config/db');
const env    = require('../config/env');
const notificationService = require('../services/notification.service');
// Wave 1 — centralized tax math. GST rate now read from payment_config
// (defensive fallback to 18% via tax.service).
const taxService = require('../services/tax.service');
// Contract: features/referral-engine — accrue referral commission to the
// brand's active referrer on a confirmed (paid) subscription invoice.
const referralService = require('../services/referral.service');

// ─────────────────────────────────────────────────────────────────────────────
// Signature verification
// ─────────────────────────────────────────────────────────────────────────────

function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return true; // skip if not configured (dev)
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const match = expected === signature;
  if (!match) {
    // Diagnostic logging — fires only on mismatch. Logs lengths + first
    // chars only; never the full secret. Carved defect contract:
    // features/backend-defect-webhook-signature-diagnostic/.
    const bodyStr = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : String(rawBody || '');
    console.warn('[WEBHOOK] Signature mismatch debug:', {
      secret_set:        !!secret,
      secret_len:        secret.length,
      secret_first_3:    secret.slice(0, 3),
      body_len:          Buffer.isBuffer(rawBody) ? rawBody.length : (rawBody?.length || 0),
      body_first_60:     bodyStr.slice(0, 60),
      expected_first_16: expected.slice(0, 16),
      received_first_16: (signature || '').slice(0, 16),
    });
  }
  return match;
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

  // Phase A6.5 — if this payment was for a subscription, write a failed
  // invoice row so the brand sees the failure in their billing history
  // and we can surface a "payment failed" admin alert. Best-effort:
  // a non-subscription payment failure (e.g. wallet top-up) is a no-op
  // here (top-up failures are handled at the /topup/verify boundary).
  const subscriptionId = payment?.subscription_id;
  if (!subscriptionId) return;

  const { rows: subRows } = await db.query(
    `SELECT bs.id, bs.brand_id, t.tier_key,
            sp.price_inr, sp.billing_period,
            u.id AS user_id, u.fcm_token, u.phone
       FROM brand_subscriptions bs
       JOIN subscription_tiers t  ON t.id = bs.tier_id
       LEFT JOIN subscription_prices sp ON sp.id = bs.subscription_price_id
       JOIN brands b              ON b.id = bs.brand_id
       JOIN users  u              ON u.id = b.user_id
      WHERE bs.razorpay_subscription_id = $1
      LIMIT 1`,
    [subscriptionId]
  );
  if (!subRows[0]) {
    console.warn(`[WEBHOOK] payment.failed — no brand_subscription found for razorpay_subscription_id ${subscriptionId}`);
    return;
  }
  const sub = subRows[0];

  await db.query(
    `INSERT INTO subscription_invoices
       (brand_subscription_id, brand_id, tier_key, amount_inr,
        gst_amount_inr, period_start, period_end, status,
        razorpay_payment_id, failure_reason)
     VALUES ($1, $2, $3, $4, $5, current_date,
             current_date + ($6 || ' days')::interval,
             'failed', $7, $8)
     ON CONFLICT (brand_subscription_id, razorpay_payment_id)
       WHERE razorpay_payment_id IS NOT NULL DO NOTHING`,
    [
      sub.id, sub.brand_id, sub.tier_key,
      sub.price_inr || 0,
      sub.price_inr ? await taxService.gstOn(parseFloat(sub.price_inr)) : 0,
      String(sub.billing_period === 'yearly' ? 365 : 30),
      payment?.id || null,
      payment?.error_description || 'Payment failed at Razorpay',
    ]
  );

  await notificationService.send({
    userId:   sub.user_id,
    type:     'subscription.payment_failed',
    title:    'Subscription payment failed',
    body:     `Your ${sub.tier_key} ${sub.billing_period} subscription charge failed. Update your payment method to keep premium features active.`,
    data:     { screen: 'billing', subscription_id: sub.id },
    fcmToken: sub.fcm_token,
    sendSms:  false,
    phone:    sub.phone,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase A6.5 — subscription lifecycle handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Locate the brand_subscriptions row for a Razorpay subscription event.
 * Returns null if not found (we log + return; Razorpay won't retry on 200).
 */
async function _findBrandSubscription(razorpaySubscriptionId) {
  if (!razorpaySubscriptionId) return null;
  const { rows } = await db.query(
    `SELECT bs.id, bs.brand_id, bs.tier_id, bs.subscription_price_id,
            bs.status, bs.mandate_status,
            t.tier_key, t.name AS tier_name,
            sp.price_inr, sp.billing_period,
            u.id AS user_id, u.fcm_token, u.phone
       FROM brand_subscriptions bs
       JOIN subscription_tiers t       ON t.id = bs.tier_id
       LEFT JOIN subscription_prices sp ON sp.id = bs.subscription_price_id
       JOIN brands b                    ON b.id = bs.brand_id
       JOIN users  u                    ON u.id = b.user_id
      WHERE bs.razorpay_subscription_id = $1
      LIMIT 1`,
    [razorpaySubscriptionId]
  );
  return rows[0] || null;
}

async function handleSubscriptionAuthenticated(payload) {
  const sub = payload?.subscription?.entity;
  if (!sub?.id) { console.warn('[WEBHOOK] subscription.authenticated — payload missing subscription.entity.id'); return; }
  console.log(`[WEBHOOK] subscription.authenticated — sub_id: ${sub.id}`);

  const row = await _findBrandSubscription(sub.id);
  if (!row) {
    console.warn(`[WEBHOOK] subscription.authenticated — no brand_subscription for ${sub.id}`);
    return;
  }
  if (row.status === 'active') {
    // Already active (e.g. a proration-upgrade row activated immediately on
    // delta payment). The mandate for the new renewal subscription may have
    // just been authorized — record it WITHOUT overwriting the aligned cycle
    // dates. Existing fresh-subscribe rows are 'pending_mandate' here, so this
    // branch never affects them.
    if (row.mandate_status !== 'active') {
      await db.query(
        `UPDATE brand_subscriptions
            SET mandate_status = 'active',
                razorpay_mandate_id = COALESCE($2, razorpay_mandate_id)
          WHERE id = $1`,
        [row.id, sub.payment_method || sub.token_id || null]
      );
    }
    return; // idempotent — do not touch cycle dates
  }

  const cycleDays = row.billing_period === 'yearly' ? 365 : 30;
  await db.query(
    `UPDATE brand_subscriptions
        SET status              = 'active',
            mandate_status      = 'active',
            razorpay_mandate_id = COALESCE($2, razorpay_mandate_id),
            current_cycle_start = current_date,
            current_cycle_end   = current_date + ($3 || ' days')::interval,
            next_charge_at      = current_date + ($3 || ' days')::interval
      WHERE id = $1`,
    [row.id, sub.payment_method || sub.token_id || null, String(cycleDays)]
  );

  await notificationService.send({
    userId:   row.user_id,
    type:     'subscription.activated',
    title:    'Subscription active',
    body:     `Your ${row.tier_name} ${row.billing_period} subscription is now active.`,
    data:     { screen: 'subscription', subscription_id: row.id },
    fcmToken: row.fcm_token,
    sendSms:  false,
    phone:    row.phone,
  });
}

async function handleSubscriptionCharged(payload) {
  const sub     = payload?.subscription?.entity;
  const payment = payload?.payment?.entity;
  if (!sub?.id) { console.warn('[WEBHOOK] subscription.charged — payload missing subscription.entity.id'); return; }
  console.log(`[WEBHOOK] subscription.charged — sub_id: ${sub.id} payment_id: ${payment?.id}`);

  const row = await _findBrandSubscription(sub.id);
  if (!row) {
    console.warn(`[WEBHOOK] subscription.charged — no brand_subscription for ${sub.id}`);
    return;
  }

  const cycleDays = row.billing_period === 'yearly' ? 365 : 30;
  const amountInr = row.price_inr ? parseFloat(row.price_inr) : 0;
  const gstInr    = amountInr ? await taxService.gstOn(amountInr) : 0;

  let newInvoiceId = null;
  await db.withTransaction(async (client) => {
    // Idempotent invoice insert — partial unique index on
    // (brand_subscription_id, razorpay_payment_id) prevents duplicates.
    // RETURNING id yields a row ONLY on first delivery; a retry hits the
    // conflict (DO NOTHING) and returns nothing — which is exactly the signal
    // we use below to accrue referral commission once and only once.
    const { rows: invRows } = await client.query(
      `INSERT INTO subscription_invoices
         (brand_subscription_id, brand_id, tier_key, amount_inr,
          gst_amount_inr, period_start, period_end, status, paid_at,
          razorpay_payment_id, razorpay_invoice_id)
       VALUES ($1, $2, $3, $4, $5, current_date,
               current_date + ($6 || ' days')::interval,
               'paid', now(), $7, $8)
       ON CONFLICT (brand_subscription_id, razorpay_payment_id)
         WHERE razorpay_payment_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        row.id, row.brand_id, row.tier_key, amountInr, gstInr,
        String(cycleDays), payment?.id || null, payment?.invoice_id || null,
      ]
    );
    newInvoiceId = invRows[0] ? invRows[0].id : null;
    await client.query(
      `UPDATE brand_subscriptions
          SET last_charged_at      = now(),
              current_cycle_start  = current_date,
              current_cycle_end    = current_date + ($2 || ' days')::interval,
              next_charge_at       = current_date + ($2 || ' days')::interval,
              status               = 'active'
        WHERE id = $1`,
      [row.id, String(cycleDays)]
    );
  });

  // Referral accrual (contract: features/referral-engine). Fire only when a NEW
  // paid invoice was written (newInvoiceId set) — a duplicate webhook delivery
  // skips this, so we never double-accrue. Best-effort + own-transaction:
  // accrue() swallows+logs any error so the subscription charge above stays
  // committed regardless. base_amount = the subscription amount_inr (the
  // platform's slice); referred entity = the brand.
  if (newInvoiceId) {
    await referralService.accrue({
      source:       'subscription',
      sourceRefId:  newInvoiceId,
      referredType: 'brand',
      referredId:   row.brand_id,
      baseAmount:   amountInr,
    });
  }
}

async function handleSubscriptionCycleEnd(payload) {
  const sub = payload?.subscription?.entity;
  if (!sub?.id) return;
  console.log(`[WEBHOOK] subscription.cycle_end — sub_id: ${sub.id}`);
  // Safety-net sync — Razorpay's subscription entity carries fresh
  // cycle dates. We rely on subscription.charged for primary state
  // updates; this is a no-op unless we detect drift in future.
}

async function handleSubscriptionHalted(payload) {
  const sub = payload?.subscription?.entity;
  if (!sub?.id) return;
  console.warn(`[WEBHOOK] subscription.halted — sub_id: ${sub.id}`);

  const row = await _findBrandSubscription(sub.id);
  if (!row) return;
  if (row.mandate_status === 'halted') return; // idempotent

  await db.query(
    `UPDATE brand_subscriptions
        SET status         = 'past_due',
            mandate_status = 'halted'
      WHERE id = $1`,
    [row.id]
  );

  await notificationService.send({
    userId:   row.user_id,
    type:     'subscription.halted',
    title:    'Subscription paused',
    body:     `Your ${row.tier_name} subscription is paused after repeated payment failures. Update your payment method to resume.`,
    data:     { screen: 'subscription', subscription_id: row.id },
    fcmToken: row.fcm_token,
    sendSms:  false,
    phone:    row.phone,
  });
}

// ── order.paid — mid-cycle upgrade proration (Wave 2 commit 4) ──────────────
// Fires when the one-off delta Order (created by subscription.upgrade) is paid.
// Completes the upgrade: cancels the old Razorpay subscription, creates the new
// full-price one starting at the OLD cycle end, swaps brand_subscriptions to
// the target tier (keeping the original cycle end), and writes the proration
// invoice. Idempotent via the proration invoice's razorpay_payment_id.
async function handleProrationOrderPaid(payload) {
  const order   = payload?.order?.entity;
  const payment = payload?.payment?.entity;
  if (!order?.id) { console.warn('[WEBHOOK] order.paid — missing order.entity.id'); return; }
  const notes = order.notes || {};
  if (notes.type !== 'proration') return; // not ours (e.g. a wallet top-up order)

  const paymentId = payment?.id || null;
  console.log(`[WEBHOOK] order.paid (proration) — order ${order.id} payment ${paymentId}`);

  // Idempotency: proration invoice already written for this payment → skip.
  if (paymentId) {
    const { rows: dup } = await db.query(
      `SELECT 1 FROM subscription_invoices WHERE razorpay_payment_id = $1 LIMIT 1`,
      [paymentId]
    );
    if (dup[0]) { console.log('[WEBHOOK] order.paid proration already processed — skip'); return; }
  }

  const brandId       = notes.brand_id;
  const oldSubId      = notes.old_subscription_id;
  const oldRzpSubId   = notes.old_razorpay_subscription_id || null;
  const oldCycleEnd   = notes.old_cycle_end;               // 'YYYY-MM-DD'
  const targetTierId  = notes.target_tier_id;
  const targetPriceId = notes.target_price_id || null;
  const targetPlanId  = notes.target_plan_id || null;
  const billingPeriod = notes.billing_period || 'monthly';
  const targetTierKey = notes.target_tier_key;
  const deltaInr      = parseFloat(notes.delta_inr || '0');
  const deltaGstInr   = parseFloat(notes.delta_gst_inr || '0');

  const { rows: oldRows } = await db.query(
    `SELECT id, status FROM brand_subscriptions WHERE id = $1`, [oldSubId]
  );
  if (!oldRows[0]) { console.warn(`[WEBHOOK] proration — old sub ${oldSubId} not found`); return; }

  // External Razorpay ops (outside the DB txn).
  const razorpayService = require('../services/razorpay.service');
  if (oldRzpSubId) {
    try { await razorpayService.cancelSubscription(oldRzpSubId, { cancel_at_cycle_end: false }); }
    catch (err) { console.warn(`[WEBHOOK] proration — cancel old sub ${oldRzpSubId} failed: ${err.message}`); }
  }
  let newSub = null;
  if (targetPlanId) {
    const startAtEpoch = Math.floor(new Date(oldCycleEnd).getTime() / 1000);
    const totalCount   = billingPeriod === 'yearly' ? 5 : 12;
    try {
      newSub = await razorpayService.createSubscription({
        plan_id:     targetPlanId,
        total_count: totalCount,
        start_at:    startAtEpoch,
        notes: { brand_id: brandId, tier_key: targetTierKey, billing_period: billingPeriod, via: 'proration_upgrade' },
      });
    } catch (err) {
      // Brand already paid the delta → still flip entitlements; the renewal
      // subscription can be retried manually. Don't lose the upgrade.
      console.error(`[WEBHOOK] proration — createSubscription failed: ${err.message}`);
    }
  }

  // DB swap (transactional). Cancel old → insert new active row at the target
  // tier with the ORIGINAL cycle end → write the proration invoice.
  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE brand_subscriptions
          SET status = 'cancelled', cancelled_at = now(),
              cancel_reason = 'upgraded mid-cycle (proration)'
        WHERE id = $1 AND status = 'active'`,
      [oldSubId]
    );
    const renewalNote = newSub?.short_url
      ? JSON.stringify({ renewal_short_url: newSub.short_url, via: 'proration_upgrade' })
      : null;
    const { rows: subRows } = await client.query(
      `INSERT INTO brand_subscriptions
         (brand_id, tier_id, subscription_price_id, status,
          current_cycle_start, current_cycle_end, next_charge_at,
          mandate_status, last_charged_at, razorpay_subscription_id, notes)
       VALUES ($1, $2, $3, 'active', current_date, $4::date, $4::date,
               'pending', now(), $5, $6)
       RETURNING id`,
      [brandId, targetTierId, targetPriceId, oldCycleEnd, newSub?.id || null, renewalNote]
    );
    const newSubId = subRows[0].id;
    await client.query(
      `INSERT INTO subscription_invoices
         (brand_subscription_id, brand_id, tier_key, amount_inr, gst_amount_inr,
          period_start, period_end, status, paid_at, razorpay_payment_id)
       VALUES ($1, $2, $3, $4, $5, current_date, $6::date, 'paid', now(), $7)
       ON CONFLICT (brand_subscription_id, razorpay_payment_id)
         WHERE razorpay_payment_id IS NOT NULL DO NOTHING`,
      [newSubId, brandId, targetTierKey, deltaInr, deltaGstInr, oldCycleEnd, paymentId]
    );
  });

  const { rows: u } = await db.query(
    `SELECT u.id AS user_id, u.fcm_token, u.phone
       FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [brandId]
  );
  if (u[0]) {
    await notificationService.send({
      userId:   u[0].user_id,
      type:     'subscription.upgraded',
      title:    'Plan upgraded',
      body:     `You're on ${targetTierKey} for the rest of this cycle. Authorize UPI Autopay to keep it active at renewal.`,
      data:     { screen: 'subscription' },
      fcmToken: u[0].fcm_token,
      sendSms:  false,
      phone:    u[0].phone,
    });
  }
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
// NOTE: webhook.routes.js mounts express.raw({type:'*/*'}) on this route, so
// req.body is a Buffer containing the raw request bytes. The global
// express.json() in app.js conditionally skips /v1/webhooks/* paths so the
// body stream stays unread until express.raw() captures it. See carved
// defect features/backend-defect-webhook-body-hang/.
// ─────────────────────────────────────────────────────────────────────────────

async function handleWebhook(req, res) {
  // Razorpay sends signature in header.
  const signature = req.headers['x-razorpay-signature'];
  // req.body is a Buffer set by express.raw(); fall back to req.rawBody for
  // backward compatibility with any test that sets it manually.
  const rawBody = (req.body && Buffer.isBuffer(req.body))
    ? req.body
    : (req.rawBody || '');

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[WEBHOOK] Invalid signature — rejected');
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid webhook signature' } });
  }

  let event;
  try {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
    event = bodyStr ? JSON.parse(bodyStr) : {};
  } catch {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON payload' } });
  }

  const eventType = event?.event;
  console.log(`[WEBHOOK] Received: ${eventType}`);

  try {
    switch (eventType) {
      case 'payment.authorized':         await handlePaymentAuthorized(event.payload);        break;
      case 'payment.failed':             await handlePaymentFailed(event.payload);            break;
      case 'payout.processed':           await handlePayoutProcessed(event.payload);          break;
      case 'payout.reversed':            await handlePayoutReversed(event.payload);           break;
      // Phase A6.5 — subscription lifecycle
      case 'subscription.authenticated': await handleSubscriptionAuthenticated(event.payload); break;
      case 'subscription.charged':       await handleSubscriptionCharged(event.payload);       break;
      case 'subscription.cycle_end':     await handleSubscriptionCycleEnd(event.payload);      break;
      case 'subscription.halted':        await handleSubscriptionHalted(event.payload);        break;
      // Phase A13 + Wave 2 commit 4 — mid-cycle upgrade proration
      case 'order.paid':                 await handleProrationOrderPaid(event.payload);        break;
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
