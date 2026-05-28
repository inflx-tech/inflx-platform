# wave3-commerce-settlement-foundation — Wave 3 commit 1

> Foundation for commerce settlement (Razorpay Route): the schema, the Route
> service (mock + dormant-live), and brand payout-account onboarding. ADDITIVE
> and DORMANT — no money movement yet. The actual settlement wiring (transfers,
> TCS, per-category release) is Wave 3 commit 2; Razorpay Route must be enabled
> on the account before the live path activates.

## Why
The revenue audit's headline gap: commerce purchases never settle to brands
automatically. Wave 3 closes that. This first commit lays the groundwork so the
rest can be built + tested in mock mode while Razorpay Route is being enabled.

## What ships

### M077 (additive, dormant)
- `brands.razorpay_linked_account_id`, `linked_account_status` (default
  `not_created`), `tcs_applicable` (bool, default false — the per-brand TCS gate
  set by finance after verifying ₹50L+ turnover).
- `follower_transactions.tcs_amount`, `commission_gst_amount`,
  `razorpay_transfer_id`.
- Reuses the existing `follower_transactions.return_window_ends_at` as the
  commission-release timer (commit 2 changes how it's COMPUTED → per-category).

### `razorpayRoute.service.js` (new)
`createLinkedAccount`, `getLinkedAccountStatus`, `createTransfer` — `RAZORPAY_MOCK`
split. Mock returns synthetic IDs (full flow testable now); live is built
against the Razorpay Route Accounts/Transfers API but DORMANT until
`RAZORPAY_MOCK=false` + Route enabled.

### Brand payout onboarding
- `GET /v1/brands/me/payout-account` — status (+ derived `has_bank_details`,
  `bank_last4`); refreshes status from Route when an account exists.
- `POST /v1/brands/me/payout-account` — create the linked account from the
  brand's saved bank details (Wallet → Bank account) + business info. 422 if no
  bank details on file; 409 if already connected.
- Brand-web `/dashboard/settings/payouts` — connect button + status display.

### Adjacent correctness fix (bundled, documented)
`brandApi.getSubscription()` was called at 3 sites (`lib/useEntitlements.js`,
the subscription page's two poll helpers — one added in Wave 2 commit 4) but the
method is named **`getMySubscription`** — `getSubscription` was never defined, so
those calls silently failed (masked by server-side quota enforcement + the
poll's try/catch fallback). Fixed all 3 to `getMySubscription`.

## Verify-twice
- `follower_transactions` already has `return_window_ends_at` (the
  commission-confirm cron reads it) → reused, not duplicated with a new
  `commission_releasable_at`.
- `tcsOn`/`getReturnWindowForCategory` exist but are still UNWIRED — that
  wiring is commit 2; this commit only adds the schema + service + onboarding.
- Confirmed via git history that `getSubscription` was never defined (not a
  Window B regression) — `getMySubscription` is original (commit 591fdc4).

## Out of scope (Wave 3 commit 2)
- Settlement transfer at purchase-verify; per-brand TCS deduction;
  commission-GST; wiring the per-category return window into commission release;
  the held-commission release cron using it.

## Files
- `backend/migrations/077_commerce_settlement_foundation.sql` + `run-077.js`
- `backend/src/services/razorpayRoute.service.js`
- `backend/src/controllers/payoutAccount.controller.js`
- `backend/src/routes/brand.routes.js`
- `Packages/brand-web/app/dashboard/settings/payouts/page.js`
- `Packages/brand-web/lib/api.js`
- `Packages/brand-web/lib/useEntitlements.js` (adjacent fix)
- `Packages/brand-web/app/dashboard/settings/subscription/page.js` (adjacent fix)
- `backend/tests/payout-account.test.js`
- This contract.

## Non-functional
- Deploy posture: **PRODUCTION-IMPACTING + MIGRATION (M077, additive/dormant)**.
  Migrate-first (M077 to prod before the code lands, per shared-main). Render +
  Vercel redeploy. No behaviour change until commit 2 + Route enablement.
- `pnpm qa` GREEN. Backend boot smoke clean. Mock jest coverage for onboarding.
