# 02-workflow — wave3-commerce-settlement-engine

## On every completed commerce purchase (all 4 verify paths)
1. Follower pays; the verify handler computes the split (commission, marketplace
   fee, brand_net) and INSERTs the `follower_transactions` row — now with
   `return_window_ends_at = resolveReturnWindowEndsAt(brand_id)` (per-category).
2. Influencer commission is credited to `pending_balance` (unchanged).
3. The purchase transaction commits.
4. **Post-commit, best-effort:** `settleCommerceTransaction(transactionId)`:
   - read txn (brand_net, marketplace_fee, payment_id) + brand
     (tcs_applicable, linked account);
   - `tcs = tcs_applicable ? tax.service.tcsOn(brand_net) : 0` (tcsOn returns 0
     unless the global `tcs_active` gate is on);
   - `commission_gst = gstOn(marketplace_fee)`;
   - if the brand has a linked account: Route-transfer `brand_net − tcs` →
     `razorpay_transfer_id`; else skip (recorded for retry);
   - persist `tcs_amount`, `commission_gst_amount`, `razorpay_transfer_id`.
   - any failure is caught + logged — the purchase already succeeded.

## Commission release (existing cron, now per-category)
- The commission-confirm cron releases `pending_balance → wallet_balance` when
  `return_window_ends_at <= now()`. Because the window is now per-category, food
  releases fast, fashion/electronics hold longer — driven by admin settings.

## Mock vs live / prod safety
- Mock (dev/test): transfers are synthetic; full flow testable.
- Prod (RAZORPAY_MOCK=false): no brand has a linked account yet + Route is off →
  the transfer is SKIPPED. Only the tax figures + per-category window take
  effect. Real transfers begin once brands onboard (W3.1) + Route is enabled.
