# 03-expected-outputs — wave2-midcycle-proration

## POST /v1/brands/me/subscription/upgrade — qualifying upgrade

Worked example: active Growth monthly (₹2,499), 15 days left, → Pro (₹9,999).
- delta = (9999/30 − 2499/30) × 15 = 250 × 15 = **₹3,750**
- delta_gst = 18% = **₹675** → total **₹4,425**

**Live** → `201`:
```json
{ "success": true, "data": {
  "status": "proration_pending", "mode": "live", "proration": true,
  "razorpay_order_id": "order_…", "razorpay_amount": 442500,
  "razorpay_key_id": "rzp_…", "tier_key": "pro", "billing_period": "monthly",
  "delta_breakdown": { "current_tier_key":"growth","target_tier_key":"pro",
    "days_remaining":15,"old_daily_rate":83.3,"new_daily_rate":333.3,
    "delta_inr":3750,"delta_gst_inr":675,"total_inr":4425,"cycle_end":"…" } } }
```

**Mock** → `201`: `{ status:"activated", mode:"mock", proration:true,
subscription_id, invoice_id, delta_breakdown }`. Active sub → Pro,
`current_cycle_end` unchanged; one proration invoice (amount=3750, gst=675,
tier_key=pro, paid).

## order.paid webhook (live completion)
- Old `brand_subscriptions` row → `cancelled`.
- New active row: tier=Pro, `current_cycle_end` = old end, `mandate_status='pending'`,
  `razorpay_subscription_id` = new sub, `notes` = `{renewal_short_url, via}`.
- Proration invoice: amount=delta, gst=delta_gst, status=paid, razorpay_payment_id set.
- Idempotent: duplicate `order.paid` → skipped (invoice payment_id check).

## Non-qualifying responses
- Downgrade / Free→paid / period switch → existing flow shape
  (`status:'activated'`/`'mandate_pending'`), **no `proration` flag**,
  `amount_inr` = full tier price.

## GET /v1/brands/me/subscription
Now includes `subscription.notes` (carries the renewal short_url for the
post-upgrade mandate prompt).

## Invariants
- Non-qualifying upgrades behave exactly as before (existing flow untouched).
- Cycle dates stay aligned: the upgraded tier's cycle ends at the original end.
- No schema change.
