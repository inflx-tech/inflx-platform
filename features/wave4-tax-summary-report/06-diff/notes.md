# 06-diff — wave4-tax-summary-report (Wave 4 commit 1)

**Before:** The platform recorded GST (subscription, commission, escrow fee), TCS,
and TDS across Waves 1–3, but there was no consolidated view — no way for finance
to see what GST was collected, TCS owed, or TDS withheld in a month for filing
returns. The numbers were scattered across `subscription_invoices`,
`follower_transactions`, `escrow_entries`, and `influencer_withdrawals`.

**After:**

*New `taxReport.service.monthlySummary(month)`* aggregates all of them for a
`YYYY-MM` window: GST collected (subscription + commerce commission + escrow
Protection-fee), TCS owed, TDS withheld — plus a `detail` block of counts/bases.

*New `GET /admin/tax-summary` (finance+)* exposes it; defaults to the current
month, 422 on a malformed month.

*New `/admin/tax-summary` page* — month picker, headline cards (GST / TCS / TDS),
a GST breakdown table, and an explicit date-basis note.

**Date basis (deliberate, documented):** subscription GST by invoice paid date;
commission GST + TCS by transaction date; Protection-fee GST by tranche release
date (`escrow_entries` has no `created_at`); TDS by payout completion date.

**Scope boundary:** read-only report only. No schema, no writes. Invoice PDFs
(subscription + commerce, brand as seller-of-record) are the next Wave 4 commits.

**Verified locally:** boot smoke clean; `tax-summary.test.js` 3/3 (full-month
aggregation across all four sources incl. month-window exclusion; empty month →
0; malformed month → 422); brand-web build compiles (exit 0); `pnpm qa` 76/76
GREEN (gate=0).
