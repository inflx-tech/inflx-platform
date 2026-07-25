# concept-stagec4-orders — My Orders · tracking timeline · cancel-until-dispatched

Founder locked the board (04-preview/mockups/c4-orders.html) in the browser
pane, 2026-07-25: "pls start building."

## Scope

1. **My Orders (OrderHistoryScreen rewrite)** — white law, no yellow. Tabs
   All / Active / Delivered / Cancelled over GET /follower/orders. Cards:
   live first-item photo + "+N more", brand, "via @creator", COD due-tag,
   amount, status chip (Confirmed filled · in-transit outline · Delivered
   green · Cancelled muted red). Supersedes the old mixed activity inbox
   on this screen (bookings/pay-at-store data stays server-side).
2. **Order detail (OrderDetailScreen rewrite)** — vertical timeline lit
   from the REAL per-status timestamps (already written by brand/admin
   status updates); courier + AWB under Dispatched with the carrier deep
   link; items + bill with COD fee and honest paid/due labels; address;
   cancelled banner with the money-truth per payment method. Preserved
   functional blocks: Fashion-1b Request Return (delivered online orders)
   + MyReturns link, prebook Pay-Balance-at-venue.
3. **Cancel (locked rule 2026-07-24: until 'dispatched')** — button
   renders only while confirmed/packed; NEW backend POST
   /follower/orders/:id/cancel enforces the same guard (409 after
   dispatch; SQL-guarded update so a racing brand dispatch beats a racing
   cancel deterministically), stamps cancelled_at, notifies the brand.
   Prepaid = refund-initiated messaging (real refund rails are Wave-3
   money work); COD = nothing was charged. Commission job already
   excludes cancelled orders.

## Backend (small — verified almost everything existed)

- Status vocabulary + per-status timestamp columns + brand/admin PATCH +
  per-step follower notifications: all pre-existing, reused untouched.
- NEW: cancelOrder endpoint (above).
- listOrders enrichment: creator handle join + item_count + live
  first-item name/image (LATERAL on items_json->0).
- getOrder enrichment: product_meta LATERAL (live names/images for every
  item — items_json snapshots carry no names).

## Out of scope

Refund execution rails (Wave 3) · bookings/pay-at-store resurfacing ·
brand-side order panel changes (already ships status+courier+AWB).
