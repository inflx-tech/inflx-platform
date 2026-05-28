# wallet-three-state-breakdown — Wave 2 commit 1

> Surface the brand wallet's Available / Reserved / Settled / Total-loaded
> breakdown as named API fields + a 4-KPI strip on the brand wallet
> page. The data already lives in `wallet_transactions`; this commit
> exposes it. No migration.

## What ships

### Backend — `wallet.controller.getWallet`

Single-pass ledger aggregation over `wallet_transactions`:

| Field | Computation |
|-------|-------------|
| `total_loaded` | SUM(topup credits) − SUM(refund debits) |
| `available_balance` | `brands.wallet_balance` (live spendable / withdrawable) |
| `reserved_balance` | SUM(escrow_lock debits) − SUM(escrow_release credits), floored at 0 |
| `settled_balance` | SUM(payout debits) — paid out to influencers |

Response keeps the legacy fields (`wallet_balance`, `escrow_locked`,
`total_deposited`) as aliases so pre-Wave-2 consumers (mobile, other
pages) don't break.

### Frontend — `/dashboard/wallet`

- Derived vars switched to the new field names with legacy fallbacks
  (`wallet?.available_balance ?? wallet?.wallet_balance ?? 0`) so the
  page renders correctly before AND after the backend redeploys.
- KPI strip extended from 3 to 4 cards: **Available · Reserved ·
  Settled · Total loaded**.

## Verify-twice

- `wallet_transactions.type` values used: topup, escrow_lock,
  escrow_release, payout, refund (confirmed against existing
  getWallet queries which already filter `type='topup'` +
  `type='escrow_lock'`).
- `brands.wallet_balance` is rupees since M021 and is already net of
  locks + payouts → it IS "available". No double-counting.
- The single aggregated query replaces 2 prior queries (topup sum +
  escrow_lock sum) — same data, fewer round-trips.

## Out of scope
- Brand wallet withdrawal (Wave 2 commit 2).
- Mobile wallet screen — brand-mobile shows a single balance; the
  3-state breakdown on mobile is a separate small follow-up. Web only
  here.

## Files
- `backend/src/controllers/wallet.controller.js` — getWallet rewrite.
- `Packages/brand-web/app/dashboard/wallet/page.js` — derived vars +
  KPI strip.
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING (Render + Vercel redeploy).
  NO migration.
- Backward compatible: legacy response fields retained; frontend has
  fallbacks for the pre-redeploy window.
- pnpm qa 76/76 GREEN.
