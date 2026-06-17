# 03 — Expected Outputs: Follower Order Tracking

- OrderDetail shows 5-step vertical timeline with real per-step dates; done/current
  styling; cancelled banner when cancelled.
- Shipment card with courier + AWB + a working Track-on-courier link.
- via @creator attribution in the header.
- Return CTA shows for delivered online orders (now that getOrder returns transaction_type).
- GET /follower/orders/:id returns transaction_type + delivery_address + creator_handle.
- backend node --check clean; pnpm qa 79 GREEN gate 0; OTA bundle compiles.
