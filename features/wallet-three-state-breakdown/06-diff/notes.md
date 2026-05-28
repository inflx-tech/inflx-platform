# 06-diff — wallet-three-state-breakdown (Wave 2 commit 1)

**Before:** `getWallet` ran 2 separate queries (topup sum +
escrow_lock sum) and returned `{ wallet_balance, escrow_locked,
total_deposited, brand_id }`. The brand wallet page showed 3 KPIs:
Available / Locked in escrow / Total deposited. There was no
explicit "Settled" (paid-out) figure, and the spec's
Available/Reserved/Settled model wasn't surfaced as named fields.

**After:** `getWallet` runs ONE aggregated query with FILTER clauses
and returns the full breakdown:

| Field | Meaning |
|-------|---------|
| `total_loaded` | lifetime top-ups − refunds out |
| `available_balance` | brands.wallet_balance (live spendable / withdrawable) |
| `reserved_balance` | escrow_lock debits − escrow_release credits (≥ 0) |
| `settled_balance` | payout debits (paid to influencers) |

Legacy fields (`wallet_balance`, `escrow_locked`, `total_deposited`)
are kept as aliases so mobile + other pages don't break.

The wallet page KPI strip goes from 3 → 4 cards: **Available ·
Reserved · Settled · Total loaded**. The hero card headline still
shows Available.

**Why brands.wallet_balance IS "available":** since M021 the column
is rupees and is decremented at contract-sign (escrow_lock) and never
holds locked funds — locked funds are already subtracted. So the live
column is exactly the spendable/withdrawable amount. Reserved and
Settled are reconstructed from the ledger for display, not subtracted
again.

**Defensive frontend:** derived vars use `?? legacy ?? 0` so the page
renders correctly during the brief window where Vercel has deployed
the new frontend but Render hasn't yet shipped the new backend shape.
Settled shows ₹0 in that window, then populates once backend
redeploys.

**Verified locally:** boot smoke clean; pnpm qa 76/76 GREEN (45.3s).
