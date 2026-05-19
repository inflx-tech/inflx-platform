# Impact Analysis — backend-defect-search-includes-pending-influencers

## Deploy posture
- **This carve: DEPLOY-INERT.** Adds only this
  `features/backend-defect-*/` finding; the catching test
  (`tests/influencer-search.test.js` `'does NOT include
  pending …'`) is left RED. No backend/migration/runtime edit.
  No Render/Vercel.
- **The future fix: PRODUCTION-IMPACTING.** Edits a DB view via
  a forward-only migration (`v_searchable_creators` onboarded
  `WHERE u.status IN ('approved','pending')` → `= 'approved'`,
  pending product confirmation) → Render runs migrations →
  explicit Step-14 gate (never silent). Tracked, not done here.

## Affected (future fix, not this carve)
- `backend/migrations/045_profile_pic_r2_cache.sql` onboarded
  branch line ~136 `WHERE u.status IN ('approved','pending')`
  (the search view definition; would be re-issued via a new
  forward-only migration, not an in-place edit of 045).
- Catching test: `tests/influencer-search.test.js` `'does NOT
  include pending (unapproved) influencers in results'` (RED
  now; GREEN only via the view migration).
- Product/eng decision required: confirm pending influencers
  must not surface in brand discovery (expected) before the fix.

## Regression surface (future fix)
- The scraped/`creator_profiles` branch of the UNION is
  unaffected (separate SELECT). Only the onboarded branch's
  status predicate changes.
- Other onboarded-creator search behaviour (niche/followers/
  no-sensitive-fields) already green and must stay green.
- Sibling carve `backend-defect-onboarded-creator-city-search`
  touches the same onboarded branch (`i.city`→`u.city`) — the
  two future fixes may land in one migration or two; both are
  gated, product-confirmed contracts.

## Risk notes
- Low-risk, well-scoped (one WHERE predicate). Main risk is
  product-intent: do not assume — the carve exists precisely so
  the `'pending'` inclusion gets an explicit decision rather
  than a silent test edit either way.
- Source: Phase-10 triage (`features/backend-test-debt-phase10`),
  P10 deterministic re-measure on the real 53-migration qa:db
  Postgres (2026-05-19). Reproduced deterministically (Expected
  1, Received 2).
