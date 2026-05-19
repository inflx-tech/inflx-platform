# Impact Analysis — fix onboarded-creator city search

## Deploy posture — PRODUCTION-IMPACTING
- Adds `backend/migrations/055_*.sql` (GOVERNED path).
  `git push origin main` → Render runs the forward-only
  migration. Surfaced explicitly; founder GO on record. NOT
  silent.
- View-only change → no data migration, no row rewrites.
  Rollback = a follow-up migration restoring `i.city` (zero
  data risk).

## Affected
- `v_searchable_creators` onboarded branch `city` source:
  `i.city` → `u.city` (the `JOIN users u` is already present).
- Catching test: `tests/influencer-search.test.js 'filters by
  city (case-insensitive)'` (RED→GREEN by this migration).
- Resolves `features/backend-defect-onboarded-creator-city-
  search`.

## Regression surface
- Scraped branch (`creator_profiles cp`, uses `cp.city`)
  UNCHANGED. All non-city search filters (niche/followers/
  tier/language) UNCHANGED. `WHERE u.status IN
  ('approved','pending')` retained (Q3 product decision).
- CREATE OR REPLACE VIEW requires identical output column set +
  order vs 045 — preserved exactly (only the `city` *value
  expression* changes, not its name/position/type).
- Main `pnpm qa` (web/L1-L2 + C1): no web spec exercises
  onboarded-creator city search; re-run to confirm 66 GREEN.
- Other readers of `v_searchable_creators.city` (the search
  controller's `city = ANY(...)` filter) now get the correct
  value — intended improvement, no breakage.

## Risk notes
- Low risk: view definition reproduced verbatim from 045 with a
  single value-expression change to an already-joined column.
  Main risk = a transcription error in the 92-line view → guard:
  globalSetup applies all 55 migrations 0-error (CREATE OR
  REPLACE fails loudly on column-set mismatch) + the
  deterministic qa:db proves the exact RED→GREEN with zero
  regression before the production push.
