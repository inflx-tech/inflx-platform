# Impact Analysis — billing-subscriptions-schema (Phase A1)

> Step 5. What changes, what breaks, what risks. Backend-only contract;
> additive migration; zero behaviour change at runtime in this phase.

## What changes
- 5 new tables, 4 new enums, 7 new indexes, 4 new triggers on existing
  `update_updated_at()` function.
- 20 seed rows: 4 subscription tier rows + 16 category rows.
- 0 tables modified, 0 columns dropped, 0 constraints removed.
- 0 changes to `backend/src/**` in this phase. (Phase A2 starts the
  read-path changes.)

## Blast radius — what code paths could be affected
**None at runtime.** The 5 new tables have no readers or writers in
any current controller, service, route, or middleware (verified by
grep across `backend/src/**` for each new table name → zero hits).

The migration only EXTENDS the schema; nothing in production reads or
writes the new tables until Phase A4 (quota middleware lazy-creates a
`free` `brand_subscriptions` row on first check) and Phase A5
(`transaction.controller` writes `attribution_clicks` + reads
`categories`). All four enum types are likewise unused at runtime
until those phases.

## Risk to functionality
- **Risk: schema migration fails on Render deploy** → Render stalls
  the deploy; existing prod continues to run on the prior image. The
  migration is wrapped in `BEGIN/COMMIT`, fully idempotent (`IF NOT
  EXISTS`, `DO $$ EXCEPTION WHEN duplicate_object`, `ON CONFLICT DO
  NOTHING`), and was tested against local dev DB before push.
  Mitigation: re-run the runner is safe; rollback is documented below.
- **Risk: FK target missing on a future fresh DB bootstrap** → all FK
  targets (`users`, `brands`, `followers`, `influencers`, `campaigns`,
  `link_clicks`) exist by M013 at the latest. M058 sits at the end of
  the chain; PostgreSQL validates FKs against currently-empty parent
  tables without error. Not a real risk.
- **Risk: prod-only enum-name collision** → all four new enums use
  names not present in M001-M057 (verified by grep). The `DO $$
  EXCEPTION WHEN duplicate_object` guard handles even an accidental
  pre-existence (re-run safety).

## Risk of conflict with parallel Window B work
- Window B's scope = `Packages/shared/theme/**`, `Packages/shared/components/**`,
  `Packages/*/app/**`, `Packages/Mobile/src/{screens,components,navigation}/**`.
- This contract's scope = `backend/migrations/**`, `backend/scripts/**`,
  `backend/seeds/**` (gitignored), `features/billing-subscriptions-schema/**`.
- **Zero file overlap.** No coordination needed for Phase A1.

## Files touched in this contract
```
features/billing-subscriptions-schema/
  01-spec.md
  02-workflow.md
  03-expected-outputs.md
  05-impact.md       (this file)
  lock.json
backend/migrations/058_billing_subscriptions.sql
backend/scripts/run-058.js
backend/seeds/subscription_tiers_draft.csv     (gitignored — review artifact)
backend/seeds/categories_draft.csv             (gitignored — review artifact)
```

No other files are modified by Phase A1.

## Test impact
- Main `pnpm qa` (66 specs): zero touch to any code path tested →
  expected zero regression.
- `pnpm qa:db` informational lane: the substrate applies migrations
  001..058 on the ephemeral test DB. No backend jest spec currently
  reads/writes the new tables → expected zero behaviour delta.
- No new tests in this phase — first tests land in Phase A3
  (pricing.service extensions for L1/L3/classifyPath).

## Deploy classification
**PRODUCTION-IMPACTING** (Render → Supabase prod migration runner).
- Surfaced explicitly to founder for go/no-go per CLAUDE.md §1.
- Never pushed silently.
- Pre-push checklist:
  1. Migration applied locally (`node backend/scripts/run-058.js`) — clean.
  2. Re-applied locally — idempotent, zero delta.
  3. `pnpm qa` 66 GREEN / C1 / gate 0 — captured before + after.
  4. `pnpm qa:db` informational — substrate green, no behaviour delta.
  5. CSV drafts (`backend/seeds/*_draft.csv`) reviewed + accepted by founder.
  6. `gov-check` exit 0 (Rule 1 contract-touched satisfied).

## Rollback strategy
Additive-only → rollback = revert the commit + apply the inverse SQL
on prod:
```sql
BEGIN;
DROP TABLE IF EXISTS attribution_clicks;
DROP TABLE IF EXISTS subscription_invoices;
DROP TABLE IF EXISTS brand_subscriptions;
DROP TABLE IF EXISTS subscription_tiers;
DROP TABLE IF EXISTS categories;
DROP TYPE IF EXISTS attribution_path;
DROP TYPE IF EXISTS invoice_status;
DROP TYPE IF EXISTS mandate_status;
DROP TYPE IF EXISTS subscription_status;
COMMIT;
```
Safe to run because no application code reads/writes these in Phase A1.
After Phase A5 ships, rollback requires more care (real data exists
in `attribution_clicks`); each later phase documents its own rollback.

## Open items / explicit non-decisions
- **L3 percentages are PLACEHOLDERS.** Founder edits
  `backend/seeds/categories_draft.csv` before any live transaction uses
  them. Phase A5 (the live read path) is gated on founder go AFTER the
  CSV is approved + the values flow through.
- **L1 tier prices are PLACEHOLDERS.** Same flow: founder edits
  `subscription_tiers_draft.csv`; the migration's `INSERT ... ON
  CONFLICT DO NOTHING` accepts whatever final values founder picks.
- **GST default = 18% IGST.** Inter-state subtleties + per-state CGST/SGST
  split can be added later as additional `subscription_invoices` columns;
  Phase A6 documents the chosen model when it lands.
- **Razorpay subscription/mandate IDs are nullable** in `brand_subscriptions`
  — they only populate when a brand actually upgrades from Free
  (Phase A6). The `free` tier rows have no mandate.
