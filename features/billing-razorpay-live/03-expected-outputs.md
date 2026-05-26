# Expected Outputs — billing-razorpay-live (A6.5 + A13)

## Database (after M070)
- `subscription_prices.razorpay_plan_id varchar(40)` nullable, indexed.
- `subscription_invoices` gains a partial unique index on
  `(brand_subscription_id, razorpay_payment_id)` where
  `razorpay_payment_id IS NOT NULL` — webhook idempotency.

## API JSON shapes

**`POST /v1/brands/me/subscription/upgrade` (live-mode happy path):**
```json
{
  "success": true,
  "data": {
    "status": "mandate_pending",
    "razorpay_subscription_id": "sub_NXyz123abc",
    "razorpay_key_id": "rzp_test_…",
    "tier_key": "growth",
    "tier_name": "Growth",
    "billing_period": "monthly",
    "amount_inr": 999.00,
    "message": "Subscription created — complete UPI mandate to activate."
  }
}
```

**`POST /v1/brands/me/subscription/upgrade` (plan_id missing):**
```json
{
  "success": false,
  "error": {
    "code": "ADMIN_CONFIG_MISSING",
    "message": "Subscription setup is in progress, please check back shortly.",
    "field": "razorpay_plan_id",
    "details": {
      "tier_key": "growth",
      "billing_period": "monthly"
    }
  }
}
```

**`POST /v1/brands/me/subscription/upgrade` (mock-mode):** unchanged
from current shape (`status: 'activated', mode: 'mock'`).

**`POST /v1/webhooks/razorpay` (subscription.authenticated):**
Returns 200 `{ success: true }`. Side effect: brand_subscriptions
flips to active.

**`PATCH /v1/admin/prices/:price_id` (admin paste plan_id):** body
accepts new optional `razorpay_plan_id` field; persisted to the
column.

## Test results
- pnpm qa main lane GREEN unchanged (no public-facing API shape
  change for mock-mode; new live-mode shape only exercised when
  RAZORPAY_MOCK=false + plan_id set, neither of which the
  Playwright suite triggers).
- M070 applied to local dev; sanity probe confirms column +
  partial unique index.
- Backend boot smoke clean.
- Manual end-to-end test on Render after deploy + admin plan_id
  setup, using Razorpay test VPA `success@razorpay`.

## Deploy posture
PRODUCTION-IMPACTING: Render redeploys backend with the new
subscription flow + webhook handlers; Vercel redeploys brand-web
with the Checkout SDK + admin field. M070 needs separate explicit
founder go. RAZORPAY_MOCK is already `false` on Render, so the live
path activates immediately on Render redeploy — but until founder
pastes plan_ids in admin UI, every upgrade attempt returns 422
ADMIN_CONFIG_MISSING gracefully.

**Post-deploy launch sequence (your tasks):**
1. (Optional) Hard-refresh `/admin/pricing/tiers/[tier_key]` to load
   the new `razorpay_plan_id` field.
2. Create 6 plans on Razorpay dashboard (test mode):
   Growth/Pro/Enterprise × Monthly/Yearly.
3. Paste the 6 plan_NXyz123… IDs into the new field on each
   `/admin/pricing/tiers/[tier_key]` Section B.
4. In Razorpay dashboard → Account & Settings → Webhooks → Add
   webhook with URL
   `https://inflx-platform.onrender.com/v1/webhooks/razorpay` and
   events: subscription.authenticated, subscription.charged,
   subscription.cycle_end, subscription.halted, payment.failed.
   Copy the webhook secret → set RAZORPAY_WEBHOOK_SECRET on Render
   (it's already set, but if the dashboard generates a new one,
   update accordingly).
5. End-to-end smoke test:
   - Sign in as a Free testbrand.
   - Open /dashboard/settings/subscription → Upgrade to Growth
     Monthly.
   - Razorpay Checkout opens. UPI → enter `success@razorpay` →
     OTP 000000 → mandate authorized.
   - Within ~5–10s the subscription page should reflect
     "Growth · Monthly · active".
   - Check /dashboard/settings/billing — first invoice should be
     visible (paid).
6. Failure-path smoke: same flow with `failure@razorpay` VPA → see
   a failed invoice + stays on Free.
