# Expected Outputs — backend-defect-pending-mandate-cycle-dates

## Database
No schema change. The fix is purely controller-side.

## API JSON shapes
Unchanged. The fix unblocks the existing A6.5 success path.

After Render redeploys with this commit, the same /upgrade call
that returned `INTERNAL_ERROR — Internal server error` now returns
the intended success shape:
```json
{
  "success": true,
  "data": {
    "status": "mandate_pending",
    "razorpay_subscription_id": "sub_…",
    "razorpay_key_id": "rzp_test_…",
    "tier_key": "growth",
    "billing_period": "monthly",
    "amount_inr": 2499,
    "message": "Subscription created — complete UPI mandate to activate."
  }
}
```

## Test results
- pnpm qa main lane GREEN unchanged.
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING (Render redeploys backend with the fix). NO
migration required. After Render redeploys (~2–3 min auto), the
same Upgrade button works end-to-end.
