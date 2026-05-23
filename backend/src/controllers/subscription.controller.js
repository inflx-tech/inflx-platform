'use strict';

/**
 * subscription.controller.js — Phase A6 of the INFLX 3-Layer Revenue Model.
 *
 * L1 SaaS subscription endpoints:
 *   GET  /v1/subscription-tiers           — public read of active tiers
 *   GET  /v1/brands/me/subscription       — current brand sub + usage counters
 *   POST /v1/brands/me/subscription/upgrade
 *                                         — switch to a different tier; charges
 *                                           the first cycle immediately (mock-
 *                                           mode: synthetic; live-mode: Razorpay
 *                                           subscription/mandate flow — TODO).
 *   GET  /v1/brands/me/billing/invoices   — invoice history
 *
 * RAZORPAY_MOCK=true (dev/test): upgrade activates immediately + writes a
 *   paid subscription_invoices row + a synthetic razorpay_payment_id.
 * RAZORPAY_MOCK=false (prod): TODO — create Razorpay Subscription/Customer
 *   + UPI Autopay mandate; return short_url for customer consent; webhook
 *   handler completes activation on subscription.activated event. Real
 *   integration is a follow-up; the API shape stays identical so the
 *   front-end (Phase A7) is forward-compatible.
 */

const db = require('../config/db');
const env = require('../config/env');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const GST_PCT = 18.00;

async function _getBrandIdFromUser(userId) {
  const { rows } = await db.query(
    `SELECT id FROM brands WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0]?.id || null;
}

async function _countUsage(brandId, cycleStart) {
  const [c, p, inv] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS c FROM campaigns
        WHERE brand_id = $1 AND status NOT IN ('completed','cancelled')`,
      [brandId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS c FROM brand_products WHERE brand_id = $1`,
      [brandId]
    ),
    db.query(
      `SELECT COUNT(DISTINCT ci.id)::int AS c
         FROM campaign_influencers ci
         JOIN campaign_sets cs ON cs.id = ci.set_id
         JOIN campaigns c     ON c.id  = cs.campaign_id
        WHERE c.brand_id = $1 AND ci.created_at >= $2`,
      [brandId, cycleStart]
    ),
  ]);
  return {
    campaigns: c.rows[0].c,
    products:  p.rows[0].c,
    influencer_invites_this_cycle: inv.rows[0].c,
  };
}

// ── GET /v1/subscription-tiers ───────────────────────────────────────────────
const listTiers = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT tier_key, name, monthly_price_inr, max_campaigns, max_sets_per_campaign,
            max_influencers_per_cycle, max_products, is_enterprise, description,
            sort_order
       FROM subscription_tiers
      WHERE active = true
      ORDER BY sort_order`
  );
  return success(res, { tiers: rows });
});

// ── GET /v1/brands/me/subscription ───────────────────────────────────────────
const getSubscription = asyncHandler(async (req, res) => {
  const brandId = await _getBrandIdFromUser(req.user.sub);
  if (!brandId) throw new AppError('FORBIDDEN', 'No brand profile for this user', 403);

  const { rows } = await db.query(
    `SELECT bs.id, bs.status, bs.current_cycle_start, bs.current_cycle_end,
            bs.next_charge_at, bs.mandate_status, bs.razorpay_mandate_id,
            bs.razorpay_subscription_id, bs.last_charged_at,
            t.tier_key, t.name AS tier_name, t.monthly_price_inr,
            t.max_campaigns, t.max_sets_per_campaign,
            t.max_influencers_per_cycle, t.max_products, t.is_enterprise
       FROM brand_subscriptions bs
       JOIN subscription_tiers t ON t.id = bs.tier_id
      WHERE bs.brand_id = $1 AND bs.status = 'active'
      LIMIT 1`,
    [brandId]
  );

  if (!rows[0]) {
    // No active sub — return a synthetic Free view (matches lazy-create default)
    const { rows: freeRows } = await db.query(
      `SELECT tier_key, name AS tier_name, monthly_price_inr, max_campaigns,
              max_sets_per_campaign, max_influencers_per_cycle, max_products, is_enterprise
         FROM subscription_tiers WHERE tier_key = 'free' LIMIT 1`
    );
    return success(res, {
      subscription: null,
      tier: freeRows[0] || null,
      usage: await _countUsage(brandId, new Date(Date.now() - 30 * 86400_000)),
    });
  }

  return success(res, {
    subscription: rows[0],
    usage: await _countUsage(brandId, rows[0].current_cycle_start),
  });
});

