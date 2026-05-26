# Impact — billing-razorpay-live (A6.5 + A13)

## Changes
- 1 migration (M070): `subscription_prices.razorpay_plan_id` +
  invoice idempotency unique index.
- 1 runner script.
- 1 new service file (`razorpay.service.js`).
- 1 controller rewrite (`subscription.controller.upgrade`).
- 5 new webhook event handlers (`webhook.controller.js`).
- 1 small controller patch (`features.controller.updatePrice` accepts
  the new column field).
- 2 frontend changes:
  - admin tier editor: new razorpay_plan_id input.
  - brand subscription page: Razorpay Checkout SDK + Upgrade handler
    rewrite to handle mandate_pending state.
- 1 contract folder.

## Blast radius

**Backend behavioural surface**:
- `POST /v1/brands/me/subscription/upgrade` — fully rewritten for
  live mode; mock-mode untouched.
- `POST /v1/webhooks/razorpay` — 5 new event cases added to the
  existing switch; existing handlers untouched.
- `PATCH /v1/admin/prices/:price_id` — accepts one more optional
  field.
- No new routes; no removed routes.

**Frontend behavioural surface**:
- /dashboard/settings/subscription — Upgrade button now handles a
  second response shape (mandate_pending) by opening Checkout.
- /admin/pricing/tiers/[tier_key] — Section B gets a per-row field.

**Money-movement risk**:
- Test mode only (rzp_test_* keys). **No real money moves** until
  founder swaps to live keys post-KYC.
- All amounts handled in rupees throughout the backend; paise
  conversion happens once in the razorpay.service at the API
  boundary via `money.toPaise` (existing helper).

## Rollback
- Revert commit + revert M070 (`ALTER TABLE subscription_prices DROP
  COLUMN razorpay_plan_id`; drop the partial unique index).
- Backend reverts to the 501 stub (clean failure mode — no half-
  state). Frontend's old Upgrade handler reverts (the new
  mandate_pending shape simply never returns).
- Brands with `status='pending_mandate'` or `status='active'` rows
  written during the live window stay as-is (no data loss); admin
  can manually cancel them via direct DB if needed. None exist in
  prod yet so this is moot at first.
- The Razorpay-side subscriptions created during the live window
  remain active on Razorpay even after rollback. Admin can cancel
  them via Razorpay dashboard if needed.

## Risks
- **Webhook delivery reliability**: Razorpay retries on non-2xx
  responses; our handlers return 200 even on internal errors (after
  logging) per the existing pattern, preventing redelivery storms.
  Idempotency-on-event-id + UPSERT-style updates protect against
  duplicate processing.
- **Race between Checkout success callback and webhook**: frontend
  polls /brands/me/subscription every 2s after Checkout closes;
  webhook usually arrives within 1–3s. Worst case the poll times
  out at 30s and shows "Verifying — your invoice will appear
  shortly" — recoverable on page refresh once webhook lands.
- **plan_id NOT set**: graceful 422 ADMIN_CONFIG_MISSING. No data
  corruption. Founder fixes by pasting the ID in admin UI.
- **RAZORPAY_KEY_ID / SECRET unset on Render**: the service throws
  on init; upgrade() returns 500. Founder-verified the keys are
  set; if they ever rotate, set new values + Render redeploys
  automatically.
- **GST handling**: the existing GST_PCT (18%) constant in
  subscription.controller.js stays the live source of truth. Both
  mock and live paths apply it the same way for invoice totals.
  Razorpay's subscription amount = our base price (Razorpay doesn't
  separately calculate GST). The invoice we write records the GST
  breakdown for our books / brand-facing display.
- **Mid-cycle tier change**: out of scope; brand can only upgrade
  from Free / Growth → Pro / Enterprise. Downgrades not exposed.
  Mid-cycle handling deferred to a future contract.
- **Webhook URL drift**: if Render hostname ever changes, founder
  needs to update the webhook URL in Razorpay dashboard. Not a code
  risk; documented in the post-deploy instructions.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean (with RAZORPAY_MOCK=true locally so we
   don't hit the live API during the boot check).
3. M070 applied locally + sanity probe shows the column + index.
4. gov-check exit 0 (Rules 1+3+4).
5. M070 prod run gated on separate explicit founder go after push.
6. Manual end-to-end test on Render after admin plan_id setup, per
   03-expected-outputs.md.
