# 06-diff — backend-defect-pending-mandate-cycle-dates

**Before:** A6.5 live-mode upgrade() INSERT into brand_subscriptions
(commit 03f0401):

```sql
INSERT INTO brand_subscriptions
   (brand_id, tier_id, subscription_price_id, status,
    mandate_status, razorpay_subscription_id)
 VALUES ($1, $2, $3, 'pending_mandate', 'pending', $4)
```

This omits `current_cycle_start` + `current_cycle_end`, both NOT NULL.
PostgreSQL throws SQLSTATE 23502 (not_null_violation). The
errorHandler doesn't have a specific case for 23502, so it falls
through to the generic 500 → user sees "Internal server error.
Please try again." in the toast.

The mock-mode INSERT in the same file (untouched, lines 264-278)
correctly sets these columns. Side-by-side comparison would have
caught this; the live-mode INSERT was written without that
comparison.

**After:** the live-mode INSERT now includes both columns:

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

`cycleDays` (30 for monthly, 365 for yearly) is already computed
earlier in upgrade(); it's passed as the 4th parameter to populate
`current_cycle_end`.

| Column | Pre-fix (live mode) | Post-fix (live mode) | Mock mode |
|--------|---------------------|----------------------|-----------|
| brand_id | ✓ | ✓ | ✓ |
| tier_id | ✓ | ✓ | ✓ |
| subscription_price_id | ✓ | ✓ | ✓ |
| status | 'pending_mandate' | 'pending_mandate' | 'active' |
| current_cycle_start | **missing** | current_date | current_date |
| current_cycle_end | **missing** | current_date + N days | current_date + N days |
| mandate_status | 'pending' | 'pending' | 'active' |
| razorpay_subscription_id | sub_xxx | sub_xxx | sub_mock_xxx |

**Webhook follow-up:** the `subscription.authenticated` handler
overwrites `current_cycle_start` and `current_cycle_end` with
Razorpay's actual `current_start` and `current_end` from the
authenticated subscription, so the placeholder dates set at INSERT
exist only for the brief pending_mandate window (typically ≤30
seconds in test mode).

**Why we don't make the columns NULLable instead:**
- Mock-mode path already sets them, so the column is "always populated"
  in real usage. Making them nullable would require migrating
  reporting code that assumes non-null cycle dates.
- The placeholder values are reasonable estimates and get overwritten
  quickly.
- Code-only fix avoids another prod migration.

**Defensive notes:**
- The fix matches the mock-mode pattern exactly, so any reporting or
  dashboard that consumes these columns sees the same shape in both
  modes during pending_mandate (brief) and active (steady state).
- The 23502 error code could be added to errorHandler.js as a more
  descriptive 422 in a future follow-up — deferred.

**Verified locally:** boot smoke clean; pnpm qa 76/76 GREEN;
controller code reviewed side-by-side with mock-mode.
