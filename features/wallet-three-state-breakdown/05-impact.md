# Impact — wallet-three-state-breakdown (Wave 2 commit 1)

## Changes
- `wallet.controller.getWallet` — replaced 2 queries with 1 aggregated
  query; returns 4 named breakdown fields + 3 legacy aliases.
- `/dashboard/wallet` — 4-KPI strip + new derived vars with fallbacks.
- 1 contract.

## Blast radius
- `GET /v1/brands/me/wallet` response gains 4 fields, keeps all
  existing fields. Any consumer reading the old fields is unaffected.
- Brand wallet page renders 4 KPIs instead of 3.

## Rollback
Revert commit. getWallet returns to the 2-query shape; wallet page
shows 3 KPIs. No data impact.

## Risks
- **None functional.** Pure read-path change + UI. No writes, no
  migration.
- Reserved floored at 0 to avoid negative display from data
  anomalies.
- pnpm qa 76/76 GREEN — no regression.

## Pre-push checklist
1. pnpm qa GREEN ✓
2. Boot smoke clean ✓
3. gov-check exit 0
