# 02-workflow — wave3-commerce-settlement-foundation

## Brand connects a payout account
1. Brand has saved bank details (Wallet → Bank account → `listing_data.bank_details`).
2. Brand opens `/dashboard/settings/payouts`.
3. `GET /brands/me/payout-account` → `{ linked_account_status:'not_created',
   has_bank_details:true, bank_last4 }` → page shows a "Connect payout account" button.
4. Brand clicks Connect → `POST /brands/me/payout-account`:
   - 422 `PAYMENT_METHOD_MISSING` if no bank on file.
   - 409 if already connected.
   - else: `razorpayRoute.createLinkedAccount` (mock → synthetic `acc_…`/`created`;
     live → Razorpay Accounts API) → persist `razorpay_linked_account_id` +
     `linked_account_status`. Returns `{ linked_account_id, linked_account_status }`.
5. `GET` again → status refreshed from Route (`getLinkedAccountStatus`; mock →
   `activated`) and persisted → page shows "Active".

## What is NOT wired yet (Wave 3 commit 2)
- No transfer happens on a purchase yet — `createTransfer` exists but isn't
  called from the transaction flow.
- TCS / commission-GST / per-category release timing are unchanged (still the
  flat-30 commission-confirm path). Commit 2 wires those.

## Mock vs live
- `RAZORPAY_MOCK=true` (dev/test): accounts + transfers are synthetic; onboarding
  completes instantly (created → activated). Fully testable now.
- `RAZORPAY_MOCK=false` + Route enabled (later): real linked-account creation +
  KYC; status reflects Razorpay; transfers move real money (commit 2).
