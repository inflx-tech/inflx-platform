# Feature Spec — fix onboarded-creator city search

> Step 1. GATED on `lock.json.approved = true`. PRODUCTION-
> IMPACTING (forward-only DB-view migration → Render). Resolves
> carve `features/backend-defect-onboarded-creator-city-search`.
> Founder GO 2026-05-19: "This is required pls fix this".

## Problem
`GET /v1/influencers/search?city=<x>` never matches onboarded
(registered) influencers — their `city` is always NULL in
`v_searchable_creators`, so the city filter excludes them.
Verify-twice: influencer registration writes city to
`users.city` (influencer.controller.js:214-219); `INSERT INTO
influencers` omits city → `influencers.city` always NULL for
onboarded. The view's onboarded branch selected `i.city`
(migration 045) instead of the available `u.city` (the join is
already present). Mirrors the city-on-users convention (cf.
fixed brand `backend-defect-city-column`).

## Fix (forward-only migration)
`backend/migrations/055_fix_v_searchable_creators_onboarded_
city.sql` — `CREATE OR REPLACE VIEW v_searchable_creators`
identical to 045 EXCEPT the onboarded branch `i.city AS city`
→ `u.city AS city`. Same output columns/order (CREATE OR
REPLACE safe). Scraped branch byte-identical. `WHERE u.status
IN ('approved','pending')` intentionally retained (product
decision — see fix-search-verification-tag).

## Success
`pnpm qa:db`: `tests/influencer-search.test.js 'filters by city
(case-insensitive)'` flips RED→GREEN **by the migration** (not
a test edit). All other influencer-search tests stay GREEN.
Main `pnpm qa` 66/C1/gate-0 unchanged.

## Surfaces / deploy
- `backend/migrations/055_*.sql` (GOVERNED path).
- **PRODUCTION-IMPACTING**: `git push origin main` → Render
  runs the migration. Surfaced explicitly; founder GO on
  record. Forward-only; rollback = a follow-up migration
  reverting to `i.city` (no data loss — view only).
