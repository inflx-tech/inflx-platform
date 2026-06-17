# 03 — Expected Outputs: Brand fulfillment panel

- New `/dashboard/fulfillment` page + nav link; lists orders via GET /brands/me/orders.
- Status stepper + per-status action buttons advance the order; ship requires courier +
  tracking; cancel works; terminal states show no actions.
- Courier + AWB + track-on-courier link render once shipped.
- Each action calls PATCH /brands/me/orders/:id/status (Unit 1) → status + timestamp +
  follower push.
- brand-web `npm run build` exit 0; `pnpm qa` 79 GREEN gate 0 (web build is the gate
  for this JSX; no backend change).
