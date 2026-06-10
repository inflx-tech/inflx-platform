# backend-defect-pending-order-volatile-store

> Carved from Phase A golden-journey E2E (2026-06-10, `Docs/PHASE_A_RESULTS.md`
> defect D2). Also explains the founder's missing food order (2026-06-10
> follower diagnostic).

## Symptom

A follower order/payment that completes the Razorpay charge but whose
`/verify` call never reaches the backend leaves ZERO database trace — the
order silently vanishes. Worse: the pending-order store is an **in-memory
Map** (`transaction.service.js:27 pendingOrders`), used by ALL FIVE follower
verify paths (pay-at-store, store-offer, prebook, prebook-daterange, online
order) in BOTH mock and live mode. Every Render deploy/restart wipes in-flight
checkouts in production. Additionally, if the verify DB transaction throws,
the order was already consumed from the Map → retry impossible.

## Fix (minimal, no behaviour change on the happy path)

1. Migration `098_payment_pending_orders.sql`: durable table
   `payment_pending_orders(order_id PK, amount_rupees, meta jsonb,
   created_at, consumed_at)`.
2. `transaction.service.js`: `createOrder`/`createMockOrder` INSERT the row
   (async). `consumeMockOrder` replaced by:
   - `getPendingOrder(orderId)` — peek (no claim); 404 if absent, 409-style
     error if already consumed.
   - `consumePendingOrder(client, orderId)` — atomic claim INSIDE the verify
     `withTransaction` (UPDATE … SET consumed_at=now() WHERE consumed_at IS
     NULL; 0 rows → throw → rollback). Crash-safe AND double-spend-safe:
     tx failure rolls back the claim (retry works); concurrent double-verify
     loses the claim race and rolls back.
3. All 5 verify call sites in `transaction.controller.js` switch to
   peek-then-claim-in-tx.

Unverified orders now persist (support-visible; future app recovery endpoint
can list them — app-side retry is Sprint app work, out of scope here).
Wallet top-up keeps its own map: live mode verifies against Razorpay's API
directly (prod-safe), out of scope.

## Proof of fix

Phase A S6.5: unverified order leaves an unconsumed `payment_pending_orders`
row (was: nothing anywhere). S6.3/S6.4/S6.8 (all verify paths) stay PASS.
