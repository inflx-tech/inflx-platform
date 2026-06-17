# 01 — Spec: Order Fulfillment Engine

**Contract:** `order-fulfillment-engine`. Founder-locked model 2026-06-17:
5-step fulfillment + courier/tracking, full admin oversight+override, commission
held in pending until return window closes (a return within the window cancels it).

Built in deployable units. **Unit 1 (this commit) = backend + migration spine.**
Units 2–4 (brand panel, admin orders, follower tracking) follow as UI-governed
contracts each with a mockup-lock.

## Unit 1 — foundation (backend + migration, NOT UI-governed)
- **Migration 105:** `order_status` enum += `packed`, `out_for_delivery`, `cancelled`
  (existing `dispatched` kept = "Shipped"); `follower_orders` += `courier_name`,
  `tracking_number`, `packed_at`, `out_for_delivery_at`, `cancelled_at`. Additive +
  idempotent (precedent 038/075 for ADD VALUE).
- **Brand `updateOrderStatus`:** accepts the 5-step lifecycle + `cancelled`, captures
  `courier_name` + `tracking_number`, stamps the per-step timestamp, notifies the
  follower at each step (packed/shipped/out-for-delivery/delivered/cancelled).
- **Live-bug fix:** `listBrandOrders` SELECTed `fo.delivery_address` (no such column)
  → join `follower_addresses` via `address_id` + compose the address; surface the
  new courier/timestamp columns. (This is why the brand Orders list was broken.)
- **Commission correctness:** the commission-confirm cron now SKIPS a transaction
  whose order is `cancelled` OR has an active/successful return
  (`requested/approved/received/refunded`) → commission for returned/cancelled orders
  is never released to the withdrawable wallet. A later-rejected return clears the
  guard so the next run confirms normally.

## Follow-ups (noted)
- Decrement `pending_balance`/`total_earned` when a return is refunded (cleanup) —
  rides Unit 3 (admin/returns). Today the cron-skip already prevents wrongful payout.

## Acceptance (Unit 1)
- Migration 105 applies in-chain (qa:db) 0-error; backend node --check clean;
  `pnpm qa` GREEN gate 0. Brand orders list no longer errors. Prod migrate needs
  explicit founder go. released=false.
