# 06-diff — backend-defect-pending-mandate-enum

**Before:** the A6.5 / A13 contract added `'pending_mandate'` as the
new transitional state for brand_subscriptions between *upgrade
initiated* and *UPI mandate authenticated via webhook*. The
controller code at `subscription.controller.js:317` does:

```sql
INSERT INTO brand_subscriptions (..., status, ...) VALUES (..., 'pending_mandate', ...)
```

But the underlying `subscription_status` enum (defined in M058,
unchanged through M070) only contains:

```
active | paused | cancelled | past_due
```

`'pending_mandate'` is not in the enum, so PostgreSQL rejects the
INSERT with SQLSTATE 22P02 (invalid_text_representation). The
errorHandler maps 22P02 to the generic 400 response
`VALIDATION_ERROR — Invalid ID format`, masking the real cause.

Net effect on prod: any brand on a real-mode upgrade (which is
every brand right now since RAZORPAY_MOCK=false on Render) sees the
misleading "Invalid ID format" toast. No brand_subscriptions row
written. A Razorpay subscription DOES get created on Razorpay's
side first (orphan) before the transaction fails.

**After (M071):**

```sql
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending_mandate';
```

The enum now contains 5 values:

```
active | paused | cancelled | past_due | pending_mandate
```

The exact same upgrade controller code now succeeds. The INSERT
writes a row with `status='pending_mandate'`, the transaction
commits, the controller returns the `mandate_pending` payload to
the frontend, and the frontend opens Razorpay Checkout.

**Why we add the value vs. work around it:**

The `pending_mandate` state is semantically meaningful — it's the
brief window where Razorpay has issued a subscription_id but the
brand hasn't authorized the UPI Autopay mandate yet. The webhook
handler reads this state to know whether `subscription.authenticated`
events should flip the brand from "pending" to "active". Removing
the state would require muddier logic (overloading `past_due`
or `paused`, which means different things in their own contexts).

This is a textbook **carved defect** per the no-fake-green rule:
- The test/spec is correct (the state belongs in the lifecycle).
- The backend is the bug (missing enum value).
- Fix the backend; don't bend the spec.

**Defensive notes:**
- `ALTER TYPE ... ADD VALUE` is non-blocking in PG15 (Supabase),
  doesn't lock the table.
- `IF NOT EXISTS` makes it safely re-runnable.
- Forward-only — once an enum value is added and used, removing
  it requires migrating any rows that hold it. Acceptable as a
  one-way ratchet.

**Verified locally:** M071 applied to dev DB; psql `\dT+
subscription_status` shows 5 values including `pending_mandate`;
backend boots clean; mock-mode upgrade still works (unaffected);
pnpm qa 76/76 GREEN.
