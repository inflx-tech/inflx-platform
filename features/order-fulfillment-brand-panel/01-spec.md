# 01 — Spec: Order Fulfillment — Brand panel (Unit 2)

**Contract:** `order-fulfillment-brand-panel` (UI-governed, brand-web). Locked mockup
`04-preview/mockups/brand-fulfillment.html`. Founder: 'ok pls proceed' 2026-06-17.
Phase-1 manual model (brand-managed shipping; courier integration = later phase).

## Build
New brand-web page `app/dashboard/fulfillment/page.js` (+ nav link 📦 Fulfillment).
Lists online orders (`orderApi.list`), each expands to a 5-step fulfilment stepper
(Confirmed → Packed → Shipped → Out for Delivery → Delivered) with action buttons:
- confirmed → Mark Packed
- packed → courier dropdown + tracking/AWB input → Mark Shipped (requires both)
- dispatched → Mark Out for Delivery / Mark Delivered
- out_for_delivery → Mark Delivered
- any non-terminal → Cancel order
Each action → `orderApi.updateStatus(id, {order_status, courier_name?, tracking_number?})`
(Unit 1 backend) → per-step timestamp + follower push. Shows customer + ship-to address
+ courier/AWB + a **track-on-courier** deep link (Delhivery/DTDC/Blue Dart/XpressBees/
India Post; Google-search fallback).

## Notes
- The existing `/dashboard/orders` is a read-only Transactions list — untouched; this
  is the action/fulfilment view.
- Brand-web black/yellow dashboard style (not gold/cream — that's follower-only).

## Acceptance
- Brand can advance an order through all 5 steps + cancel; courier/AWB captured on
  ship; track link works. brand-web `npm run build` exit 0; `pnpm qa` GREEN gate 0.
  released=false until founder verify.
