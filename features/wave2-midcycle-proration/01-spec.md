# wave2-midcycle-proration — Wave 2 commit 4

> Mid-cycle subscription upgrade with pro-rata billing (Option A). When a brand
> on an active paid plan upgrades to a higher tier mid-cycle, it pays only the
> pro-rata difference `(newDailyRate − oldDailyRate) × daysRemaining + GST` as a
> one-off Razorpay Order. The new tier's cycle ENDS at the original cycle's end
> (dates stay aligned); the new full-price subscription begins at the next cycle.

## Settled decision (1, locked with founder)
Mid-cycle upgrade = **Option A** (pro-rata difference). New cycle ends at the
ORIGINAL end. Implement via a one-off Razorpay Order for the delta + cancel the
old subscription + create a new subscription with `start_at` = old cycle end.
Downgrades = scheduled at next cycle end (OUT OF SCOPE — fall through to the
existing flow).

## No migration
Pro-ration state rides on the Razorpay Order's `notes` (read by the `order.paid`
webhook). The proration invoice reuses `subscription_invoices`. No schema change
→ nothing to break, no migrate-first required.

## Trigger guard (additive, safe)
The pro-ration branch in `upgrade` fires ONLY when: the brand has an ACTIVE
**paid** sub (current tier ≠ free, current price > 0), the requested billing
period equals the current one, the target price > current price, and days
remain in the cycle. Every other case (Free→paid, paid→Free, downgrade, period
switch, no active sub) falls through to the **existing full-subscribe flow,
unchanged** — so live subscriptions cannot be broken by this commit.

## What ships

### Backend
- `razorpay.service` — `createOrder({amount,currency,receipt,notes})`;
  `createSubscription` extended with optional `start_at` (epoch).
- `subscription.controller.upgrade` — pro-ration branch:
  - delta = `(newDaily − oldDaily) × daysRemaining`; `deltaGst = gstOn(delta)`.
  - **Live:** create a one-off Razorpay Order for `delta + GST` (notes carry the
    upgrade context); return `{ status:'proration_pending', razorpay_order_id,
    razorpay_amount, razorpay_key_id, delta_breakdown }`. No DB change yet.
  - **Mock:** swap to the target tier immediately keeping the original cycle
    end; write a proration invoice; return `{ status:'activated', proration:true,
    delta_breakdown }`.
- `webhook.controller` — new `order.paid` handler (notes.type=`proration`):
  cancel old Razorpay sub → create new sub `start_at` = old cycle end → swap
  `brand_subscriptions` (cancel old, INSERT new active row at target tier with
  the ORIGINAL cycle end, mandate `pending`, renewal short_url stored on notes)
  → write the proration invoice. Idempotent via the invoice's
  `razorpay_payment_id`.
- `handleSubscriptionAuthenticated` — additive guard: if the row is already
  `active` (proration upgrade) and mandate just authorized, set
  `mandate_status='active'` WITHOUT touching the aligned cycle dates. Existing
  fresh-subscribe rows (`pending_mandate`) are unaffected.
- `getSubscription` — also returns `bs.notes` (carries the renewal short_url).

### Frontend (brand-web)
- `/dashboard/settings/subscription` — on `proration_pending`, open Razorpay
  Checkout in **Order** mode for the delta (shows pro-rata + GST in the
  description); poll until the tier swaps; then prompt to authorize UPI Autopay
  for renewals (banner with the new sub's short_url). Mock path shows the
  pro-rata message.

## Verify-twice
- Existing `upgrade` today = full re-subscribe (live mandate / mock fresh
  cycle); pro-ration is layered as an additive branch BEFORE it.
- Razorpay subscriptions can't change plan mid-flight → cancel + create-new is
  required; the new sub needs a fresh UPI Autopay mandate, surfaced to the brand.
- `handleSubscriptionAuthenticated` has an `if (status==='active') return`
  idempotency guard — creating the new row as `active` means it won't clobber
  the aligned cycle end.
- `subscription_invoices.total_inr` is GENERATED (amount+gst); proration invoice
  inserts amount + gst only.

## Out of scope
- Downgrades / period switches (existing flow / future).
- Full live validation — needs a Razorpay test-mode run (Aveen Growth→Pro).

## Files
- `backend/src/services/razorpay.service.js`
- `backend/src/controllers/subscription.controller.js`
- `backend/src/controllers/webhook.controller.js`
- `Packages/brand-web/app/dashboard/settings/subscription/page.js`
- `backend/tests/subscription.test.js`
- This contract.

## Non-functional
- Deploy posture: **PRODUCTION-IMPACTING, NO migration**. Render + Vercel
  redeploy. Razorpay dashboard must have the **`order.paid`** webhook event
  enabled for the live path.
- `pnpm qa` GREEN. Backend boot smoke clean. Live path validated by founder in
  test mode before relying on it.
