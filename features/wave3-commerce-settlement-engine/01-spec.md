# wave3-commerce-settlement-engine — Wave 3 commit 2

> The settlement engine: every completed commerce purchase now computes per-brand
> TCS + commission GST, transfers the brand's net share to its Razorpay Route
> linked account, and releases influencer commission on the per-category window.
> Backend-only, additive, best-effort. Builds on the M077 foundation (commit 1).

## What ships

### `settlement.service.js` (new)
- `resolveReturnWindowEndsAt(runner, brandId)` — per-category commission-release
  window (`categories.return_window_days`, global fallback). Replaces the flat
  `RETURN_WINDOW_MS`.
- `settleCommerceTransaction(runner, transactionId)` — reads the txn + brand;
  computes `tcs` (only when `brands.tcs_applicable` AND global
  `payment_config.tcs_active` — via `tax.service.tcsOn`), `commission_gst`
  (`gstOn(marketplace_fee_amount)`); transfers `brand_net − tcs` to the brand's
  linked account via Razorpay Route (only if a linked account exists); records
  `tcs_amount` / `commission_gst_amount` / `razorpay_transfer_id`.
  **Best-effort + idempotent** (skips if `tcs_amount` already set).

### `transaction.controller.js` — all 4 commerce verify paths
(`verifyPayAtStore`, `verifyPrebook`, `verifyPrebookDateRange`, `verifyOrder`):
- `return_window_ends_at` now = `resolveReturnWindowEndsAt(brandId)` (per-category)
  instead of the flat 30-day constant.
- After the purchase transaction commits, call `settleCommerceTransaction`
  best-effort (`.catch`-wrapped) — a failed transfer NEVER breaks the purchase.

## Settled decisions honoured
- **Per-brand TCS with verification** — gated by the `tcs_applicable` flag (set by
  finance after ₹50L turnover verification) AND the global `tcs_active` switch.
- **Per-category return window** — drives commission release (founder confirmed
  per-category, not per-business).

## Verify-twice
- All 4 verify paths share the identical `returnWindowEndsAt` line + a
  `transactionId` after their txn block + `meta.brand_id` — confirmed before the
  uniform edit.
- Settlement runs POST-commit (not inside the DB txn) so the external transfer
  never holds the purchase transaction open.
- Transfer only fires when `brands.razorpay_linked_account_id` is set — on prod
  no brand has one yet + Route is off, so NO live transfer fires; only the tax
  figures + per-category window take effect (intended, safe).

## Out of scope (Wave 3 commit 3)
- Settlement retry cron for transfers left null; the held-commission release cron
  already releases on `return_window_ends_at` (now per-category) — verify only.

## Files
- `backend/src/services/settlement.service.js`
- `backend/src/controllers/transaction.controller.js`
- `backend/tests/settlement.test.js`
- This contract.

## Non-functional
- Deploy posture: **PRODUCTION-IMPACTING, NO migration** (M077 already on prod).
  Render redeploy. Per-category window + commission-GST recording go live; the
  Route transfer stays dormant (no linked accounts + Route off). Best-effort so
  purchases are never blocked.
- `pnpm qa` GREEN. Backend boot smoke clean. `settlement.test.js` mock coverage.
