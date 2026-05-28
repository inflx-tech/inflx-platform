# 05-impact — wave4-tax-summary-report

**Verdict: read-only + additive. A new aggregation service + a finance-gated
admin endpoint + an admin page. No schema, no writes, no money movement, no
change to any existing flow.**

## Mechanics
- Four `SELECT … SUM` aggregations over existing tax columns within a month
  window. Nothing is written.
- Finance-gated (`requireAdminRole('finance')`), like the other money/admin
  reports.
- Defensive: malformed month → 422; missing rows → 0 via COALESCE.

## Regression
`pnpm qa` GREEN (no workflow touches this report). Boot smoke clean.
`tax-summary.test.js` 3/3 (full-month aggregation across all 4 sources +
month-window exclusion; empty month → 0; malformed month → 422). Admin page
builds.

## Deploy posture
PRODUCTION-IMPACTING, NO migration. Render + Vercel redeploy. The numbers it
shows are only as complete as the data Waves 1–3 record (e.g. commission GST +
TCS populate as commerce settles; subscription GST already populates today).
