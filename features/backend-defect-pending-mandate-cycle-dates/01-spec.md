# backend-defect-pending-mandate-cycle-dates

> Second carved defect from the A6.5 end-to-end smoke test
> (2026-05-26, founder testing as `Aveen food paradise`,
> phone +91 9000000061). The A6.5 live-mode upgrade() INSERT into
> `brand_subscriptions` omits the NOT NULL `current_cycle_start`
> and `current_cycle_end` columns. PG throws 23502
> (not_null_violation), errorHandler maps to generic
> INTERNAL_ERROR 500.

## Symptom

After M071 fixed the enum issue, the same Upgrade button now shows:

> *Upgrade failed: INTERNAL_ERROR — Internal server error. Please try again.*

Backend state after error:
- `brand_subscriptions` row for the brand is untouched (transaction
  rolled back) — confirmed by direct prod query (Aveen's row stays
  status='active', mandate_status='pending').
- Razorpay subscription was created on Razorpay's side before the
  DB transaction opened (pre-transaction call) → another orphan,
  same TTL caveat as the M071 defect.

## Root cause

`backend/src/controllers/subscription.controller.js:313-320`
(A6.5 live-mode INSERT):

```sql
INSERT INTO brand_subscriptions
   (brand_id, tier_id, subscription_price_id, status,
    mandate_status, razorpay_subscription_id)
 VALUES ($1, $2, $3, 'pending_mandate', 'pending', $4)
```

The brand_subscriptions schema (M058) defines:
- `current_cycle_start date NOT NULL`
- `current_cycle_end date NOT NULL`

Both without column defaults.

The pre-A6.5 mock-mode INSERT correctly set both
(`subscription.controller.js:264-278`):

```sql
INSERT INTO brand_subscriptions
   (brand_id, tier_id, subscription_price_id, status,
    current_cycle_start, current_cycle_end, next_charge_at,
    mandate_status, last_charged_at,
    razorpay_subscription_id, razorpay_mandate_id)
 VALUES ($1, $2, $3, 'active', current_date,
         current_date + ($4 || ' days')::interval,
         current_date + ($4 || ' days')::interval,
         'active', now(), $5, $6)
```

The new live-mode INSERT was written from scratch without carrying
over the cycle date columns. Verify-twice miss — I focused on the
new columns (razorpay_subscription_id, mandate_status,
status='pending_mandate') and didn't cross-check against the full
NOT NULL set.

## Why this is a backend defect (not a test defect)

The `pending_mandate` state legitimately exists before any Razorpay
charge happens, so cycle dates aren't "known" yet in the same sense
they are post-authentication. But the NOT NULL constraint demands
values. Two acceptable resolutions:

(a) Code fix: set placeholder cycle dates at INSERT time (current_date
    + cycleDays). The `subscription.authenticated` webhook handler
    overwrites them with Razorpay's actual cycle dates on mandate auth.
(b) Schema fix: ALTER COLUMN to drop the NOT NULL constraint so
    pending_mandate rows can legitimately hold NULL cycle dates.

Option (a) is chosen here — it's code-only (no migration), the
placeholder dates are no worse than the mock-mode INSERT (which uses
exactly the same approach), and existing reporting/dashboards that
read these columns continue to work without nullability changes.

Per no-fake-green: the test/spec is correct; the backend's INSERT
was incomplete.

## Fix

Modify the A6.5 live-mode INSERT to set both cycle date columns:

```sql
INSERT INTO brand_subscriptions
   (brand_id, tier_id, subscription_price_id, status,
    current_cycle_start, current_cycle_end,
    mandate_status, razorpay_subscription_id)
 VALUES ($1, $2, $3, 'pending_mandate',
         current_date,
         current_date + ($4 || ' days')::interval,
         'pending', $5)
```

`cycleDays` (30 for monthly, 365 for yearly) is already computed in
upgrade() so it's passed through as a parameter.

The webhook handler at `subscription.authenticated` already
overwrites these with the actual Razorpay cycle dates on mandate
auth — no webhook changes needed.

## Verify-twice notes for future similar work

- Always cross-check INSERTs against `information_schema.columns` for
  the target table's NOT NULL set, not just the "interesting" columns.
- The mock-mode INSERT remains the canonical reference for cycle
  date handling in upgrade() — review it side-by-side with any new
  live-mode INSERT.

## Out of scope

- Schema change (Option b) — preserving NOT NULL keeps reporting
  consistent across mock/live modes.
- Cleanup of Aveen's second orphan Razorpay subscription (same auto-
  cancel TTL as the M071 orphan).
- Improving the 23502 → INTERNAL_ERROR mapper (could add a specific
  case to errorHandler.js mapping 23502 to a more descriptive 422).
  Deferred follow-up.

## Files

- `backend/src/controllers/subscription.controller.js` — INSERT
  modified to include cycle date columns.
- This contract.

## Non-functional

- Deploy posture: PRODUCTION-IMPACTING (Render redeploys backend
  with the corrected INSERT). NO migration — code-only fix. After
  Render redeploys, the same Upgrade button works end-to-end.
- Backward compatible: mock-mode path unchanged; live-mode path
  now matches mock-mode in cycle-date handling.
- No regression surface: pnpm qa should remain 76/76 GREEN — no
  existing test exercises the live-mode INSERT.
