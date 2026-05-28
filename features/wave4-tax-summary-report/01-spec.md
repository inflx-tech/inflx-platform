# wave4-tax-summary-report — Wave 4 commit 1

> A monthly tax-summary admin report: GST collected (subscription + commerce
> commission + escrow Protection-Fee), TCS owed, and TDS withheld — for filing
> returns. Read-only aggregation over already-recorded tax columns. No schema,
> no money movement.

## What ships

### `taxReport.service.monthlySummary(month)` (new)
Aggregates, for a `YYYY-MM` window, from the columns recorded across Waves 1–3:
- **GST collected** = subscription `gst_amount_inr` (paid invoices) + commerce
  `commission_gst_amount` (transactions) + escrow `fee_gst_amount` (released
  tranches).
- **TCS owed** = commerce `tcs_amount`.
- **TDS withheld** = influencer withdrawals `tds_deducted` (completed payouts).
Returns the totals + a `detail` block (counts + bases) for context.

### Backend endpoint
`GET /v1/admin/tax-summary?month=YYYY-MM` (finance+). Defaults to the current
month. 422 on a malformed month.

### Admin UI
`/admin/tax-summary` — month picker + headline cards (GST / TCS / TDS) + a GST
breakdown table + the date-basis note.

## Date basis (documented for the CA)
- subscription GST → invoice `paid_at`
- commission GST + TCS → `follower_transactions.created_at`
- Protection-fee GST → `escrow_entries.released_at` (fee realised at release;
  `escrow_entries` has no `created_at`)
- TDS → `influencer_withdrawals.completed_at`

## Verify-twice
- Confirmed all source columns exist (subscription_invoices.gst_amount_inr,
  follower_transactions.commission_gst_amount + tcs_amount, escrow_entries.
  fee_gst_amount, influencer_withdrawals.tds_deducted) + that escrow_entries has
  NO created_at → used released_at.
- Read-only: no writes, no money movement, no schema change.

## Out of scope (Wave 4 later commits)
- Subscription invoice PDF generator (`invoice_pdf_r2_key` exists, unwired).
- Commerce invoice PDFs (brand as seller-of-record).

## Files
- `backend/src/services/taxReport.service.js`
- `backend/src/controllers/admin.controller.js` (getTaxSummary)
- `backend/src/routes/admin.routes.js`
- `Packages/brand-web/app/admin/tax-summary/page.js`
- `Packages/brand-web/lib/api.js`
- `backend/tests/tax-summary.test.js`
- This contract.

## Non-functional
- Deploy posture: **PRODUCTION-IMPACTING, NO migration**. Render + Vercel
  redeploy. Read-only admin report.
- `pnpm qa` GREEN. Boot smoke clean. `tax-summary.test.js` 3/3.
