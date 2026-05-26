# 06-diff — billing-razorpay-live (A6.5 + A13)

**Before:** `subscription.controller.upgrade` had two paths gated by
`RAZORPAY_MOCK`:

- **Mock mode (`RAZORPAY_MOCK=true`)**: synthetic happy path — flip
  any prior active sub to cancelled, INSERT a new active sub with
  fake `razorpay_subscription_id` like `sub_mock_<timestamp>`, write
  a paid invoice with `razorpay_payment_id=pay_mock_<timestamp>`.
  Returns 201 immediately. No Razorpay API calls.
- **Live mode (`RAZORPAY_MOCK=false`)**: 501 NOT_IMPLEMENTED with
  message *"Razorpay live subscription flow not yet wired"*. Brand
  cannot upgrade at all in this mode.

The 4 webhook events handled (`payment.authorized`, `payment.failed`,
`payout.processed`, `payout.reversed`) didn't include any
subscription-lifecycle events, so even if the live path had been
wired, mandate-authentication and recurring charges would have
nothing to update state from.

`RAZORPAY_MOCK=false` is already set on Render, so any Upgrade
attempt on prod today hits the 501.

**After (A6.5 + A13):**

**Backend**

1. **`razorpay.service.js`** — thin SDK wrapper. Three functions:
   `createSubscription`, `fetchSubscription`, `cancelSubscription`.
   Reads env keys, calls the official razorpay npm v2.9.6 SDK.

2. **`subscription.controller.upgrade`** — live-mode path replaces
   the 501 stub:
   - Resolves the brand's chosen (tier_key, billing_period) to a
     `razorpay_plan_id` from `subscription_prices`.
   - If NULL → 422 ADMIN_CONFIG_MISSING (graceful — admin hasn't
     pasted the plan_id yet).
   - Creates a Razorpay subscription with the plan_id.
   - INSERTs a brand_subscriptions row with
     `status='pending_mandate'`, `mandate_status='pending'`, the
     Razorpay subscription_id stored.
   - Returns `{ status: 'mandate_pending',
     razorpay_subscription_id, razorpay_key_id }` so the frontend
     can launch Checkout.

3. **`webhook.controller`** — 5 new event handlers:
   - `subscription.authenticated` → brand_subscriptions to
     status='active', mandate_status='active', sets cycle dates +
     mandate_id. Notifies brand.
   - `subscription.charged` → INSERTs a paid invoice, updates
     last_charged_at + next_charge_at.
   - `subscription.cycle_end` → safety-net sync of cycle dates.
   - `subscription.halted` → status='past_due',
     mandate_status='halted'. Notifies brand + admin alert.
   - `payment.failed` → INSERTs failed invoice with
     failure_reason. Notifies brand.

4. **`subscription_prices.razorpay_plan_id`** (M070) — additive
   column with a small index. Plus a partial unique index on
   `subscription_invoices(brand_subscription_id, razorpay_payment_id)`
   so duplicate webhook deliveries can't double-write an invoice.

**Frontend**

5. **brand-web Subscription page** — Razorpay Checkout SDK script
   tag (lazy-loaded). Upgrade handler now handles two response
   shapes:
   - `status: 'activated'` (mock mode — unchanged) → refresh page.
   - `status: 'mandate_pending'` (live mode — new) → open
     `new window.Razorpay({ key, subscription_id, … })`. Handler
     polls `GET /v1/brands/me/subscription` every 2s for
     `mandate_status='active'`, then refreshes.

6. **admin tier editor** — Section B price rows get an extra text
   input: **Razorpay plan_id**. Admin pastes plan_NXyz123… after
   creating each plan on the Razorpay dashboard. PATCH to existing
   updatePrice endpoint (extended to accept the column).

**Tier table after admin pastes all 6 plan_ids:**

| tier_id | billing_period | price_inr | razorpay_plan_id |
|---------|----------------|-----------|------------------|
| growth.id | monthly | 999 | plan_NXyz_growth_m |
| growth.id | yearly | 9999 | plan_NXyz_growth_y |
| pro.id | monthly | 2499 | plan_NXyz_pro_m |
| pro.id | yearly | 24999 | plan_NXyz_pro_y |
| enterprise.id | monthly | 7999 | plan_NXyz_ent_m |
| enterprise.id | yearly | 79999 | plan_NXyz_ent_y |

(Amounts illustrative — your real prices from `subscription_prices`.)

**Defensive behaviour:**
- **Mock mode untouched** — devs flipping `RAZORPAY_MOCK=true`
  locally still get the synthetic flow.
- **plan_id NULL** → 422 ADMIN_CONFIG_MISSING with friendly copy.
  Until admin completes setup, no live Upgrade attempt 500s.
- **Webhook idempotency** — UPSERT-style updates on brand_subscriptions;
  invoices protected by partial unique index on
  (brand_subscription_id, razorpay_payment_id) where
  razorpay_payment_id is not null.
- **Webhook signature** — existing HMAC-SHA256 verification with
  `RAZORPAY_WEBHOOK_SECRET` covers all subscription events too
  (single verify path).
- **Razorpay API failure on upgrade** → service throws → controller
  returns 502, no brand_subscriptions row written, no leaked state.

**Yearly billing (A13) — falls out free:**
The existing `cycleDays = billing_period === 'yearly' ? 365 : 30`
already handles cycle math. Razorpay's plan_id encodes the period,
so picking a yearly plan_id means Razorpay charges annually
automatically. No special yearly code path; same `createSubscription`
call.

**Verified locally:** the contract pre-flight runs M070 on dev DB,
the SDK loads cleanly with mocked-out env (key='rzp_test_mock' from
env.js default), backend boots; pnpm qa stays 76/76 GREEN.
