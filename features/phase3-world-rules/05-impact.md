# Impact — Phase 3 World Rules

**Verdict: deploy-inert on push (table ships empty = rank_only everywhere,
test-proven). Behaviour changes only when the admin saves a world's row —
per-world blast radius, reversible via Reset. Requires prod migration 126
(additive CREATE TABLE, run-126.js) — run BEFORE or WITH the deploy;
until the table exists the engine's settings lookup would error per-shelf
(caught → items[]), so run the migration first.**

- Cache: world-rules state is part of the rule cache key → a save converges
  within one engine TTL (~60s), same UX contract as section publishes.
- Boundary excludes brands with NULL coords (a boundary can't vouch for
  them) — food onboarding should require lat/lng; documented.
- Curation surfaces (business page / creator store) exempt by design.
- Offers/creators rules stay rank-only this phase (spec §limitation).
- Admin web: new page + nav entry + 3 api client fns; App Builder untouched.
