-- 098 — Durable pending-payment order store.
-- Contract: features/backend-defect-pending-order-volatile-store
--
-- Replaces the in-memory pendingOrders Map in transaction.service.js, which
-- was used by ALL follower verify paths (pay-at-store, store-offer, prebook,
-- prebook-daterange, online order) in both mock and live mode — every backend
-- restart/deploy wiped in-flight checkouts, and a failed verify transaction
-- consumed the order irrecoverably.
--
-- Amounts in RUPEES (platform-wide rule since migration 021).

CREATE TABLE IF NOT EXISTS payment_pending_orders (
  order_id      text PRIMARY KEY,
  amount_rupees numeric(12,2) NOT NULL,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  consumed_at   timestamptz
);

-- Support queries: find a follower's unconsumed (abandoned/in-flight) orders.
CREATE INDEX IF NOT EXISTS idx_payment_pending_orders_unconsumed
  ON payment_pending_orders (created_at)
  WHERE consumed_at IS NULL;
