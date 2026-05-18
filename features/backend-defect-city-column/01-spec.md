# Backend Defect — `column "city" does not exist` on a campaign path

> Status: **PROMOTED → ACTIVE FIX CONTRACT** 2026-05-18 (was a
> carved finding from Phase 3). GENUINE BACKEND DEFECT.
> Implementation GATED on `lock.json.approved = true`.
>
> ⚠️ **NOT deploy-inert.** Edits backend runtime SQL → on release
> `git push` makes **Render auto-deploy the backend to
> production**. First runtime-code fix since A5b. It fixes a REAL
> production bug, so the deploy is desirable — but Step-14 must be
> an explicit, conscious decision.

## Fix scope (Step 7, after lock)
1. Reproduce the 500 on the qa:db Postgres (real DB) by running
   the carved-red campaign test(s); capture the EXACT failing SQL
   + Postgres error (statement + position) from the server output
   in `db-jest.log` — pin the precise file:line (no guessing;
   "pin exact at Step 7 against the live substrate" pattern).
2. Apply the **minimal** SQL correction (alias/qualifier/missing
   JOIN or unqualified `city`). No behaviour change beyond making
   the column resolvable. No refactor.
3. Verify via `pnpm qa:db`: the previously-RED carved test(s) go
   GREEN, overall passed count rises vs the 188/194/382 baseline,
   and the genuine defect is closed (not test-edited).
4. Confirm zero regression to main `pnpm qa` (66) + C1.

## Symptom
DB lane (`pnpm qa:db`) shows ×3 server errors:
`error: column "city" does not exist` → HTTP 500 on a
`/v1/campaigns/...` path (within the 6 total `Received: 500` in
the 194 residual).

## Why it's a genuine defect (not stale test / not missing migration)
- `influencers.city` **exists**: `003_seed_influencers.sql:11`
  `ALTER TABLE influencers ADD COLUMN IF NOT EXISTS city
  VARCHAR(100);` — and B2b applies ALL migrations, so the column
  IS present in the test schema. The test's request is valid.
- Therefore the 500 is the **backend's own SQL** referencing
  `city` in a context where it is not resolvable (an alias / CTE /
  joined table that does not expose `city`).

## Candidate sites (for the future fix contract — not fixed here)
- `campaign.controller.js:141` — `lower(i.city) = ANY(...)`
  (open-group match clauses)
- `campaign.controller.js:1516` — `i.city` in an influencer
  search/select
- (audit also: `brandInbox.controller.js:210 inf.city`,
  `creatorAnalytics.controller.js:96 SELECT city`,
  `admin.controller.js:535/546`)
The bug is likely an alias `i`/CTE that resolves to a relation
without `city`, OR a GROUP BY/RETURNING/subquery not projecting it.

## Disposition
- Phase 3 does NOT edit the failing test(s) and does NOT patch the
  backend (out of scope — test-debt triage only).
- A dedicated backend-fix contract (its own spec→lock→fix→qa:db)
  resolves this. Until then the catching tests stay red — they are
  correctly reporting a real product bug (these campaign endpoints
  would 500 in production on this path).
