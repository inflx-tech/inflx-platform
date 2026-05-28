# 03-expected-outputs — wave2-brand-wallet-withdrawal

## POST /v1/brands/me/wallet/withdraw

Request: `{ "amount": 20000, "method": "upi" }`

`201`:
```json
{ "success": true, "data": {
  "withdrawal_id": "<uuid>",
  "amount_requested": 20000,
  "method": "upi",
  "status": "pending"
} }
```

Errors (`422` unless noted):
- `WITHDRAWAL_TOO_SMALL` — below `min_withdrawal_inr`.
- `INSUFFICIENT_BALANCE` — exceeds `wallet_balance`.
- `PAYMENT_METHOD_MISSING` — chosen method has no details in `listing_data`.
- `VALIDATION_ERROR` — bad amount / method.

State after success:
- `brands.wallet_balance` decreased by `amount`.
- one `brand_withdrawals` row, `status='pending'`, destination snapshotted.
- one `wallet_transactions` row `type='withdrawal' direction='debit'`,
  `balance_after` = new balance.

## GET /v1/brands/me/wallet/withdrawals
`200 { withdrawals: [ { withdrawal_id, amount_requested, method, status,
failure_reason, created_at, completed_at } ] }` — newest first.

## GET /v1/admin/brand-withdrawals?status=&search=&page=
`200`:
```json
{ "success": true,
  "data": { "withdrawals": [ { "id","brand_id","amount_requested","method",
    "upi_id","bank_account_no","bank_ifsc","account_holder_name",
    "razorpay_payout_id","status","failure_reason","created_at","completed_at",
    "brand_name","brand_phone" } ],
    "summary": { "pending_count","pending_amount","processing_count",
      "today_paid","today_count" } },
  "meta": { "page","limit","total" } }
```
`status` ∈ all|pending|queued|processing|completed|failed|cancelled.

## POST /v1/admin/brand-withdrawals/:id/process
- `{ action:'approve' }` → `200 { withdrawal:{...status:'completed'|'processing'}, action:'approved' }`
  (MOCK → completed + `razorpay_payout_id` `mock_payout_*`).
- `{ action:'reject', reason }` → `200 { withdrawal:{...status:'cancelled', failure_reason:reason}, action:'rejected' }`; wallet refunded.
- non-pending row → `409 CONFLICT`.
- live payout failure → `502 PAYOUT_FAILED`; wallet refunded, status `failed`.

## Breakdown invariant
`getWallet` (commit 1) is unchanged. `available_balance` reflects the
debit; `reserved_balance` / `settled_balance` / `total_loaded` are
unaffected because their FILTERs never match `type='withdrawal'`.
