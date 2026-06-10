# Workflow — durable pending-order lifecycle

1. Follower initiates any payment (pay-at-store / store-offer / order / prebook / prebook-daterange) → `createOrder` INSERTs a `payment_pending_orders` row (order_id, rupees, meta), mock and live alike.
2. Follower pays (Razorpay sheet / mock) → app calls the matching `/verify` endpoint.
3. Verify handler PEEKS the row (`getPendingOrder` — 404 if absent, 409 if already consumed), then inside its `db.withTransaction`: **claims the row atomically** (`consumePendingOrder`: UPDATE … SET consumed_at WHERE consumed_at IS NULL) before writing follower_transactions/orders/bookings.
4. Failure paths:
   - Verify never fires (network/app death) → row stays unconsumed: durable, support-visible, retryable later.
   - Verify transaction throws → claim rolls back with it → retry works.
   - Two concurrent verifies → second claim matches 0 rows → throws 409 → its transaction rolls back (no double spend).
   - Backend restart/deploy between create and verify → row survives (was: Map wiped).

Expected end state: every initiated payment is represented by exactly one row, consumed iff its business rows exist.
