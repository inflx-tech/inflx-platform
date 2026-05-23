# meals-schema — workflow

## Build steps
1. Author `backend/migrations/056_meals_schema.sql` — additive DDL:
   enums (guarded), 9 tables, FKs, indexes, `updated_at` triggers.
2. Apply non-destructively to the local dev DB (`localhost:5433`)
   so the running local stack keeps its data:
   `node` one-shot that runs only `056` against `DEV_DATABASE_URL`.
3. Verify: every new table + enum exists; FKs resolve.
4. Prove full-order composition: the migration is idempotent and is
   picked up by `dev-db-init` / the `qa:db` global setup in numeric
   order with no error.
5. `pnpm qa` → must stay GREEN (66/C1/gate0). Additive schema cannot
   regress the existing suite; this confirms it.

## Expected end state
- `dev:doctor` still green, local DB now has 56 + 9 = 65 tables.
- `pnpm qa` green, unchanged count.
- No production change until founder approves the push (migration is
  production-impacting → surfaced, never silent).

## Deploy posture
PRODUCTION-IMPACTING (`backend/migrations/`). On founder go:
`git push origin main` → Render runs the migration against Supabase
prod. Until then it lives only in the local dev DB. Rollback for an
additive-only migration = drop the new tables/enums (no existing
data touched).

## Verification commands
- `pnpm dev:doctor`
- one-shot apply of `056` (logged, names failing statement on error)
- table/enum existence probe via `information_schema` + `pg_type`
- `pnpm qa`
