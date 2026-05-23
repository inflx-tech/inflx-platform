# Workflow Definition — billing-subscriptions-schema (Phase A1)

> Step 3. The executable contract: each numbered step becomes an
> assertion in the QA workflow test. Schema-only contract — the
> "workflow" here is the migration apply + sanity-probe steps, not a
> user journey.

## Actor
Repo operator (founder, or Code-builder with founder go) running
`node backend/scripts/run-058.js` against the configured `DATABASE_URL`
(local dev `localhost:5433/inflx_dev` first; Render auto-runs against
Supabase prod on `git push origin main`).

## Preconditions
- Repo at `main` HEAD `e20e03b` (INFLX Meals shipped); latest migration
  applied is `057_meals_admin_radius.sql`.
- `pnpm qa` baseline GREEN (66/C1/gate=0) — confirmed before any code
  change per CLAUDE.md §1 "Regression".
- `pnpm dev:doctor` GREEN.
- Tables that exist and that the migration's FKs reference:
  `users`, `brands`, `followers`, `influencers`, `campaigns`,
  `link_clicks` (verified via M001 + M007).

## Workflow steps (migration apply + sanity)
1. Operator runs `node backend/scripts/run-058.js` →
   script reads `058_billing_subscriptions.sql`, executes it in a single
   transaction → expected stdout: `Running 058_billing_subscriptions.sql ... OK`.
2. Script probes `information_schema.tables` for the 5 new tables →
   expected: all five present
   (`subscription_tiers`, `brand_subscriptions`, `subscription_invoices`,
    `categories`, `attribution_clicks`).
3. Script probes `pg_type` for the 4 new enums →
   expected: `subscription_status`, `mandate_status`, `invoice_status`,
   `attribution_path` all present.
4. Script probes `subscription_tiers` →
   expected: exactly 4 rows (`free`, `growth`, `pro`, `enterprise`),
   in correct sort_order, monthly_price_inr = 0/2499/9999/29999.
5. Script probes `categories` →
   expected: exactly 16 rows, every row has `path_a_pct >= path_b_pct`
   AND `path_a_pct >= path_c_pct` (sanity: direct path should always be
   priced higher than attributed paths; if violated, founder has
   intentionally set unusual values via CSV — log a WARN, do not fail).
6. Script probes `pg_indexes` for the partial unique index
   `uniq_brand_subs_active` → expected: present.
7. Script re-runs the migration → expected: no errors, no row count
   change (idempotency proof).
8. Operator runs `pnpm qa` → expected: 66/66 GREEN, C1 STATE=GREEN,
   gate=0 (zero regression).

## Success definition
- All 5 tables, 4 enums, 4 tier rows, 16 category rows, partial unique
  index present.
- Re-applying the migration produces no changes (idempotency).
- `pnpm qa` GREEN both before and after (zero regression — no code
  reads these tables yet, so test outcomes must be identical).
- `qa:db` informational lane unchanged (the substrate applies all
  migrations including 058 — new tables exist, no tests target them).

## Failure / edge workflows
- **Migration fails mid-statement** → BEGIN/COMMIT wrapper rolls back;
  partial state impossible. Operator inspects error, fixes SQL,
  re-runs (still idempotent).
- **FK target missing** (`followers` not yet seeded on a fresh DB) →
  migration succeeds anyway; FKs validate against an empty parent
  table (PostgreSQL FK behaviour). No rows inserted, no failure.
- **Re-run on already-applied DB** → all idempotency guards no-op;
  exit 0; sanity probe still passes.
- **Production migration via Render** → Render's deploy hook runs the
  migration; failure surfaces in Render logs + the deploy stalls
  (Render does not roll the backend forward on migration failure).
  Manual recovery: drop the 5 tables + 4 enums on prod, fix, re-push.
