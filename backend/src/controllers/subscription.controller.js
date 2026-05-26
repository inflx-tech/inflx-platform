'use strict';

/**
 * subscription.controller.js — Phase A6 + A6.5 + A13 of the INFLX
 * 3-Layer Revenue Model.
 *
 * L1 SaaS subscription endpoints:
 *   GET  /v1/subscription-tiers           — public read of active tiers
 *   GET  /v1/brands/me/subscription       — current brand sub + usage counters
 *   POST /v1/brands/me/subscription/upgrade
 *                                         — switch to a different tier; charges
 *                                           the first cycle immediately (mock-
 *                                           mode: synthetic; live-mode: Razorpay
 *                                           subscription/mandate flow).
 *   GET  /v1/brands/me/billing/invoices   — invoice history
 *
 * RAZORPAY_MOCK=true (dev/test): upgrade activates immediately + writes a
 *   paid subscription_invoices row + a synthetic razorpay_payment_id.
 * RAZORPAY_MOCK=false (prod, A6.5+): creates a Razorpay subscription
 *   bound to the (tier_key, billing_period) → razorpay_plan_id mapping
 *   stored on subscription_prices. Returns
 *   { status: 'mandate_pending', razorpay_subscription_id, razorpay_key_id }
 *   so the frontend can open Razorpay Checkout in subscription mode for
 *   UPI Autopay mandate authorization. Webhook handlers
 *   (webhook.controller.js) reconcile state via the 5 subscription
 *   lifecycle events. Yearly billing (A13) falls out free — Razorpay's
 *   plan_id encodes the period.
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
// Phase A11: response now includes per-tier `prices` (array of monthly/yearly
// rows from subscription_prices) + `entitlements` (array of feature rows from
// tier_features × features catalog). Lets the brand UI render the full
// upgrade page from a single call. Legacy `monthly_price_inr` + `features_json`
// retained for back-compat with anything still consuming the old shape.
const listTiers = asyncHandler(async (req, res) => {
  const { rows: tiers } = await db.query(
    `SELECT id, tier_key, name, monthly_price_inr, max_campaigns, max_sets_per_campaign,
            max_influencers_per_cycle, max_products, is_enterprise, description,
            features_json, sort_order
       FROM subscription_tiers
      WHERE active = true
      ORDER BY sort_order`
  );

  if (tiers.length === 0) return success(res, { tiers: [] });

  const tierIds = tiers.map(t => t.id);

  // Prices per tier
  const { rows: priceRows } = await db.query(
    `SELECT tier_id, billing_period, price_inr, active, sort_order
       FROM subscription_prices
      WHERE tier_id = ANY($1::uuid[])
      ORDER BY billing_period`,
    [tierIds]
  );
  const pricesByTier = new Map();
  for (const p of priceRows) {
    if (!pricesByTier.has(p.tier_id)) pricesByTier.set(p.tier_id, []);
    pricesByTier.get(p.tier_id).push({
      billing_period: p.billing_period,
      price_inr:      p.price_inr,
      active:         p.active,
      sort_order:     p.sort_order,
    });
  }

  // Entitlements per tier (tier_features × features catalog)
  const { rows: entRows } = await db.query(
    `SELECT tf.tier_id, tf.included, tf.quota_value, tf.config,
            f.feature_key, f.label, f.category, f.feature_type, f.unit,
            f.default_quota, f.sort_order AS feature_sort
       FROM tier_features tf
       JOIN features f ON f.id = tf.feature_id
      WHERE tf.tier_id = ANY($1::uuid[])
        AND f.active = true
      ORDER BY f.sort_order ASC`,
    [tierIds]
  );
  const entsByTier = new Map();
  for (const e of entRows) {
    if (!entsByTier.has(e.tier_id)) entsByTier.set(e.tier_id, []);
    entsByTier.get(e.tier_id).push({
      feature_key:  e.feature_key,
      label:        e.label,
      category:     e.category,
      feature_type: e.feature_type,
      unit:         e.unit,
      included:     e.included,
      quota_value:  e.quota_value != null ? parseFloat(e.quota_value) : null,
      config:       e.config || {},
    });
  }

  const enriched = tiers.map(t => ({
    ...t,
    prices:        pricesByTier.get(t.id) || [],
    entitlements:  entsByTier.get(t.id) || [],
  }));

  return success(res, { tiers: enriched });
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
            t.max_influencers_per_cycle, t.max_products, t.is_enterprise,
            t.description, t.features_json
       FROM brand_subscriptions bs
       JOIN subscription_tiers t ON t.id = bs.tier_id
      WHERE bs.brand_id = $1 AND bs.status = 'active'
      LIMIT 1`,
    [brandId]
  );

  // Entitlements (Phase A10): effective feature map for the brand's active tier.
  const entitlementsService = require('../services/entitlements.service');
  const entResult = await entitlementsService.getEntitlementsPlain(db, brandId);

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
      entitlements: entResult.entitlements,
      tier_key: entResult.tier_key,
    });
  }

  return success(res, {
    subscription: rows[0],
    usage: await _countUsage(brandId, rows[0].current_cycle_start),
    entitlements: entResult.entitlements,
    tier_key: entResult.tier_key,
  });
});

// ── POST /v1/brands/me/subscription/upgrade ──────────────────────────────────
const upgrade = asyncHandler(async (req, res) => {
  const brandId = await _getBrandIdFromUser(req.user.sub);
  if (!brandId) throw new AppError('FORBIDDEN', 'No brand profile for this user', 403);

  const { tier_key, billing_period: rawPeriod } = req.body;
  if (!tier_key || typeof tier_key !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'tier_key required', 422, 'tier_key');
  }
  // Phase A11: billing_period optional, defaults to 'monthly' for back-compat
  // with pre-A11 clients that only sent tier_key.
  const billing_period = (rawPeriod && ['monthly','yearly'].includes(String(rawPeriod)))
    ? String(rawPeriod) : 'monthly';

  const { rows: tierRows } = await db.query(
    `SELECT id, tier_key, name, monthly_price_inr, is_enterprise
       FROM subscription_tiers
      WHERE tier_key = $1 AND active = true`,
    [tier_key]
  );
  if (!tierRows[0]) throw new AppError('NOT_FOUND', `Tier '${tier_key}' not found`, 404, 'tier_key');
  const tier = tierRows[0];

  // Phase A11: look up the active subscription_price for the chosen period.
  // Phase A6.5: also surface razorpay_plan_id for the live-mode flow.
  // Falls back to legacy monthly_price_inr if no price row exists yet
  // (preserves behaviour for tiers that haven't had prices seeded).
  const { rows: priceRows } = await db.query(
    `SELECT id, price_inr, razorpay_plan_id
       FROM subscription_prices
      WHERE tier_id = $1 AND billing_period = $2 AND active = true
      LIMIT 1`,
    [tier.id, billing_period]
  );
  let subscriptionPriceId = priceRows[0]?.id || null;
  let amount = priceRows[0]
    ? parseFloat(priceRows[0].price_inr)
    : (billing_period === 'monthly' ? parseFloat(tier.monthly_price_inr) : null);
  const razorpayPlanId = priceRows[0]?.razorpay_plan_id || null;

  if (amount == null) {
    // Yearly chosen but no yearly price configured by admin yet.
    throw new AppError(
      'VALIDATION_ERROR',
      `Tier '${tier_key}' has no active ${billing_period} price configured`,
      422, 'billing_period'
    );
  }
  // Cycle length: 30 days monthly, 365 days yearly.
  const cycleDays = billing_period === 'yearly' ? 365 : 30;

  const isMock = String(env.RAZORPAY_MOCK).toLowerCase() === 'true';

  if (!isMock) {
    // Phase A6.5 + A13 — real Razorpay Subscriptions + UPI Autopay
    // mandate flow. Returns { status: 'mandate_pending',
    // razorpay_subscription_id, razorpay_key_id } so the frontend can
    // open Razorpay Checkout in subscription mode. Webhook handlers
    // (webhook.controller.js) flip the subscription to 'active' on
    // subscription.authenticated and write the first paid invoice on
    // subscription.charged.
    if (!razorpayPlanId) {
      // Admin hasn't pasted the plan_id from Razorpay dashboard yet —
      // graceful 422 (not 500). Brand sees a friendly message via
      // the QuotaWallModal / error toast.
      throw new AppError(
        'ADMIN_CONFIG_MISSING',
        'Subscription setup is in progress, please check back shortly.',
        422,
        'razorpay_plan_id',
        {
          tier_key:       tier.tier_key,
          billing_period,
          admin_hint:     'Paste the Razorpay plan_id in /admin/pricing/tiers/[tier_key] Section B.',
        }
      );
    }

    // total_count: how many billing cycles before Razorpay auto-cancels.
    // Monthly subscriptions get 12 cycles (1 year); yearly get 5 cycles
    // (5 years). Brands can re-subscribe afterwards.
    const totalCount = billing_period === 'yearly' ? 5 : 12;

    const razorpayService = require('../services/razorpay.service');
    let rzpSub;
    try {
      rzpSub = await razorpayService.createSubscription({
        plan_id:     razorpayPlanId,
        total_count: totalCount,
        notes: {
          brand_id:       brandId,
          tier_key:       tier.tier_key,
          billing_period,
        },
      });
    } catch (err) {
      // Razorpay API failure — surface to user, no DB writes.
      console.error('[upgrade] Razorpay createSubscription failed:', err.message);
      throw new AppError(
        'PAYMENT_PROVIDER_UNAVAILABLE',
        'Payment provider is temporarily unavailable. Please try again in a moment.',
        502,
        'razorpay'
      );
    }

    // Cancel any prior active sub + INSERT a new pending_mandate sub.
    // brand_subscriptions.status='pending_mandate' is the new transitional
    // state; subscription.authenticated webhook flips it to 'active'.
    let createdSubId;
    await db.withTransaction(async (client) => {
      await client.query(
        `UPDATE brand_subscriptions
            SET status = 'cancelled', cancelled_at = now()
          WHERE brand_id = $1 AND status IN ('active','pending_mandate')`,
        [brandId]
      );
      const { rows: subRows } = await client.query(
        `INSERT INTO brand_subscriptions
           (brand_id, tier_id, subscription_price_id, status,
            mandate_status, razorpay_subscription_id)
         VALUES ($1, $2, $3, 'pending_mandate', 'pending', $4)
         RETURNING id`,
        [brandId, tier.id, subscriptionPriceId, rzpSub.id]
      );
      createdSubId = subRows[0].id;
    });

    return success(res, {
      status:                  'mandate_pending',
      mode:                    'live',
      subscription_id:         createdSubId,
      razorpay_subscription_id: rzpSub.id,
      razorpay_key_id:         env.RAZORPAY_KEY_ID,
      razorpay_short_url:      rzpSub.short_url, // brand can also pay via this link if Checkout fails
      tier_key:                tier.tier_key,
      tier_name:               tier.name,
      billing_period,
      amount_inr:              amount,
      gst_amount_inr:          parseFloat((amount * GST_PCT / 100).toFixed(2)),
      total_inr:               parseFloat((amount * (1 + GST_PCT / 100)).toFixed(2)),
      message:                 `Subscription created — complete the UPI Autopay mandate to activate.`,
    }, 201);
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
         (brand_id, tier_id, subscription_price_id, status,
          current_cycle_start, current_cycle_end, next_charge_at,
          mandate_status, last_charged_at,
          razorpay_subscription_id, razorpay_mandate_id)
       VALUES ($1, $2, $3, 'active', current_date,
               current_date + ($4 || ' days')::interval,
               current_date + ($4 || ' days')::interval,
               'active', now(), $5, $6)
       RETURNING id`,
      [brandId, tier.id, subscriptionPriceId, String(cycleDays),
       `sub_mock_${Date.now()}`, `mandate_mock_${Date.now()}`]
    );
    createdSubId = subRows[0].id;

    // For Free tier (amount=0) write a zero-amount invoice (book-keeping only).
    const gstAmount = parseFloat((amount * GST_PCT / 100).toFixed(2));
    const { rows: invRows } = await client.query(
      `INSERT INTO subscription_invoices
         (brand_subscription_id, brand_id, tier_key, amount_inr, gst_amount_inr,
          period_start, period_end, status, paid_at, razorpay_payment_id)
       VALUES ($1, $2, $3, $4, $5, current_date,
               current_date + ($6 || ' days')::interval,
               'paid', now(), $7)
       RETURNING id, total_inr`,
      [
        createdSubId, brandId, tier.tier_key, amount, gstAmount,
        String(cycleDays), `pay_mock_${Date.now()}`,
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
    billing_period,
    amount_inr:    amount,
    gst_amount_inr: parseFloat((amount * GST_PCT / 100).toFixed(2)),
    total_inr:     parseFloat((amount * (1 + GST_PCT / 100)).toFixed(2)),
    message:       `Subscribed to ${tier.name} ${billing_period} (mock mode — no real Razorpay charge).`,
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS  (Phase A7-admin)
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /v1/brands/me/quota-preflight?action=…&campaign_id=… ────────────────
// Phase A12.1.5: frontend calls this on entry-button click (e.g. "+ New
// campaign", "+ Add product") to decide whether to open the create flow
// OR show the upgrade popup immediately. Same logic as the middleware
// gate, but returns the state as JSON instead of throwing 422.
const VALID_PREFLIGHT_ACTIONS = ['createCampaign', 'createProduct', 'createSet', 'inviteInfluencer'];
const { evaluateQuota } = require('../middleware/quotaCheck');
const quotaPreflight = asyncHandler(async (req, res) => {
  const action = String(req.query.action || '').trim();
  if (!VALID_PREFLIGHT_ACTIONS.includes(action)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `action must be one of: ${VALID_PREFLIGHT_ACTIONS.join(', ')}`,
      422, 'action'
    );
  }
  // For createSet preflight, frontend should pass ?campaign_id=… so the
  // counter can compute sets-in-that-campaign correctly. The evaluator
  // reads it from req.query just like the middleware would from req.params.
  if (action === 'createSet' && req.query.campaign_id) {
    req.params = req.params || {};
    req.params.campaignId = req.query.campaign_id;
  }
  const r = await evaluateQuota(req, action);
  return success(res, r);
});

// ── GET /v1/admin/subscription-tiers ─────────────────────────────────────────
const adminListTiers = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, tier_key, name, monthly_price_inr, max_campaigns,
            max_sets_per_campaign, max_influencers_per_cycle, max_products,
            is_enterprise, active, sort_order, description, features_json,
            updated_at, updated_by
       FROM subscription_tiers
      ORDER BY sort_order ASC, monthly_price_inr ASC`
  );
  return success(res, { tiers: rows });
});

// ── POST /v1/admin/subscription-tiers ────────────────────────────────────────
// Phase A10.5: create a new tier with safe defaults. Body: {tier_key, name, description?}.
// Inserts tier row + 1 monthly subscription_prices row at ₹0 + tier_features rows
// for every existing catalog feature with included=false, quota_value=catalog default,
// config={}. Admin then edits everything in the detail page.
const SLUG_RE = /^[a-z][a-z0-9_]{1,39}$/;
const adminCreateTier = asyncHandler(async (req, res) => {
  const tierKey = String(req.body.tier_key || '').trim().toLowerCase();
  const name    = String(req.body.name || '').trim();
  const description = req.body.description == null ? null : String(req.body.description).trim() || null;

  if (!SLUG_RE.test(tierKey)) {
    throw new AppError('VALIDATION_ERROR', 'tier_key must be lowercase letters/digits/underscores, start with a letter, 2-40 chars', 422, 'tier_key');
  }
  if (name.length < 2 || name.length > 80) {
    throw new AppError('VALIDATION_ERROR', 'name must be 2-80 chars', 422, 'name');
  }
  if (description && description.length > 500) {
    throw new AppError('VALIDATION_ERROR', 'description must be ≤ 500 chars', 422, 'description');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Insert tier with safe defaults (all quotas 0 = not allowed; admin sets per-feature in detail).
    const { rows: tierRows } = await client.query(
      `INSERT INTO subscription_tiers
         (tier_key, name, description, monthly_price_inr, max_campaigns,
          max_sets_per_campaign, max_influencers_per_cycle, max_products,
          is_enterprise, active, sort_order, features_json)
       VALUES ($1, $2, $3, 0, 0, 0, 0, 0, false, true,
               COALESCE((SELECT MAX(sort_order) FROM subscription_tiers), 0) + 1,
               '[]'::jsonb)
       RETURNING *`,
      [tierKey, name, description]
    );
    const tier = tierRows[0];

    // Seed tier_features for every existing active feature (included=false by default).
    await client.query(
      `INSERT INTO tier_features (tier_id, feature_id, included, quota_value, config, notes)
       SELECT $1, f.id,
              false,
              CASE WHEN f.feature_type = 'quota' THEN f.default_quota ELSE NULL END,
              '{}'::jsonb,
              'Auto-seeded on tier create (' || now()::date::text || ')'
         FROM features f
        WHERE f.active = true
       ON CONFLICT (tier_id, feature_id) DO NOTHING`,
      [tier.id]
    );

    // Seed one monthly price row at ₹0 (admin sets real price in detail).
    await client.query(
      `INSERT INTO subscription_prices (tier_id, billing_period, price_inr, active, sort_order)
       VALUES ($1, 'monthly', 0, true, 1)
       ON CONFLICT (tier_id, billing_period) DO NOTHING`,
      [tier.id]
    );

    await client.query('COMMIT');
    return success(res, { tier }, 201);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {  // unique_violation
      throw new AppError('CONFLICT', `Tier with key '${tierKey}' already exists`, 409, 'tier_key');
    }
    throw err;
  } finally {
    client.release();
  }
});

// ── PATCH /v1/admin/subscription-tiers/:tierKey ──────────────────────────────
const adminUpdateTier = asyncHandler(async (req, res) => {
  const { tierKey } = req.params;
  const allowed = ['name', 'monthly_price_inr', 'max_campaigns', 'max_sets_per_campaign',
                   'max_influencers_per_cycle', 'max_products', 'is_enterprise',
                   'active', 'sort_order', 'description', 'features_json'];

  // Validation
  if (req.body.monthly_price_inr !== undefined) {
    const v = parseFloat(req.body.monthly_price_inr);
    if (isNaN(v) || v < 0) {
      throw new AppError('VALIDATION_ERROR', 'monthly_price_inr must be ≥ 0', 422, 'monthly_price_inr');
    }
  }
  for (const k of ['max_campaigns', 'max_sets_per_campaign',
                   'max_influencers_per_cycle', 'max_products']) {
    if (req.body[k] !== undefined) {
      const v = parseInt(req.body[k], 10);
      if (isNaN(v) || (v !== -1 && v < 0)) {
        throw new AppError('VALIDATION_ERROR',
          `${k} must be -1 (unlimited) or a non-negative integer`, 422, k);
      }
    }
  }
  // features_json must be an array of strings (we store as jsonb).
  if (req.body.features_json !== undefined) {
    const v = req.body.features_json;
    if (!Array.isArray(v) || !v.every(s => typeof s === 'string' && s.trim().length > 0 && s.length <= 200)) {
      throw new AppError('VALIDATION_ERROR',
        'features_json must be an array of non-empty strings (max 200 chars each)', 422, 'features_json');
    }
  }

  const sets = [], params = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      // jsonb columns need explicit cast in node-postgres.
      if (k === 'features_json') {
        params.push(JSON.stringify(req.body[k]));
        sets.push(`${k} = $${params.length}::jsonb`);
      } else {
        params.push(req.body[k]);
        sets.push(`${k} = $${params.length}`);
      }
    }
  }
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'No editable fields supplied', 422);

  sets.push(`updated_at = now()`);
  params.push(req.user.sub);
  sets.push(`updated_by = $${params.length}`);
  params.push(tierKey);

  const { rows } = await db.query(
    `UPDATE subscription_tiers SET ${sets.join(', ')}
      WHERE tier_key = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', `Tier '${tierKey}' not found`, 404);
  return success(res, { tier: rows[0] });
});

// ── GET /v1/admin/subscriptions ──────────────────────────────────────────────
const adminListSubscriptions = asyncHandler(async (req, res) => {
  const { status, tier_key } = req.query;
  const limit  = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;

  const params = [];
  const where = [];
  if (status)   { params.push(status);   where.push(`bs.status = $${params.length}`); }
  if (tier_key) { params.push(tier_key); where.push(`t.tier_key = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT bs.id, bs.brand_id, bs.status, bs.current_cycle_start,
            bs.current_cycle_end, bs.next_charge_at, bs.razorpay_subscription_id,
            bs.razorpay_mandate_id, bs.mandate_status, bs.last_charged_at,
            bs.cancelled_at, bs.created_at,
            t.tier_key, t.name AS tier_name, t.monthly_price_inr,
            b.business_name
       FROM brand_subscriptions bs
       JOIN subscription_tiers t ON t.id = bs.tier_id
       JOIN brands b             ON b.id = bs.brand_id
      ${whereSql}
      ORDER BY bs.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, -2);
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS c
       FROM brand_subscriptions bs
       JOIN subscription_tiers t ON t.id = bs.tier_id
      ${whereSql}`,
    countParams
  );
  return success(res, { subscriptions: rows, total: countRows[0].c });
});

// ── GET /v1/admin/subscription-invoices ──────────────────────────────────────
const adminListInvoices = asyncHandler(async (req, res) => {
  const { status, tier_key, brand_id, since } = req.query;
  const limit  = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;

  const params = [];
  const where = [];
  if (status)    { params.push(status);   where.push(`si.status = $${params.length}`); }
  if (tier_key)  { params.push(tier_key); where.push(`si.tier_key = $${params.length}`); }
  if (brand_id)  { params.push(brand_id); where.push(`si.brand_id = $${params.length}`); }
  if (since)     { params.push(since);    where.push(`si.created_at >= $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT si.id, si.brand_id, si.tier_key, si.amount_inr, si.gst_amount_inr,
            si.total_inr, si.period_start, si.period_end, si.status,
            si.paid_at, si.razorpay_payment_id, si.razorpay_invoice_id,
            si.invoice_pdf_r2_key, si.failure_reason, si.created_at,
            b.business_name
       FROM subscription_invoices si
       JOIN brands b ON b.id = si.brand_id
      ${whereSql}
      ORDER BY si.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, -2);
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM subscription_invoices si ${whereSql}`,
    countParams
  );
  return success(res, { invoices: rows, total: countRows[0].c });
});

module.exports = {
  // Public + brand
  listTiers, getSubscription, upgrade, listInvoices, quotaPreflight,
  // Admin (Phase A7-admin)
  adminListTiers, adminCreateTier, adminUpdateTier, adminListSubscriptions, adminListInvoices,
};
