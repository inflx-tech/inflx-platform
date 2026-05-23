# billing-column-rename — follower_transactions.platform_fee → marketplace_fee_amount (Phase A2)

> **Phase A2 of the INFLX 3-Layer Revenue Model.** Coordinated breaking
> change: rename the L3 fee column on `follower_transactions` from the
> legacy `platform_fee` to the new `marketplace_fee_amount`. All
> backend readers/writers updated in the same commit as the migration.
> Production-impacting (Render runs M059 on Supabase prod).

## Why this rename
After Phase A5 ships the path-based marketplace fee, the column holds
specifically L3 (per-follower-transaction) marketplace fee — distinct
from L1 (subscription) and L2 (escrow). Calling it `platform_fee` was
fine when it was the only fee; with three layers it's ambiguous. The
new name aligns with the L3 spec terminology in CLAUDE.md.

## Scope — verify-twice corrections vs. the brief
- **Only `follower_transactions.platform_fee`** is renamed. The brief
  also mentioned "platform_fee_amount → escrow_fee_amount on
  follower_transactions / wallet_transactions / campaign rows" — those
  parts of the brief are NOT in scope:
  - `escrow_entries.platform_fee_amount` was already renamed to
    `escrow_fee_amount` by M037 (verified by reading the migration).
  - `wallet_transactions` has no `platform_fee_amount` column — only
    an enum value `'platform_fee'` in `wallet_tx_type` (verified by
    reading M001 CREATE TABLE).
  - `campaigns` already uses `escrow_fee_pct_locked` + `escrow_fee_base_inr`
    + `escrow_fee_locked_at` (M037); never had `platform_fee_amount`.

## API surface preservation
**The wire format does NOT change.** Frontend reads `platform_fee`
from API responses today; we keep that JSON key by aliasing every
SELECT (`SELECT marketplace_fee_amount AS platform_fee FROM …`).
Result:
- Zero change to `Packages/brand-web/app/**` (`/dashboard/orders`,
  `/dashboard/conversions`, `/dashboard/wallet`).
- Zero change to `Packages/Mobile/src/screens/brand/**`
  (`BrandWalletScreen`, `BrandConversionsScreen`).
- Zero Window B conflict (Window B touches styling/layout only,
  not data-binding lines that read this field).

A future, separate contract can do the JSON-key rename if/when
desired; out of scope here.

## Files touched
- `backend/migrations/059_rename_marketplace_fee_amount.sql`
- `backend/scripts/run-059.js`
- `backend/src/controllers/admin.controller.js` (6 SQL strings)
- `backend/src/controllers/brand.controller.js` (2 SQL strings)
- `backend/src/controllers/transaction.controller.js` (7 INSERT column lists + 1 SELECT-list reference — JS variable names `platformFee`/`meta.platform_fee` keep their identity, no semantic change)
- `backend/tests/**` — 6 test files updated where they SELECT/INSERT the column directly (API-response assertions need no change because of the SELECT-AS aliases).
- This contract.

## Non-functional
- Idempotent migration: `DO $$ … IF column platform_fee exists AND column marketplace_fee_amount does not exist THEN ALTER TABLE … RENAME COLUMN`.
- Rollback: rename back via the inverse `DO $$` block.
- Zero new behaviour shipped — fees still computed via the legacy
  `record.platform_fee_pct || env.PLATFORM_FEE_PCT` math; pricing.service
  rewires happen in Phase A3/A5.
