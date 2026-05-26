# backend-defect-pending-mandate-enum

> Carved defect found during the A6.5 end-to-end smoke test
> (2026-05-26, founder testing as brand `Aveen food paradise`,
> phone +91 9000000061). The new `pending_mandate` status value the
> A6.5 upgrade() controller writes is **not in the
> subscription_status enum on prod**, so the INSERT throws PG 22P02
> (invalid enum value), the transaction rolls back, and the brand
> sees a generic "VALIDATION_ERROR — Invalid ID format" toast.

## Symptom

Brand on Free tier → /dashboard/settings/subscription → click
**Upgrade to Growth (Monthly)** → red toast:

> *Upgrade failed: VALIDATION_ERROR — Invalid ID format*

Backend state after error:
- No new `brand_subscriptions` row written (transaction rolled back).
- Razorpay subscription DOES get created on Razorpay's side (the
  `razorpayService.createSubscription` call runs BEFORE the DB
  transaction; that subscription is now orphaned on Razorpay until
  manual cleanup or until Razorpay auto-cancels for inactivity).
- Brand's pre-existing Free row stays as-is.

## Root cause

`subscription.controller.js:313-320`:
```sql
INSERT INTO brand_subscriptions
   (brand_id, tier_id, subscription_price_id, status,
    mandate_status, razorpay_subscription_id)
 VALUES ($1, $2, $3, 'pending_mandate', 'pending', $4)
```

The string literal `'pending_mandate'` casts to the
`subscription_status` enum, which on prod only contains:
- `active`
- `paused`
- `cancelled`
- `past_due`

PG throws `invalid_text_representation` (SQLSTATE 22P02). The
default `errorHandler.js:34-36` maps 22P02 to the generic
"VALIDATION_ERROR — Invalid ID format" client message, masking the
real cause.

The A6.5 contract spec described the `pending_mandate` state on
brand_subscriptions but neither M070 nor the original M058 enum
defined it. Verify-twice miss — the spec assumed the enum was
extensible without writing the ALTER TYPE.

## Why this is a backend defect (not a test defect)

The A6.5 contract intends `pending_mandate` as the transitional
state between *upgrade triggered* and *UPI mandate authenticated
via webhook*. That state has real semantic value — without it the
controller can't represent the brief window where a Razorpay
subscription exists but mandate auth hasn't happened. Hacking
around the missing enum (e.g. using `past_due` or leaving the
existing `active` row in place) would muddle the lifecycle and
break the webhook handler's assumptions.

The fix is to **add the value to the enum**, not change the spec.
Per the carved-defect rule (no-fake-green): test/spec stays
correct, backend is the bug to fix.

## Fix — Migration M071

```sql
BEGIN;

ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending_mandate';

COMMIT;
```

Additive. Idempotent. PG14+ supports `ADD VALUE IF NOT EXISTS`
(Supabase runs PG15). Behaviour-inert until the new value is
actually used (which is the very flow we're trying to enable).

## Verify-twice notes for future similar work

- Enums on `brand_subscriptions` are `subscription_status` (the
  column type alias) and `mandate_status`.
- `mandate_status` already includes `'pending'` — that's why the
  controller's `mandate_status='pending'` writes work in isolation.
  Only the new `subscription_status='pending_mandate'` value is
  missing.
- Any future status additions should follow the same pattern:
  ALTER TYPE in a new migration; never invent values inline.

## Out of scope

- Cleanup of the orphan Razorpay subscription created during
  Aveen's failed attempt today. Razorpay auto-cancels unauthorized
  subscriptions after a short window (≤24h in test mode);
  acceptable to leave alone.
- Catching the orphaned-subscription class of bug generally — if
  the upgrade transaction fails AFTER `razorpayService.createSubscription`
  succeeded, we should ideally call `razorpayService.cancelSubscription`
  in the catch path. Deferred follow-up.

## Files

- `backend/migrations/071_subscription_status_pending_mandate.sql` +
  `backend/scripts/run-071.js`.
- This contract.

## Non-functional

- Deploy posture: PRODUCTION-IMPACTING (DB write on prod enum) but
  **behaviour-inert** until `subscription.controller.upgrade` is
  called in live mode (RAZORPAY_MOCK=false). On prod that's true
  right now, so M071 makes the upgrade flow start working
  immediately after applying.
- No backend code change. The defect is purely the missing enum
  value.
- pnpm qa should remain 76/76 GREEN — the existing suite doesn't
  exercise the live-mode upgrade path.