// ── POST /v1/brands/me/subscription/upgrade ──────────────────────────────────
const upgrade = asyncHandler(async (req, res) => {
  const brandId = await _getBrandIdFromUser(req.user.sub);
  if (!brandId) throw new AppError('FORBIDDEN', 'No brand profile for this user', 403);

  const { tier_key } = req.body;
  if (!tier_key || typeof tier_key !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'tier_key required', 422, 'tier_key');
  }

  const { rows: tierRows } = await db.query(
    `SELECT id, tier_key, name, monthly_price_inr, is_enterprise
       FROM subscription_tiers
      WHERE tier_key = $1 AND active = true`,
    [tier_key]
  );
  if (!tierRows[0]) throw new AppError('NOT_FOUND', `Tier '${tier_key}' not found`, 404, 'tier_key');
  const tier = tierRows[0];
  const amount = parseFloat(tier.monthly_price_inr);

  const isMock = String(env.RAZORPAY_MOCK).toLowerCase() === 'true';

  if (!isMock) {
    // TODO Phase A6.5: real Razorpay Subscriptions + UPI Autopay mandate flow.
    // Until then the live-mode endpoint returns 501 explicitly — front-end
    // (Phase A7) can detect and show a "coming soon" state. The mock-mode
    // path is feature-complete for dev + staging exercising of the UX.
    throw new AppError(
      'INTERNAL_ERROR',
      'Razorpay live subscription flow not yet wired (set RAZORPAY_MOCK=true to exercise upgrade end-to-end)',
      501
    );
  }

  // Mock-mode: cancel any prior active sub, insert new active sub at the
  // requested tier, write a paid invoice for the first cycle.
  let createdSubId, invoiceId;
  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE brand_subscriptions
          SET status = 'cancelled', cancelled_at = now()
        WHERE brand_id = $1 AND status = 'active'`,
      [brandId]
    );

    const { rows: subRows } = await client.query(
      `INSERT INTO brand_subscriptions
         (brand_id, tier_id, status, current_cycle_start, current_cycle_end,
          next_charge_at, mandate_status, last_charged_at,
          razorpay_subscription_id, razorpay_mandate_id)
       VALUES ($1, $2, 'active', current_date, current_date + 30,
               current_date + 30, 'active', now(), $3, $4)
       RETURNING id`,
      [brandId, tier.id, `sub_mock_${Date.now()}`, `mandate_mock_${Date.now()}`]
    );
    createdSubId = subRows[0].id;

    // For Free tier (amount=0) write a zero-amount invoice (book-keeping only).
    const gstAmount = parseFloat((amount * GST_PCT / 100).toFixed(2));
    const { rows: invRows } = await client.query(
      `INSERT INTO subscription_invoices
         (brand_subscription_id, brand_id, tier_key, amount_inr, gst_amount_inr,
          period_start, period_end, status, paid_at, razorpay_payment_id)
       VALUES ($1, $2, $3, $4, $5, current_date, current_date + 30,
               $6, now(), $7)
       RETURNING id, total_inr`,
      [
        createdSubId, brandId, tier.tier_key, amount, gstAmount,
        amount > 0 ? 'paid' : 'paid',     // free still "paid" — zero invoice closes the cycle
        `pay_mock_${Date.now()}`,
      ]
    );
    invoiceId = invRows[0].id;
  });

  return success(res, {
    status:        'activated',
    mode:          'mock',
    subscription_id: createdSubId,
    invoice_id:    invoiceId,
    tier_key:      tier.tier_key,
    amount_inr:    amount,
    gst_amount_inr: parseFloat((amount * GST_PCT / 100).toFixed(2)),
    total_inr:     parseFloat((amount * (1 + GST_PCT / 100)).toFixed(2)),
    message:       `Subscribed to ${tier.name} (mock mode — no real Razorpay charge).`,
  }, 201);
});

// ── GET /v1/brands/me/billing/invoices ───────────────────────────────────────
const listInvoices = asyncHandler(async (req, res) => {
  const brandId = await _getBrandIdFromUser(req.user.sub);
  if (!brandId) throw new AppError('FORBIDDEN', 'No brand profile for this user', 403);

  const { rows } = await db.query(
    `SELECT id, tier_key, amount_inr, gst_amount_inr, total_inr,
            period_start, period_end, status, paid_at, razorpay_payment_id,
            razorpay_invoice_id, invoice_pdf_r2_key, failure_reason, created_at
       FROM subscription_invoices
      WHERE brand_id = $1
      ORDER BY created_at DESC
      LIMIT 100`,
    [brandId]
  );
  return success(res, { invoices: rows });
});

module.exports = { listTiers, getSubscription, upgrade, listInvoices };
