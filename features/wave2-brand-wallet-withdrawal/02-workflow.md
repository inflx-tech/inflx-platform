# 02-workflow — wave2-brand-wallet-withdrawal

## Happy path (UPI, admin approves)

1. Brand has saved bank details (`listing_data.bank_details`) via the wallet
   "Bank account" card, and an available balance ≥ the requested amount.
2. Brand opens `/dashboard/wallet` → **Withdraw funds** card → enters an
   amount, picks a method (UPI shown if a UPI ID is on file, else Bank).
3. `POST /brands/me/wallet/withdraw { amount, method }`:
   - validate `amount > 0`, `method ∈ {upi, bank_transfer}`,
     `amount ≥ payment_config.min_withdrawal_inr`, `amount ≤ wallet_balance`,
     and that the chosen method's details exist in `listing_data`.
   - in a transaction: `SELECT wallet_balance FOR UPDATE` → re-check balance →
     `UPDATE brands SET wallet_balance -= amount` → `INSERT brand_withdrawals
     (... status 'pending')` → `INSERT wallet_transactions (type 'withdrawal',
     direction 'debit', balance_after)`.
   - respond `201 { withdrawal_id, amount_requested, method, status:'pending' }`.
4. Brand sees the request in the wallet's recent-withdrawals list as
   **pending**; available balance has dropped.
5. Admin opens `/admin/payouts` → **Brand** tab → sees the pending row →
   **Approve**.
6. `POST /admin/brand-withdrawals/:id/process { action:'approve' }`:
   - guard: status must be `pending` (else 409).
   - set `processing`; then —
     - MOCK: set `completed` + `razorpay_payout_id = mock_payout_*`.
     - LIVE: `executeBrandPayout` → `ensureBrandFundAccount` (reuse/create
       `brands.razorpay_contact_id` + a fund account from the row snapshot) →
       `createRazorpayPayout` → set `completed`/`processing` + payout id.
   - notify the brand (push + SMS).
7. Wallet stays debited (already reserved at step 3 — no double deduction).

## Reject path

5b. Admin **Reject** with a reason →
    `POST .../process { action:'reject', reason }`:
    - guard: status must be `pending`.
    - in a transaction: refund `wallet_balance += amount` + reversing
      `wallet_transactions (type 'withdrawal', direction 'credit')` +
      `UPDATE brand_withdrawals SET status='cancelled', failure_reason=reason`.
    - notify the brand.

## Failure paths
- **Payout API fails** (live, on approve): refund wallet + reversing credit +
  status `failed` + `failure_reason`; respond 502 `PAYOUT_FAILED`.
- **Below minimum** → 422 `WITHDRAWAL_TOO_SMALL`.
- **Over balance** → 422 `INSUFFICIENT_BALANCE` (checked again under
  `FOR UPDATE` to defeat races).
- **No method on file** → 422 `PAYMENT_METHOD_MISSING`.
- **Re-processing a non-pending row** → 409 `CONFLICT`.
