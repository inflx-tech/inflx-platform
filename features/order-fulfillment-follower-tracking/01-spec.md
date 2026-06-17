# 01 — Spec: Order Fulfillment — Follower tracking (Unit 4)

**Contract:** `order-fulfillment-follower-tracking` (UI/Mobile-governed). Locked mockup
`04-preview/mockups/order-tracking.html` (Creators Vibe screen 09). Founder: 'pls lock it' 2026-06-17.

## Build
Rebuild `screens/follower/OrderDetailScreen.js` into the tracking timeline:
- Header: Order # + status badge (gold) + **via @creator**.
- Vertical **5-step timeline** (Confirmed → Packed → Shipped → Out for Delivery →
  Delivered) driven by the real per-step timestamps (purchased_at/packed_at/
  dispatched_at/out_for_delivery_at/delivered_at); done=gold ✓, current=ink. Cancelled
  → a cancelled banner.
- **Shipment** card: courier + tracking/AWB + a **Track on <courier> ↗** deep link
  (Delhivery/DTDC/Blue Dart/XpressBees/India Post; Google fallback) via Linking.
- Items + total, delivery address, Return CTA (delivered + online_order), prebook
  pay-balance block (preserved), View-my-returns link (preserved).

## Backend
Extend `getOrder` (GET /follower/orders/:id) SELECT: add `transaction_type` (fixes a
latent bug — the Return CTA condition `transaction_type==='online_order'` never matched),
composed `delivery_address` (join follower_addresses), and `creator_handle/creator_name`
(join campaign_influencers→influencers→users). The new step columns already arrive via
`fo.*`.

## Acceptance
- Follower sees the 5-step timeline with real dates, courier + AWB + working track link,
  via @creator; Return CTA appears on delivered online orders.
- backend node --check clean; `pnpm qa` GREEN gate 0; OTA bundle compiles. released=false.
