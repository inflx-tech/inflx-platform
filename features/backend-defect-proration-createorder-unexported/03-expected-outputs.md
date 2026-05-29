# Expected outputs

## razorpay.service
- `require('../src/services/razorpay.service').createOrder` is a function.
- `createOrder({ amount, receipt, notes })`:
  - validates `amount >= 1` (paise) — throws on missing/zero.
  - calls `client.orders.create({ amount: Math.round(amount), currency:'INR',
    receipt, notes })`.
  - returns `{ id, amount, currency, status }` from the SDK response.

## Endpoint (live proration)
`POST /v1/brands/me/subscription/upgrade` Growth → Pro mid-cycle (live) →
`201` with `status: 'proration_pending'`, `razorpay_order_id`,
`razorpay_amount` (paise), `razorpay_key_id`. (No longer 502
`PAYMENT_PROVIDER_UNAVAILABLE`.)

## Regression guard
`tests/razorpay-service.test.js`:
- asserts all four functions (createSubscription, **createOrder**,
  fetchSubscription, cancelSubscription) are exported.
- with the `razorpay` SDK mocked, asserts `createOrder` invokes
  `orders.create` with rounded paise and returns the mapped shape.
- asserts `createOrder` throws when `amount` is missing/<1.
