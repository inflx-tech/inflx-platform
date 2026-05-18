# Backend Defect — `column "city" does not exist` on a campaign path

> Status: **CARVED FINDING (backlog)** from backend-test-debt
> Phase 3, 2026-05-18. This is a GENUINE BACKEND DEFECT, not test
> debt. The catching test(s) are intentionally LEFT RED. NOT
> auto-fixed — a backend fix is its own future contract.

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
