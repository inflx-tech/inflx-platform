# wave3-settlement-retry-cron — Wave 3 commit 3

> An hourly cron that completes commerce settlement transfers left null —
> because the brand onboarded a payout account AFTER the sale, or a transient
> Razorpay Route failure. Backend-only, additive, dormant until Route + onboarding.

## What ships
- `settlement.service.retryTransfer(runner, transactionId)` — for an
  already-settled txn (tcs recorded) with no transfer id and a brand that now
  HAS a linked account, transfers `brand_net − tcs_amount` via Route and records
  `razorpay_transfer_id`. Skips (with a reason) if already transferred / no
  linked account / zero amount.
- `backend/src/jobs/settlement-retry.job.js` — selects eligible txns (completed,
  `razorpay_transfer_id` null, `tcs_amount` not null, `brand_net > 0`, brand has
  a linked account; LIMIT 200) and retries each. Per-txn failures are logged +
  counted, never stopping the batch.
- Registered in `jobs/index.js` — hourly at `:20` (offset from the other hourly
  jobs). Not scheduled when `ENABLE_CRONS=false` (tests call `run()` directly).

## Why
Brands may onboard a Route payout account after some commerce sales have already
happened; those earlier transactions recorded the split + taxes but couldn't
transfer (no account at the time). This cron backfills them once the account
exists, and self-heals transient transfer failures.

## Verify-twice
- Eligibility requires `tcs_amount IS NOT NULL` (settlement already ran) — the
  retry uses the recorded tcs, not a recompute, so the figures never drift.
- Idempotent: once `razorpay_transfer_id` is set the row is no longer eligible.
- Dormant on prod until brands onboard + Route is enabled (no eligible rows).

## Out of scope
- Reconciling transfer STATUS via webhook (transfers settle async on Route) —
  future, alongside the brand-payout webhook follow-up.

## Files
- `backend/src/services/settlement.service.js` (retryTransfer)
- `backend/src/jobs/settlement-retry.job.js`
- `backend/src/jobs/index.js`
- `backend/tests/settlement-retry.test.js`
- This contract.

## Non-functional
- Deploy posture: **PRODUCTION-IMPACTING, NO migration**. Render redeploy. Cron
  runs hourly but finds no eligible rows until brands onboard + Route is enabled.
- `pnpm qa` GREEN. Boot smoke (app + jobs) clean. `settlement-retry.test.js`
  mock coverage.
