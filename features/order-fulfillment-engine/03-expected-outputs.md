# 03 — Expected Outputs: Order Fulfillment Engine (Unit 1)

- order_status enum has packed/out_for_delivery/cancelled; follower_orders has
  courier_name/tracking_number/packed_at/out_for_delivery_at/cancelled_at.
- Brand can PATCH status through the 5 steps + cancel; courier/tracking captured on
  dispatch; follower notified each step.
- GET /brands/me/orders returns orders with a composed delivery_address + courier +
  timestamps (no SQL error).
- Commission cron does NOT confirm commission for cancelled/returned transactions.
- Migration 105 applies in-chain (qa:db) 0-error; node --check clean; pnpm qa GREEN.
