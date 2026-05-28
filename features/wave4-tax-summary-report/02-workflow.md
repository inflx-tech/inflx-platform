# 02-workflow — wave4-tax-summary-report

1. Finance admin opens `/admin/tax-summary` (defaults to the current month).
2. `GET /admin/tax-summary?month=YYYY-MM` → `taxReport.monthlySummary(month)`.
3. Four parallel aggregations over the `[month-01, +1 month)` window:
   - subscription_invoices (status='paid', `paid_at`) → subscription GST + base.
   - follower_transactions (status='completed', `created_at`) → commission GST +
     TCS + fee base.
   - escrow_entries (status='released', `released_at`) → Protection-fee GST + base.
   - influencer_withdrawals (status='completed', `completed_at`) → TDS + net paid.
4. Response: `gst_collected{subscription,commission,escrow_fee,total}`,
   `tcs_owed`, `tds_withheld`, `detail{counts + bases}`.
5. UI renders headline cards + a GST breakdown table + the date-basis note. The
   admin changes the month picker to re-query any month.

## Notes
- Read-only — no writes anywhere.
- Malformed `month` → 422 VALIDATION_ERROR.
