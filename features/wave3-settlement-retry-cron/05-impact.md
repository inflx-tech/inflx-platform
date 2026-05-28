# 05-impact — wave3-settlement-retry-cron

**Verdict: additive backend-only. A new service function + a new hourly cron +
its registration. No schema change. No effect on any existing flow. Dormant in
practice until brands onboard a Route account + Route is enabled (no eligible
rows otherwise).**

## Mechanics
- The cron only SELECTs rows that are settled-but-untransferred AND whose brand
  has a linked account — on prod today there are none, so it's a no-op until
  onboarding + Route.
- `retryTransfer` uses the recorded `tcs_amount` (no recompute → figures can't
  drift) and is idempotent (a set `razorpay_transfer_id` removes the row from
  eligibility).
- Per-transaction failures are caught + counted; the batch continues; the row
  retries next hour.

## Regression
`pnpm qa` GREEN. Boot smoke (app + jobs registry) clean.
`settlement-retry.test.js` 3/3 (brand-onboards-after-sale → transfer; no
linked account → not eligible; already-transferred → not retried). Existing
cron registry unchanged except the one added schedule + export.

## Deploy posture
PRODUCTION-IMPACTING, NO migration. Render redeploy. The cron is registered
hourly but finds nothing to do until brands onboard payout accounts + Razorpay
Route is enabled.
