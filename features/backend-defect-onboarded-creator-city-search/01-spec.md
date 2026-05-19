# Backend Defect — onboarded influencers cannot be city-filtered in `/v1/influencers/search`

> Status: **CARVED FINDING** (Phase 10, 2026-05-19). GENUINE
> BACKEND DEFECT. Catching test LEFT RED. Backend NOT patched
> here — the fix is its own future contract (production-
> impacting: a DB view migration, gated).

## Symptom
`GET /v1/influencers/search?city=<x>` never returns onboarded
(registered) influencers — their `city` is always `null` in the
search view, so the `city = ANY(...)` filter matches nothing.
Catching test: `tests/influencer-search.test.js`
`'filters by city (case-insensitive)'` — expects 1 result
(`arun_kumar`, city Mumbai) → gets 0. Left **RED**.

## Why it is a genuine backend defect (verify-twice, real code + instrumented)
- Influencer registration writes city to **`users.city`**, not
  `influencers.city`: `influencer.controller.js:214-219`
  `UPDATE users SET name=$1, city=COALESCE(NULLIF($2,''),city)
  WHERE id=$3`. The `INSERT INTO influencers` (line ~227) does
  **not** include `city`. So `influencers.city` stays `NULL`
  for every onboarded influencer (column exists — migration
  `003_seed_influencers.sql:11` — but registration never
  populates it). This mirrors the established "city lives on
  `users`" pattern (cf. the previously-fixed brand
  `backend-defect-city-column`).
- The search view's onboarded branch selects the **wrong
  column**: `migrations/<v_searchable_creators>.sql` onboarded
  `SELECT … i.city AS city … FROM influencers i JOIN users u
  ON u.id = i.user_id`. It reads `i.city` (always NULL) while
  `u.city` (the real value) is already joined and available.
- Instrumented evidence (P10 reverted diagnostic, real qa:db
  PG): both onboarded creators returned `city: null` despite
  `registerInfluencer` sending `city:'Vijayawada'`; niche and
  followers_count populate correctly — only `city` is broken.
- Therefore the city search filter is silently non-functional
  for onboarded influencers — a real product bug (brands cannot
  discover onboarded creators by city). The test is correct;
  the view is wrong. Not a stale fixture / not a shape rename.

## Disposition (Phase 10 = triage + carve, NOT backend-fix)
- The catching test stays **RED**. P10 applied the cohesive
  `data.influencers`→`data.creators` + `instagram_handle`→
  `ig_handle` shape-rename uniformly across all 8 search tests
  (the real, separate class-2/4 drift). For this one test that
  makes it fail on the **genuine** assertion
  (`creators.length` 0 ≠ 1) instead of a stale `undefined`
  TypeError — i.e. it now correctly *exposes* the defect, it
  does **not** mask it. No assertion weakened/skipped.
- Backend NOT patched and the test's intent NOT changed here
  (the view-column fix is a migration → production-impacting →
  its own locked, gated contract).

## Scope of the future fix contract (not done here)
Minimal: in the `v_searchable_creators` onboarded branch change
`i.city AS city` → `u.city AS city` (the `users u` join already
exists). Behaviour-preserving for the scraped/creator-profile
branch. Verify: `pnpm qa:db` this RED test → GREEN by the view
migration (not a test edit) + main `pnpm qa` regression. Forward-
only migration; production-impacting (Render) → explicit Step-14
gate, never silent.

## Surfaces
- Defect lives in the DB view migration (`v_searchable_creators`)
  / influencer registration city-write asymmetry. The future fix
  is **production-impacting** (migration → Render). This carve
  itself is **deploy-inert** (a tracked finding + RED test only).
