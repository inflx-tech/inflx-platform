# Workflow — wallet-three-state-breakdown (Wave 2 commit 1)

## Actor
Brand viewing `/dashboard/wallet`.

## Preconditions
- Render + Vercel redeployed with this commit.

## Workflow A — brand views wallet
1. Brand opens `/dashboard/wallet`.
2. Page calls `GET /v1/brands/me/wallet`.
3. Backend runs the single aggregation query over wallet_transactions.
4. Returns `{ total_loaded, available_balance, reserved_balance,
   settled_balance, + legacy aliases }`.
5. KPI strip renders 4 cards:
   - **Available** = available_balance (spendable / withdrawable).
   - **Reserved** = reserved_balance (locked in active campaigns).
   - **Settled** = settled_balance (paid out to influencers).
   - **Total loaded** = total_loaded (all-time top-ups net of refunds).
6. Hero card still shows Available as the headline balance.

## Workflow B — pre-redeploy window (defensive)
1. Vercel deploys frontend before Render finishes backend.
2. Frontend calls getWallet, gets the OLD response shape (only
   wallet_balance / escrow_locked / total_deposited).
3. Frontend fallbacks kick in: `available_balance ?? wallet_balance`,
   `reserved_balance ?? escrow_locked`, `total_loaded ?? total_deposited`.
4. Settled shows ₹0 until backend redeploys (acceptable — it's a new
   field).
5. Once backend redeploys, all 4 KPIs populate correctly.

## Success
- 4 KPIs render with correct values.
- pnpm qa 76/76 GREEN.
- No regression for mobile / other pages consuming the legacy fields.

## Failure modes
- Brand with no transactions → all sums 0, available = wallet_balance
  (likely 0). Renders cleanly.
- Reserved goes negative if release credits exceed lock debits (data
  anomaly) → floored at 0 via Math.max.
