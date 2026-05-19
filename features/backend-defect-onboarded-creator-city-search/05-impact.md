# Impact Analysis — backend-defect-onboarded-creator-city-search

## Deploy posture
- **This carve: DEPLOY-INERT.** Adds only this
  `features/backend-defect-*/` finding; the catching test
  (`tests/influencer-search.test.js` `'filters by city'`) is
  left RED. No backend/migration/runtime edit. No Render/Vercel.
- **The future fix: PRODUCTION-IMPACTING.** It edits a DB view
  via a forward-only migration (`v_searchable_creators`
  onboarded branch `i.city`→`u.city`) → Render runs migrations
  → explicit Step-14 gate required (never silent). Tracked, not
  done here.

## Affected (future fix, not this carve)
- `backend/migrations/<v_searchable_creators view>.sql`
  onboarded branch — `i.city AS city` → `u.city AS city`
  (the `JOIN users u ON u.id = i.user_id` already present).
- Optionally also align influencer registration to populate
  `influencers.city` — but the minimal, behaviour-preserving
  fix is the view column (city authoritatively lives on
  `users.city`, consistent with brands).
- Catching test: `tests/influencer-search.test.js`
  `'filters by city (case-insensitive)'` (RED now; GREEN only
  via the view migration).

## Regression surface (future fix)
- The scraped/`creator_profiles` branch of the view (which uses
  `cp.city`) must stay unchanged — only the onboarded branch's
  city source changes. Other search filters (niche, followers,
  tier, language) already work for onboarded creators
  (instrumented-confirmed) and must stay green.
- `listing.service.js` quality-score join already uses
  `u.city` (the precedent for city-on-users) — consistent.

## Risk notes
- Low-risk, well-scoped fix (one view column). Main risk is
  scope creep — keep it to the onboarded `city` source; do not
  refactor the view or the registration write path globally.
- Source: Phase-10 triage (`features/backend-test-debt-phase10`),
  reverted instrumented diagnostic on the real 53-migration
  qa:db Postgres (2026-05-19). Reproduced deterministically.
