# 06 — Diff Notes: Follower Order Tracking (Unit 4)

Locked reference: `../04-preview/mockups/order-tracking.html` (Creators Vibe screen 09).

## Implemented
- OrderDetailScreen rebuilt to the tracking timeline: header (Order # + gold status
  badge + via @creator) → vertical 5-step timeline (real per-step dates; done=gold ✓,
  current=ink; cancelled banner) → Shipment card (courier + AWB + Track-on-courier deep
  link via Linking) → items/total → address → Return CTA → prebook pay-balance (kept) →
  view-my-returns (kept).
- getOrder SELECT extended: transaction_type (FIX — Return CTA condition never matched
  before), composed delivery_address (join follower_addresses), creator_handle/name.

## Faithful to mockup
Vertical timeline w/ icons+dates, Shipment block, track button, via @creator — matches
screen 09 adapted to the 5-step lifecycle + courier/AWB.

## Verification
- backend node --check clean; pnpm qa GREEN gate 0; OTA bundle (metro) compiles.
- Founder verify: brand advances an order (Unit 2) → follower OrderDetail shows the
  timeline advancing + courier/AWB + working Track link.
