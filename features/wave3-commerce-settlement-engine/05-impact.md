# 05-impact — wave3-commerce-settlement-engine

**Verdict: additive + best-effort. New service + a post-commit hook in the 4
commerce verify paths + a per-category window swap. No schema change (M077
already on prod). The purchase flow is never blocked; on prod the live transfer
is dormant (no linked accounts + Route off).**

## Mechanics
- **Settlement is post-commit + `.catch`-wrapped** — a failed transfer (or any
  settlement error) is logged and the purchase still succeeds. The customer
  already paid; settlement is a follow-on.
- **Idempotent** (skips if `tcs_amount` already set) — safe against duplicate
  verify deliveries.
- **Transfer gated on a linked account** — on prod no brand has one yet, so NO
  live money moves; only `tcs_amount` (0, gate off) + `commission_gst_amount`
  are recorded.
- **Per-category window** replaces the flat 30-day commission hold. Defaults to
  30 per category (seeded), so unless an admin customized a category, release
  timing is unchanged — the intended behaviour the founder asked for.

## Behaviour change on prod (intended, safe)
- New commerce transactions record `commission_gst_amount` + `tcs_amount` (0)
  and use the per-category `return_window_ends_at`. No money movement, no
  purchase-flow risk.

## Regression
`pnpm qa` GREEN. Backend boot smoke clean. `settlement.test.js` 5/5 (tcs gate,
commission GST, mock transfer, idempotency, per-category window). The 4 verify
paths were edited uniformly + identically; the only runtime addition is the
guarded post-commit call.

## Deploy posture
PRODUCTION-IMPACTING, NO migration. Render redeploy. Live transfers begin only
once brands onboard a payout account (W3.1) AND Razorpay Route is enabled.
