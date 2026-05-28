# 06-diff — wave3-settlement-retry-cron (Wave 3 commit 3)

**Before:** Commerce settlement (W3.2) was best-effort at purchase time — if the
brand had no Route payout account yet (or a transient Route failure occurred),
the transfer was skipped and `razorpay_transfer_id` stayed null with no recovery
path. A brand that onboarded a payout account *after* earlier sales would never
receive settlement for those sales.

**After:**

*New `settlement.service.retryTransfer(txnId)`* — for a settled txn (tcs already
recorded) with no transfer id whose brand now HAS a linked account, transfers
`brand_net − tcs_amount` via Route and records `razorpay_transfer_id`. Skips
with a reason otherwise.

*New `settlement-retry.job`* — hourly (`:20`), selects eligible txns (settled,
untransferred, positive net, brand has a linked account; LIMIT 200) and retries
each, counting successes/failures without stopping the batch. Registered in
`jobs/index.js`; not scheduled under `ENABLE_CRONS=false` (tests call `run()`).

**Why:** backfills settlements for brands that onboard after selling, and
self-heals transient Route failures — closing the last gap in the commerce
money loop.

**Prod-safe:** the cron finds no eligible rows until brands onboard + Route is
enabled, so it's a no-op until then. Uses recorded `tcs_amount` (no recompute),
idempotent on `razorpay_transfer_id`.

**Verified locally:** boot smoke (app + jobs) clean; `settlement-retry.test.js`
3/3 (onboard-after-sale → transfer; no-account → not eligible; already-transferred
→ skipped); `pnpm qa` 76/76 GREEN (gate=0).
