# 06-diff — wave2-brand-wallet-withdrawal (Wave 2 commit 2)

**Before:** A brand could load (topup) and spend (escrow) its wallet, but
there was no way to take money back out. `brands.wallet_balance` could only
go up (topup) or be locked (escrow). The wallet page had Top-up + bank-details
cards but no withdraw action. `/admin/payouts` handled influencer withdrawals
only.

**After:**

*Backend.* New admin-gated brand payout path:
`POST /brands/me/wallet/withdraw` reserves funds (debits the wallet, writes a
`pending` `brand_withdrawals` row + a `withdrawal`/`debit` ledger row);
`/admin/brand-withdrawals` + `.../process` let finance admins approve (fire a
RazorpayX payout via the reused `createRazorpayPayout`) or reject (refund +
`cancelled`). M075 adds the `withdrawal` ledger type, the
`brand_withdrawal_status` enum, and the `brand_withdrawals` table.

*Brand wallet page.* New **Withdraw funds** card: amount + method, paying to
the saved `listing_data.bank_details` (UPI preferred when present), with a
masked destination line and a recent-withdrawals list with status pills. If no
bank details are on file, it points the brand to the existing bank-details
card. All new classes (`.wd-*`) compose existing `.w` palette tokens — no new
colors/fonts.

*Admin payouts page.* Added an **Influencer / Brand** scope toggle. The
influencer queue renders exactly as before (same columns, modal, statuses).
The Brand queue mirrors it minus the TDS / Net Payout columns, with the
richer status set (pending/queued/processing/completed/failed/cancelled) and
the brand approve/reject actions.

**Why the ledger type is `withdrawal`, not `payout`:** commit 1's `getWallet`
attributes `payout` debits to influencer tranche settlements
(`settled_balance`). Reusing `payout` would inflate that figure. A distinct
`withdrawal` type leaves the Available/Reserved/Settled breakdown correct with
zero change to `getWallet`.

**Money invariant:** the wallet is debited once at request time and refunded
on BOTH reject and payout-failure, so a debit always corresponds to either a
completed payout or a refund.

**Verified locally:** backend boot smoke clean; `brand-withdrawal.test.js`
8/8 green (request → pending → approve/reject, min/balance/method guards,
double-process 409); brand-web production build compiles (exit 0); `pnpm qa`
76/76 GREEN (gate=0, STATE=GREEN).
