# 03-expected-outputs — wave3-commerce-settlement-engine

## settleCommerceTransaction(runner, txnId)
Worked example: brand_net ₹1,000, marketplace_fee ₹200, gst 18%.

| Brand state | tcs | commission_gst | transfer | row after |
|---|---|---|---|---|
| no linked account, tcs_applicable=false | 0 | 36 (200×18%) | none (null) | tcs_amount=0, commission_gst_amount=36, razorpay_transfer_id=null |
| linked account, tcs off | 0 | 36 | `trf_mock_…` for ₹1,000 | razorpay_transfer_id set |
| tcs_applicable=true, global tcs_active off | 0 | 36 | per linked account | tcs still 0 (both gates required) |
| already settled | — | — | — | `{ skipped: true }` (idempotent) |

Return value: `{ tcs, commission_gst, transfer_id, transfer_amount }` (or
`{ skipped: true }`).

## resolveReturnWindowEndsAt(runner, brandId)
Returns `now + categories.return_window_days` for the brand's category (global
fallback if unset). e.g. restaurant window 7 → ~7 days out.

## follower_transactions after a commerce purchase
`tcs_amount`, `commission_gst_amount`, `razorpay_transfer_id` populated;
`return_window_ends_at` = per-category window (was flat 30).

## Invariants
- Purchase flow never blocked by settlement (best-effort, post-commit, `.catch`).
- No live transfer fires without a linked account (prod-safe until Route on).
- `pnpm qa` GREEN (no workflow exercises the commerce settlement math).
