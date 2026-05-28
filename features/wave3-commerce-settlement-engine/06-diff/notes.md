# 06-diff — wave3-commerce-settlement-engine (Wave 3 commit 2)

**Before:** Commerce purchases computed the split (brand_net, commission,
marketplace fee) and credited the influencer's pending balance, but **the
brand's share never moved to the brand** — no transfer, no TCS, no commission
GST recorded. Influencer commission was held for a **flat 30 days** regardless
of category.

**After:**

*New `settlement.service.js`.* `settleCommerceTransaction(txnId)` computes
per-brand TCS (gated by `tcs_applicable` + global `tcs_active`) and commission
GST, transfers `brand_net − tcs` to the brand's Razorpay Route linked account
(when one exists), and records `tcs_amount` / `commission_gst_amount` /
`razorpay_transfer_id`. `resolveReturnWindowEndsAt(brandId)` returns the
per-category window.

*All 4 commerce verify paths* (`verifyPayAtStore`, `verifyPrebook`,
`verifyPrebookDateRange`, `verifyOrder`): `return_window_ends_at` is now the
per-category window (was the flat `RETURN_WINDOW_MS`); after the purchase txn
commits, `settleCommerceTransaction` runs best-effort (`.catch`-wrapped).

**Why post-commit + best-effort:** the customer already paid; settlement must
never roll back or block the purchase. A failed/absent transfer leaves
`razorpay_transfer_id` null for a later retry.

**Prod safety:** the transfer only fires when the brand has a linked account —
on prod none do yet and Route is off, so no live money moves; only the tax
figures + per-category window take effect. Real settlement begins once brands
onboard (W3.1) + Route is enabled.

**Scope boundary:** the held-commission release cron already releases on
`return_window_ends_at` (now per-category) — no cron change needed here. A
settlement-retry cron for null transfers is Wave 3 commit 3.

**Verified locally:** backend boot smoke clean; `settlement.test.js` 5/5 (tcs
gate, commission GST = ₹36 on ₹200 @ 18%, mock Route transfer, idempotency,
per-category window = 7); `pnpm qa` 76/76 GREEN (gate=0).
