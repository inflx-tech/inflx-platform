# 05 — Impact: Checkout flow

**Verdict: mobile-only functional reskin over the EXISTING real order/commission
backend. No backend, no migration. Same createOrder/verify/payload — only the screen
flow + a new confirmation screen + restaurant live-payment cutover.**

## Mechanics
- `screens/follower/OnlineOrderScreen.js` — rewritten as a 3-step stepper (Shipping /
  Payment / Review). The `createOrder`→`processPayment`→`verifyOrder` logic + the
  organic-vs-creator payload (4-ID tracking) are PRESERVED verbatim; success now
  `replace('OrderConfirmation', …)` instead of an Alert. Discount estimate shown on
  review from the carried offer (server authoritative).
- `screens/follower/OrderConfirmationScreen.js` — NEW (screen 08).
- `navigation/FollowerNavigator.js` — register `OrderConfirmation`.
- `screens/follower/RestaurantCartScreen.js` — `mockPayment` → `processPayment`
  (real keyId, signature → verify). Live money for dining too.

## Blast radius
- Touches the checkout screen + dining cart payment + adds one screen. No backend/API
  change; the order endpoints + commission are unchanged (audited).
- Deploy-class: production-impacting (mobile OTA). released=false until founder
  real-purchase verify (place order via creator link → influencer pending_balance rises).
- Risk: medium — OnlineOrderScreen rewrite; mitigated by preserving the exact order
  payload + call sequence; metro bundle = syntax gate; founder real-purchase = behavior gate.
- Finance: NO new money path. processPayment already falls back to mock in dev if the
  SDK is unavailable, so the cutover can't hard-crash.
