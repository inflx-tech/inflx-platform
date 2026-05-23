# Impact — billing-column-rename (Phase A2)

## Changes
- 1 DB column renamed.
- 3 backend controllers updated (admin / brand / transaction).
- 6 backend test files updated where they reference the DB column.
- 0 frontend files touched (SELECT-AS aliases preserve API field name).
- 0 mobile files touched.

## Blast radius
- Every reader of `follower_transactions.platform_fee` is in the same
  commit. PostgreSQL ALTER TABLE RENAME COLUMN is metadata-only;
  existing data intact, no row-level rewrite.
- API JSON wire format unchanged → no Vercel re-deploy needed for
  frontend (it auto-deploys anyway on every push; behaviourally no-op).
- Window B no-conflict by design — no `Packages/**` files modified.

## Rollback
Revert the commit + run the inverse migration:
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='follower_transactions' AND column_name='marketplace_fee_amount')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='follower_transactions' AND column_name='platform_fee') THEN
    ALTER TABLE follower_transactions RENAME COLUMN marketplace_fee_amount TO platform_fee;
  END IF;
END $$;
```

## Risks
- **Missed reader site causing 500 in prod** — mitigated by exhaustive grep + pnpm qa + backend jest test run on local-dev DB BEFORE push.
- **Race window during prod deploy** — Render deploys the new image and runs the migration as one atomic deploy step. There is no window where the new code runs against the old schema or vice versa.

## Pre-push checklist
1. M059 applied to local dev DB; idempotent re-apply clean.
2. `pnpm qa` 67/67 GREEN, C1 STATE=GREEN, gate=0.
3. Backend jest test run (`cd backend && pnpm test`) GREEN against renamed column.
4. `gov-check` exit 0.
