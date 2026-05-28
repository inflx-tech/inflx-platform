# 02-workflow — wave2-midcycle-proration

## Qualifying upgrade (Growth → Pro, mid-cycle, same period)

1. Brand on active Growth monthly, N days left in cycle, clicks "Upgrade to Pro".
2. `POST /brands/me/subscription/upgrade { tier_key:'pro', billing_period:'monthly' }`.
3. Controller resolves target price (Pro) + loads the current active sub
   (price, period, cycle_end, days_remaining). Guard passes → pro-ration.
4. delta = `(proDaily − growthDaily) × daysRemaining`; `deltaGst = gstOn(delta)`.
5a. **Live:** create one-off Razorpay Order for `delta + deltaGst`, notes =
    {type:'proration', brand_id, old_subscription_id, old_razorpay_subscription_id,
    old_cycle_end, target_tier_id, target_price_id, target_plan_id, billing_period,
    delta_inr, delta_gst_inr, …}. Return `proration_pending` + order_id + amount.
    No DB change (brand stays on Growth until paid).
5b. **Mock:** in a txn — cancel Growth row, INSERT Pro active row with
    current_cycle_end = ORIGINAL end, write proration invoice (delta+gst). Return
    `activated` + `proration:true` + delta_breakdown.
6. **Frontend (live):** open Razorpay Checkout in ORDER mode (order_id, amount).
   On payment success → poll `getSubscription` until tier == 'pro' → refresh.
7. **Webhook `order.paid`** (notes.type='proration'):
   - idempotency: skip if a proration invoice already exists for payment.id.
   - cancel old Razorpay subscription (immediate).
   - create new Pro Razorpay subscription with `start_at` = old cycle end.
   - txn: cancel old `brand_subscriptions` row; INSERT new Pro active row
     (current_cycle_end = old cycle end, mandate `pending`, renewal short_url in
     notes); write proration invoice (delta+gst, paid, payment.id).
   - notify brand: upgraded now + authorize renewals.
8. **Renewal mandate:** the new Pro sub needs a fresh UPI Autopay mandate. The
   subscription page shows an "Authorize renewals →" banner (short_url from
   notes). On authorization → `subscription.authenticated` sets
   `mandate_status='active'` (cycle dates untouched, row already active).
9. **At old cycle end:** the new Pro sub's first charge fires →
   `subscription.charged` writes the full-price invoice + advances the cycle.

## Non-qualifying (fall through to existing flow, UNCHANGED)
- No active sub / on Free → full subscribe at the target tier.
- Downgrade (target price ≤ current) → existing flow.
- Period switch (monthly ↔ yearly) → existing flow.
