# wave2-brand-wallet-withdrawal — Wave 2 commit 2

> Let a brand withdraw its available wallet balance to its saved bank /
> UPI. Admin-gated: a request reserves the funds (debits the wallet +
> writes a `pending` row); the RazorpayX payout fires only when an admin
> approves it in `/admin/payouts`. Closes gap #4 from the revenue audit
> (brands could load + spend but never take money back out).

## Settled decisions

1. **Admin-gated, not immediate** (founder, 2026-05-28). A request creates
   a `pending` `brand_withdrawals` row and debits the wallet immediately
   (reserves funds). Admin **approve** → payout fires; admin **reject** →
   wallet refunded + status `cancelled`. Human gate on money leaving the
   platform.
2. **No TDS.** A brand withdrawing its own wallet balance is not a taxable
   payout (unlike influencer earnings). `brand_withdrawals` has no
   `tds_deducted` / `net_paid` — the full amount is paid.
3. **Server-side destination.** The payout target is read server-side from
   `brands.listing_data.bank_details`. The client sends only
   `{ amount, method }` and can never redirect funds to an arbitrary
   account. The chosen destination is snapshotted onto the withdrawal row.
4. **Ledger type `withdrawal`, not `payout`.** `getWallet` attributes
   `payout` debits to influencer tranche settlements (`settled_balance`).
   A new `wallet_tx_type` value `withdrawal` keeps the brand payout
   distinct, so the Available/Reserved/Settled breakdown (commit 1) stays
   correct without change.

## What ships

### M075 (gated — applied to prod with M076 at the end of Wave 2)
- `ALTER TYPE wallet_tx_type ADD VALUE 'withdrawal'`.
- `CREATE TYPE brand_withdrawal_status` = pending | queued | processing |
  completed | failed | cancelled.
- `CREATE TABLE brand_withdrawals` (mirror of `influencer_withdrawals`
  minus TDS; adds `account_holder_name`, `failure_reason`). Index
  `(brand_id, status)`.

### Backend
- `POST /v1/brands/me/wallet/withdraw` `{ amount, method }` —
  `wallet.controller.requestWithdrawal`. Validates min + balance + that the
  chosen method has details on file; transactionally debits the wallet,
  inserts a `pending` row, writes a `withdrawal`/`debit` ledger row.
- `GET /v1/brands/me/wallet/withdrawals` — the brand's own history.
- `GET /v1/admin/brand-withdrawals` + `POST /v1/admin/brand-withdrawals/:id/process`
  (finance+) — `admin.controller.getBrandWithdrawals` / `processBrandWithdrawal`.
- `withdrawal.service.ensureBrandFundAccount` + `executeBrandPayout` reuse
  the existing `createRazorpayPayout` (RazorpayX) helper.

### Frontend (brand-web)
- `/dashboard/wallet` — a **Withdraw funds** card (amount + method, to the
  saved bank/UPI) + a recent-withdrawals list with status pills. Reuses the
  locked `.w` wallet palette.
- `/admin/payouts` — an **Influencer / Brand** scope toggle; the Brand
  queue mirrors the influencer table/modal minus TDS, with the richer
  status set.
- `lib/api.js` — `walletApi.requestWithdrawal` / `getWithdrawals`,
  `adminApi.getBrandWithdrawals` / `processBrandWithdrawal`.

## Verify-twice
- `brands` has `wallet_balance` + `razorpay_contact_id` but NO stored
  payment method → destination comes from `listing_data.bank_details`
  (JSONB, added M013; saved by the wallet "Bank account" card).
- `wallet_tx_type` confirmed = topup/escrow_lock/escrow_release/payout/
  refund/platform_fee; `getWallet` FILTERs don't match `withdrawal`, so
  the breakdown is untouched (`getWallet` not modified).
- Wallet debited at request (reserves funds); refunded on reject AND on
  payout failure (the money never left in either case).
- Admin payout queue + role gate (`requireAdminRole('finance')`) mirror the
  existing influencer withdrawal routes exactly.

## Out of scope
- L2 GST on the Protection Fee (Wave 2 commit 3, M076).
- Mid-cycle upgrade pro-ration (Wave 2 commit 4).
- Mobile brand wallet withdraw (web only here).

## Files
- `backend/migrations/075_brand_withdrawals.sql` + `backend/scripts/run-075.js`
- `backend/src/services/withdrawal.service.js` (brand helpers)
- `backend/src/controllers/wallet.controller.js` (request/list)
- `backend/src/routes/wallet.routes.js`
- `backend/src/controllers/admin.controller.js` (admin queue)
- `backend/src/routes/admin.routes.js`
- `Packages/brand-web/app/dashboard/wallet/page.js`
- `Packages/brand-web/app/admin/payouts/page.js`
- `Packages/brand-web/lib/api.js`
- `backend/tests/brand-withdrawal.test.js` + `backend/tests/helpers/db.js`
- This contract.

## Non-functional
- Deploy posture: **PRODUCTION-IMPACTING + MIGRATION (M075)**. Surfaced for
  explicit go; M075 batched with M076 for one combined prod migration.
- `pnpm qa` must stay GREEN (gate=0). Backend boot smoke clean.
