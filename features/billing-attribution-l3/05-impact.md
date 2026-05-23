# Impact — billing-attribution-l3 (Phase A5)

## Changes
- 1 service file extended (`validateTracking` SELECT adds brand_category).
- 1 controller file: 4 createOrder sites + 4 verifyOrder sites updated (or noted as unchanged).
- 1 test file: pay-at-store assertion updated.

## Blast radius
- Every follower transaction now flows through pricing.service for L3
  fee. The math changes for mapped categories.
- `breakdown.platform_fee` JSON value changes for the affected paths
  (frontend shows the new number; key unchanged).
- attribution_clicks accumulates one row per Path B transaction.

## Risk
- **Brand revenue surprise** — restaurant Path B drops from 8% → 4%;
  brand_net goes UP (good for brand) but INFLX revenue per txn drops.
  Net effect at scale: depends on volume. The walkthrough math
  predicts net negative ~₹1,826/mo for Glow Studio in month 1, offset
  by L1 SaaS revenue ₹2,499/mo.
- **Attribution row growth** — one row per Path B txn. With current
  txn volumes (low), no concern. Index `idx_attribution_active` keeps
  lookup fast.

## Rollback
Revert the commit. validateTracking + transaction.controller restore
to flat-fee math. attribution_clicks rows stay (orphaned but harmless;
the table is read-only for the legacy path).

## Pre-push checklist
1. pnpm qa 67/67 GREEN.
2. backend jest pay-at-store passes with updated assertion.
3. gov-check exit 0.
