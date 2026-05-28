# 03-expected-outputs — wave4-tax-summary-report

## GET /v1/admin/tax-summary?month=2026-03
```json
{ "success": true, "data": {
  "month": "2026-03",
  "gst_collected": { "subscription": 100, "commission": 50, "escrow_fee": 30, "total": 180 },
  "tcs_owed": 20,
  "tds_withheld": 40,
  "detail": {
    "subscription_invoices_paid": 1,
    "commerce_transactions": 1,
    "escrow_tranches_released": 1,
    "withdrawals_paid": 1,
    "subscription_base": 2499,
    "commission_fee_base": 200,
    "escrow_fee_base": 167,
    "withdrawals_net_paid": 360
  } } }
```
(Worked example from the test: one tax event per source in March; events dated
outside the month are excluded.)

- No `month` param → current month (`YYYY-MM`).
- Malformed month (`2026-13`, `March`) → `422 VALIDATION_ERROR` (field `month`).
- A month with no activity → all totals `0`.

## Invariant
Pure read aggregation: `total = subscription + commission + escrow_fee`; no
writes; window is `[month-01, month-01 + 1 month)`.
