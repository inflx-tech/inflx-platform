# Workflow — billing-razorpay-live (A6.5 + A13)

## Actors
- **Brand user** on /dashboard/settings/subscription.
- **Founder/admin** doing the one-time Razorpay-dashboard setup +
  pasting plan_ids into the admin UI.
- **Razorpay** as the external payment system + webhook source.

## Preconditions
- A10/A11 shipped (subscription_prices + Monthly/Yearly toggle UI).
- A14 shipped (per-brand overrides — not strictly required but
  the entitlements flow already handles overrides).
- M070 applied (`subscription_prices.razorpay_plan_id` column
  exists).
- Razorpay account in test mode (founder-confirmed). Subscriptions
  feature enabled.
- Founder has created 6 Plans on Razorpay dashboard:
  Growth/Pro/Enterprise × Monthly/Yearly.
- Founder has pasted the 6 plan_NXyz123… IDs through
  /admin/pricing/tiers/[tier_key] Section B.
- Razorpay webhook URL set to
  `https://inflx-platform.onrender.com/v1/webhooks/razorpay` with
  events subscribed: subscription.authenticated, subscription.charged,
  subscription.cycle_end, subscription.halted, payment.failed.
- RAZORPAY_MOCK=false on Render (founder-confirmed; already live).

## Workflow A — brand upgrades from Free to Growth Monthly (happy path)

1. Brand on Free opens /dashboard/settings/subscription. Sees Growth
   card with Monthly/Yearly toggle.
2. Brand picks Monthly, clicks **Upgrade to Growth**.
3. Frontend calls `POST /v1/brands/me/subscription/upgrade` with
   `{ tier_key: 'growth', billing_period: 'monthly' }`.
4. `upgrade()` controller:
   - Resolves tier_id + subscription_price_id + razorpay_plan_id
     (e.g. `plan_NXyz123`).
   - Calls `razorpay.service.createSubscription({ plan_id, total_count:
     12, notes: { brand_id, tier_key, billing_period } })`.
     `total_count=12` for monthly = 1 year of recurring charges;
     `total_count=5` for yearly = 5 years. Razorpay auto-cancels
     after total_count cycles unless renewed.
   - INSERTs brand_subscriptions row with
     `status='pending_mandate'`, `razorpay_subscription_id=sub_xxx`,
     `mandate_status='pending'`.
   - Returns `{ razorpay_subscription_id: 'sub_xxx', razorpay_key_id:
     'rzp_test_…', status: 'mandate_pending', tier_name: 'Growth',
     billing_period: 'monthly' }`.
5. Frontend opens Razorpay Checkout modal with subscription_id.
6. Brand picks UPI, enters VPA (test: `success@razorpay`), gets a
   simulated push to their UPI app (in test mode it auto-succeeds),
   approves the mandate.
7. Razorpay fires webhook **`subscription.authenticated`** to
   `/v1/webhooks/razorpay`.
8. `handleSubscriptionAuthenticated` runs:
   - Verifies signature.
   - Looks up brand_subscriptions by `razorpay_subscription_id`.
   - Updates: `status='active'`, `mandate_status='active'`,
     `razorpay_mandate_id=mandate_xxx`, `current_cycle_start=today`,
     `current_cycle_end=today+30d`, `next_charge_at=today+30d`.
   - Sends push + in-app notification to the brand.
9. Razorpay charges immediately on mandate authorization → fires
   webhook **`subscription.charged`**.
10. `handleSubscriptionCharged` runs:
    - INSERTs a `subscription_invoices` row: status='paid',
      amount_inr/gst_amount_inr from the price, period_start/end,
      `razorpay_payment_id=pay_xxx`, paid_at=now.
    - Updates `last_charged_at=now`.
11. Frontend's poll on `/v1/brands/me/subscription` sees
    `mandate_status='active'` → shows success toast, refreshes the
    subscription page.

## Workflow B — Free brand upgrades to Growth Yearly

Same as A, but `billing_period='yearly'`, `cycleDays=365`,
`total_count=5`, and the resolved plan_id maps to the Yearly variant.
Razorpay handles the period cadence; our code is period-agnostic
beyond the plan_id lookup.

## Workflow C — recurring charge after 30 days (subscription cycle)

1. 30 days after the brand authenticated, Razorpay auto-charges the
   mandate.
2. Razorpay fires **`subscription.charged`** (and possibly
   `subscription.cycle_end` depending on event ordering).
3. `handleSubscriptionCharged` writes a new paid invoice + updates
   last_charged_at + advances next_charge_at.
4. Brand sees the new invoice on /dashboard/settings/billing.

## Workflow D — payment fails (insufficient balance, mandate revoked)

1. Recurring charge fails on Razorpay's side.
2. Webhook **`payment.failed`** fires with `error_description`.
3. `handlePaymentFailed` (extended) writes a `subscription_invoices`
   row with status='failed', failure_reason captured.
4. Razorpay retries automatically per its retry schedule. If all
   retries fail, eventually fires **`subscription.halted`**.
5. `handleSubscriptionHalted` flips `status='past_due'`,
   `mandate_status='halted'`, notifies brand to update payment method,
   sends admin alert.

## Workflow E — admin hasn't pasted plan_id yet

1. Brand picks a tier, clicks Upgrade.
2. `upgrade()` controller looks up razorpay_plan_id → NULL.
3. Returns 422 ADMIN_CONFIG_MISSING with friendly message
   *"Subscription setup is in progress, please check back shortly."*
4. Frontend shows this in the existing error toast / QuotaWallModal
   (the new code is recognized as a paywall-adjacent code).
5. No data corruption; no subscription created on Razorpay; no
   brand_subscriptions row written.

## Workflow F — mock-mode (RAZORPAY_MOCK=true)

1. Identical to current pre-A6.5 behaviour.
2. `upgrade()` short-circuits before the live path, writes a
   synthetic active subscription + paid invoice.
3. Returns `{ status: 'activated', mode: 'mock' }` immediately.
4. No Razorpay API calls; no Checkout opened.

## Success

- pnpm qa main lane GREEN unchanged.
- Backend boots clean with new service + webhook handlers.
- Live-mode upgrade from a real test brand completes the full
  authenticated→charged flow with VPA `success@razorpay`.
- Failed mandate with VPA `failure@razorpay` writes a failed
  invoice + leaves the brand on Free.
- Admin can paste plan_ids per (tier × period) row through the
  existing tier editor.
- Pre-plan_id state degrades gracefully (422 ADMIN_CONFIG_MISSING).

## Failure modes

- **plan_id missing** → 422 ADMIN_CONFIG_MISSING (graceful).
- **Razorpay API down** → service throws → upgrade() returns 502 or
  500 → frontend shows toast "Payment provider unavailable, please
  try again". No brand_subscriptions row written.
- **Webhook signature mismatch** → 401, Razorpay retries.
- **Webhook duplicate delivery** → idempotent UPSERT-style updates;
  invoices are unique on (brand_subscription_id, razorpay_payment_id)
  via a partial index (added in M070 alongside the plan_id column).
- **Brand abandons Checkout** → brand_subscriptions row stays in
  `status='pending_mandate'`. A small cleanup cron (deferred) sweeps
  stale rows after 24h; for now they sit there harmlessly. Brand can
  retry upgrade and the old row is cancelled before a new one is
  inserted.
- **Brand cancels mandate later via UPI app** → Razorpay fires
  `subscription.halted` → flow D handles it.
