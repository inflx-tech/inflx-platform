# 03-expected-outputs — wave3-commerce-settlement-foundation

## GET /v1/brands/me/payout-account
```json
{ "success": true, "data": {
  "linked_account_id": null,
  "linked_account_status": "not_created",
  "has_bank_details": true,
  "bank_last4": "7890",
  "bank_ifsc": "SBIN0001234" } }
```
After connect, a later GET returns `linked_account_id: "acc_…"` and (mock)
`linked_account_status: "activated"` (refreshed from Route + persisted).

## POST /v1/brands/me/payout-account
- `201 { linked_account_id: "acc_mock_…", linked_account_status: "created" }`.
- `422 PAYMENT_METHOD_MISSING` — no bank details on file.
- `409 CONFLICT` — already connected.
- `502 PAYMENT_PROVIDER_UNAVAILABLE` — Route API failure (live).

## DB after connect
`brands.razorpay_linked_account_id` set; `linked_account_status` =
`created` then `activated` after the first status refresh.

## Schema (M077, additive)
- `brands`: `razorpay_linked_account_id`, `linked_account_status`
  (default `not_created`), `tcs_applicable` (default false).
- `follower_transactions`: `tcs_amount`, `commission_gst_amount`,
  `razorpay_transfer_id` (all NULL until commit 2 populates them).

## Invariants (this commit)
- No money moves; no purchase/commission behaviour changes. Onboarding only.
- `getMySubscription` fix: `useEntitlements` + the subscription poll helpers now
  call the real method (was a no-op before).
