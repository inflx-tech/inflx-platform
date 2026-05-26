# Expected Outputs — backend-defect-pending-mandate-enum

## Database (after M071)

`subscription_status` enum values:
- `active`
- `paused`
- `cancelled`
- `past_due`
- **`pending_mandate`** ← new

## API JSON shapes
Unchanged. The fix only unblocks the existing A6.5 happy path.

After M071, the same /v1/brands/me/subscription/upgrade call that
returned `VALIDATION_ERROR — Invalid ID format` now returns the
intended success shape:
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
- M071 applied to local dev DB; sanity probe shows `pending_mandate`
  in the enum.
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING (prod enum extension via ALTER TYPE) but
behaviour-inert until upgrade() is invoked in live mode. RAZORPAY_MOCK
is already false on Render, so M071 immediately unblocks the
upgrade flow for any brand. M071 needs separate explicit founder go.
