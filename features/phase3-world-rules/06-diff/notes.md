# Before / after — Phase 3 World Rules

## Engine
- **Before:** location = one hardcoded policy (cityBoost soft-sort + dist_km
  ordering) for all five worlds; no radius anywhere; freshness default
  invisible; "food is deliverable-only" inexpressible.
- **After:** per-world `world_rule_settings` (mig 126) → ctx.worldRules;
  boundary (radius w/ coords, city w/o) enforced in the 4 discovery listing
  rules via `boundaryClause()`; mode off kills ranking+boost; engine-level
  empty-fallback (widen ×2 once / show_nearest / show_empty); world-rules
  state in the rule cache key (one-TTL convergence); world default for
  window_days. Curation surfaces (brandId/influencer) exempt by design —
  share links always open full pages.

## Admin
- **Before:** no surface at all for world behaviour.
- **After:** /admin/world-rules ("World Settings" nav, sections capability):
  per-world mode/radius/fallback/trending-default, Save + Reset;
  GET/PUT/DELETE /v1/admin/world-rules with validation and cache bust.

## Verification
- world-rules.test.js 8/8 first-class matrix (inert default, radius, city,
  3 fallbacks incl. widen geometry, curation immunity, off mode).
- Combined serial section suites 46/49 — 3 = untouched pre-existing baseline.
- pnpm qa GREEN 79/79 gate 0 (see lock).
- Honest notes: (1) initial fixture used stale 'fashion_walkin' vocab —
  mig 102 unified to 'fashion'; corrected. (2) afterAll cleanup hooks removed
  — harness closes the pg pool before file afterAll; beforeEach self-cleaning
  is the working pattern (namespaced keys). (3) combined run must be
  --runInBand — parallel workers clobber the shared test DB.
