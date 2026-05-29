# Workflow

## Trigger
Brand with an active paid subscription POSTs `/v1/brands/me/subscription/upgrade`
with a higher `tier_key` mid-cycle (e.g. Growth → Pro), in **live** mode
(`RAZORPAY_MOCK` false).

## Before (broken)
1. Controller computes pro-rata delta + GST, passes the `razorpayPlanId` guard.
2. Calls `razorpayService.createOrder({ amount: toPaise(deltaTotal), … })`.
3. `createOrder` is `undefined` (not exported) → `TypeError`.
4. `catch` rethrows `AppError('PAYMENT_PROVIDER_UNAVAILABLE', …, 502)`.
5. Brand sees "Payment provider is temporarily unavailable." No order created,
   no DB writes.

## After (fixed)
1. Same delta computation + guard.
2. `razorpayService.createOrder(...)` resolves to the real function, which calls
   the Razorpay Orders API `client.orders.create(...)` and returns
   `{ id, amount, currency, status }`.
3. Controller returns `201 { status: 'proration_pending', razorpay_order_id,
   razorpay_amount, razorpay_key_id, … }` so the frontend opens Razorpay
   Checkout in Order mode for the pro-rata difference.
4. On payment, the existing proration webhook path creates the new full-price
   subscription at the old cycle end (unchanged by this fix).

## Scope of change
- `backend/src/services/razorpay.service.js` — add `createOrder` to exports.
- `backend/tests/razorpay-service.test.js` — NEW regression test.
No controller, route, schema, or money-math change.
