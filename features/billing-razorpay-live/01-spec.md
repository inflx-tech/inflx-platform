# billing-razorpay-live — Phase A6.5 + A13

> Real Razorpay Subscriptions + UPI Autopay mandate flow. Replaces the
> 501 stub that's been in `subscription.controller.upgrade` since A6.
> Folds A13 (yearly billing live) in — yearly falls out free once the
> Razorpay subscription cadence is wired (the existing `cycleDays =
> 30 vs 365` math + `subscription_prices.billing_period` rows already
> support it; the only difference between monthly and yearly is which
> Razorpay plan_id you create the subscription against).

## What ships

**Migration M070 — `subscription_prices.razorpay_plan_id`**

Additive column on the existing `subscription_prices` table. Holds
the Razorpay `plan_NXyz123…` identifier per (tier × billing_period)
row. NULL = mock-mode fallback (defensive backward compat for any
admin who flips RAZORPAY_MOCK back to true). Idempotent.

**Backend — `razorpay.service.js` (new)**

Thin wrapper over the official `razorpay` npm SDK (already in
`backend/package.json` v2.9.6). Three functions:

- `createSubscription({ plan_id, total_count, notes })` →
  `{ id, plan_id, status, short_url }`.
  Calls Razorpay's POST /v1/subscriptions with `customer_notify=1`
  (Razorpay emails the brand the UPI Autopay collect link if checkout
  isn't used), `notes` carry our brand_id + tier_key for correlation
  in webhook payloads.
- `fetchSubscription(subscription_id)` — for status reconciliation.
- `cancelSubscription(subscription_id, { cancel_at_cycle_end })` —
  used by future downgrade / cancellation flows (out of A6.5 scope
  but cheap to add now).

Reads `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` from env. Defaults to
the existing test-mode keys already on Render.

**Backend — `subscription.controller.upgrade` rewrite**

Live-mode path (`RAZORPAY_MOCK=false`):

1. Resolve `(tier_id, billing_period) → razorpay_plan_id` via
   subscription_prices lookup. If NULL → return **422
   ADMIN_CONFIG_MISSING** with message *"Razorpay plan_id not
   configured for this tier — admin must paste it in
   /admin/pricing/tiers/[tier_key]"* (Free brand sees a graceful
   "coming soon" until admin completes setup; nothing 500s).
2. Cancel any prior active brand_subscriptions row (status=cancelled).
3. INSERT a new brand_subscriptions row with
   `status='pending_mandate'`, `razorpay_subscription_id` (from the
   service call), `mandate_status='pending'`.
4. Return `{ razorpay_subscription_id, razorpay_key_id, status:
   'mandate_pending' }` so the frontend can open Razorpay Checkout in
   subscription mode.
5. The actual mandate creation + first charge happen in Razorpay's
   hosted UI; webhooks reconcile state.

Mock-mode path stays untouched (existing synthetic flow for dev).

**Backend — webhook lifecycle handlers (5 new events)**

Extends `webhook.controller.js`. All handlers are idempotent on
Razorpay's `event.id` so duplicate deliveries are safe.

| Event | Handler does |
|-------|--------------|
| `subscription.authenticated` | Flip brand_subscriptions: `status='active'`, `mandate_status='active'`, set `razorpay_mandate_id`, `current_cycle_start=today`, `current_cycle_end=today+cycleDays`. Notify brand "Subscription active". |
| `subscription.charged` | Write a `subscription_invoices` row (status='paid'), update `last_charged_at`, advance `next_charge_at` to next cycle. |
| `subscription.cycle_end` | Safety-net sync — refresh cycle dates from Razorpay's subscription response. |
| `subscription.halted` | Flip `mandate_status='halted'`, `status='past_due'`. Notify brand + flag admin alert. |
| `payment.failed` | Write a `subscription_invoices` row (status='failed', `failure_reason` captured). Notify brand. |

Subscription events are matched to a brand_subscriptions row via the
`razorpay_subscription_id` column. Idempotency table not needed —
the operations are themselves idempotent (UPSERT-style updates).

**Backend — `RAZORPAY_LIVE_TEST_VPAS` allowed list** (defensive only)

A tiny utility in the service for `success@razorpay` /
`failure@razorpay` test VPAs. Not used at runtime; documented in
the contract for the post-deploy test plan.

**Frontend — Razorpay Checkout SDK integration**

`Packages/brand-web/app/dashboard/settings/subscription/page.js`:

1. Add `<Script src="https://checkout.razorpay.com/v1/checkout.js" />`
   to the layout (next/script).
