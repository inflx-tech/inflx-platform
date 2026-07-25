# Impact

**One-line verdict: zero schema change, one new follower endpoint + two
read-enrichments; the only behavioural change for existing flows is the
Orders screen no longer mixing bookings into the list (data untouched
server-side).**

- cancelOrder: SQL-guarded status transition (confirmed/packed only) —
  cannot corrupt dispatched/delivered orders even under race; brand
  notification is fire-and-forget.
- listOrders/getOrder: read-only LATERAL joins; response supersets (no
  field removed), so any old bundle keeps working.
- Mobile: two screens rewritten (white law); Return + Pay-Balance blocks
  preserved with identical wiring; navigation contracts unchanged
  (OrderDetail { orderId }).
- Deploy: production-impacting — backend on push, mobile via OTA. The
  cancel endpoint going live before the OTA is harmless.
