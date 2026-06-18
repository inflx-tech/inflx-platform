# 06 — Diff Notes: Order Fulfillment Engine (Unit 1, backend + migration)

Not UI-governed (no mockup) — backend/DB foundation for the fulfillment engine.

## Implemented
- Migration 105 + run-105.js: order_status += packed/out_for_delivery/cancelled;
  follower_orders += courier_name/tracking_number/packed_at/out_for_delivery_at/cancelled_at.
- updateOrderStatus: 5-step lifecycle + cancel + courier/tracking + per-step timestamp
  + per-step FCM.
- listBrandOrders: fixed the missing `delivery_address` column (join follower_addresses
  + compose); surfaced courier + step timestamps. (This was the live brand-orders bug.)
- commission-confirm cron: skips cancelled orders + active/successful returns.

## Verification
- backend node --check (transaction.controller, brand.controller, commission-confirm.job,
  run-105) clean.
- migration 105 applies in-chain in qa:db (0-error); enum values + 5 columns present.
- pnpm qa GREEN gate 0 (no main-gate regression).
- PROD: migrate 105 first (explicit go), then push. released=false.

## PROD MIGRATION APPLIED 2026-06-17 (founder go)
Migration 105 applied to prod (.env.prod-backup). INCIDENT caught + fixed: the
statement-splitter (run-105 + the inline applier) glued the leading `--` comment block
to the first ALTER TYPE ('packed') and filtered the whole chunk as a comment → 'packed'
was skipped on the first apply (out_for_delivery/cancelled + all 5 columns applied).
Detected via the post-apply enum verify (showed packed missing), applied 'packed'
separately, re-verified. PROD order_status = {confirmed,packed,dispatched,
out_for_delivery,delivered,cancelled} + 5 columns present. run-105 splitter fixed
(strip `--` lines before splitting) so future runs/qa:db are correct.

## Units to follow (UI-governed, mockup-lock each)
- Unit 2: brand-web Orders fulfilment panel (status stepper + courier/tracking entry).
- Unit 3: admin Orders oversight screen (view all / force-status / cancel / refund +
  pending_balance cleanup on refund).
- Unit 4: follower Order Tracking screen 09 (5-step timeline + courier + tracking#).

## POST-AUDIT SIGNATURE HARDENING 2026-06-17
4-agent adversarial wiring audit confirmed money path + commission attribution +
fulfilment WIRED end-to-end (real follower_orders + follower_transactions rows +
pending_balance credit, even in mock mode). ONE finding: `verifyOrder` never validated
the Razorpay signature (verifyPaymentSignature defined/exported but uncalled) — harmless
in mock, a real-money gap. FIX: verifyOrder now calls
`txService.verifyPaymentSignature(order_id, payment_id, signature)` → 422 on mismatch.
No-op today (RAZORPAY_MOCK → true); the gate for real-money go-live. Mobile already sends
razorpay_signature (OnlineOrder + RestaurantCart; mock supplies 'mock_signature').
node --check clean; pnpm qa GREEN.
