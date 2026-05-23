# Workflow — billing-column-rename (Phase A2)

## Actor
Repo operator running `node backend/scripts/run-059.js` against the
configured `DATABASE_URL` (local dev first; Render auto-runs on push).

## Preconditions
- M058 (Phase A1) applied — verified via `subscription_tiers` row
  count = 4.
- `pnpm qa` GREEN baseline before this contract begins (67/67).

## Steps
1. Apply M059 to local dev DB → column renamed; old name no longer in
   `information_schema.columns`.
2. Re-apply → no-op (IF EXISTS guards).
3. Apply updated backend code → controllers query the new column name
   directly; API response field name `platform_fee` preserved by SQL
   aliases.
4. Run `pnpm qa` → 67/67 GREEN, C1 STATE=GREEN, gate=0.
5. Run backend jest `pnpm --filter inflx-backend test` against local
   dev DB to confirm test suite passes against renamed column (this is
   a substrate-of-truth check, separate from the qa:db informational
   lane).

## Success
- `follower_transactions.marketplace_fee_amount` exists; `platform_fee` does not.
- All API responses still emit `platform_fee` as the JSON key.
- `pnpm qa` GREEN, no regression in any reader downstream.

## Failure modes
- Migration fails because column already renamed on prod → idempotency
  guard skips the ALTER, exit 0.
- A reader site missed by grep → 500 in the missed endpoint. Mitigation:
  exhaustive grep + pnpm qa coverage + backend jest run.