2. The existing **Upgrade** button handler:
   - Calls `brandApi.upgradeSubscription({ tier_key, billing_period })`.
   - In mock-mode (current behaviour): backend returns
     `{ status: 'activated', mode: 'mock' }` → just refresh the page.
   - In live-mode (new): backend returns `{ status:
     'mandate_pending', razorpay_subscription_id, razorpay_key_id }`
     → open Razorpay Checkout:
     ```js
     const rzp = new window.Razorpay({
       key: data.razorpay_key_id,
       subscription_id: data.razorpay_subscription_id,
       name: 'INFLX',
       description: `${tier_name} ${billing_period} subscription`,
       handler: async () => {
         showToast('Verifying mandate…');
         // Poll /v1/brands/me/subscription every 2s for mandate_status='active'
         await pollUntilActive();
         router.refresh();
       },
       modal: { ondismiss: () => showToast('Upgrade cancelled') },
     });
     rzp.open();
     ```

**Admin UI — `razorpay_plan_id` field on price editor**

Tier editor at `/admin/pricing/tiers/[tier_key]` Section B (Pricing)
gets an additional text input per price row: **Razorpay plan_id**.
Admin pastes `plan_NXyz123…` after creating the plan on Razorpay
dashboard. Saves via the existing `updatePrice` PATCH endpoint
(extended to accept the new column).

## Verify-twice

- `razorpay` npm v2.9.6 already installed (`backend/package.json`).
- Env config (`backend/src/config/env.js:56-59`) already maps
  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET.
  All three set on Render (founder-verified screenshot 2026-05-26).
- Webhook signature verification already implemented
  (`webhook.controller.js:23-30`) — just need to add subscription
  event cases to the existing switch.
- `brand_subscriptions` schema already has every column we write
  to (`razorpay_subscription_id`, `razorpay_mandate_id`,
  `mandate_status`, `next_charge_at`, `current_cycle_start`,
  `current_cycle_end`, `last_charged_at`). No new columns needed
  beyond M070's `razorpay_plan_id` on `subscription_prices`.
- `subscription_invoices` already has `razorpay_payment_id`,
  `razorpay_invoice_id`, `status`, `paid_at`, `failure_reason`.
- The renewal cron at `subscription-renewal.job.js` becomes a
  webhook-sync safety net rather than the primary trigger (Razorpay
  auto-charges via the mandate). Leaving the cron in place; future
  work can repurpose it for reconciliation reports.

## Out of scope

- **Razorpay Plans creation on the dashboard** — that's founder's
  manual setup step (6 plans: Growth/Pro/Enterprise × Monthly/Yearly).
  Documented in 02-workflow.md; the admin UI accepts whatever IDs
  the founder enters.
- **Downgrade / cancellation UX** — the service exposes
  `cancelSubscription` but there's no brand-facing cancel button yet.
  Future contract.
- **Pro-rata refunds on mid-cycle changes** — Razorpay supports it
  via subscription updates; deferred.
- **Live-mode (rzp_live_*) keys** — same code, different env values.
  Founder swaps keys + re-creates plans on Razorpay live mode when
  KYC is fully activated; no code change.
- **Mobile** (brand-mobile subscription/upgrade screen) — brand-mobile
  doesn't currently expose a subscription upgrade flow; web only.

## Files

- `backend/migrations/070_razorpay_plan_id.sql` +
  `backend/scripts/run-070.js`.
- `backend/src/services/razorpay.service.js` (new).
- `backend/src/controllers/subscription.controller.js` —
  upgrade() rewritten.
- `backend/src/controllers/webhook.controller.js` — 5 new event
  handlers + switch cases.
- `backend/src/controllers/features.controller.js` —
  `updatePrice` accepts `razorpay_plan_id` field.
- `Packages/brand-web/lib/api.js` — `upgradeSubscription` (probably
  exists; verify) + optional helper for the poll.
- `Packages/brand-web/app/dashboard/settings/subscription/page.js`
  — Razorpay Checkout SDK integration.
- `Packages/brand-web/app/admin/pricing/tiers/[tier_key]/page.js`
  — razorpay_plan_id field in Section B.
- This contract.

## Non-functional

- Deploy posture: PRODUCTION-IMPACTING — Render redeploys backend
  with the new subscription flow + webhook handlers; Vercel
  redeploys brand-web with the Checkout SDK + admin field.
  RAZORPAY_MOCK already false on Render (founder confirmed); live
  flow activates immediately on Render redeploy.
- M070 needs separate explicit founder go.
- **Until founder pastes plan_ids in the admin UI**, every live-mode
  upgrade attempt returns 422 ADMIN_CONFIG_MISSING — graceful, not
  500. Brand sees "Subscription setup is in progress, please check
  back shortly." No data corruption possible.
- Backward compatible: mock-mode path untouched; tests/devs who flip
  RAZORPAY_MOCK=true locally keep the synthetic flow.
- Webhook handlers are idempotent (event-id matched OR UPSERT-style)
  so Razorpay retries are safe.
- Razorpay Checkout SDK script tag is added with `strategy="lazyOnload"`
  so it doesn't block first paint.
