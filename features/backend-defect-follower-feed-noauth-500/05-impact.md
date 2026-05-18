# Impact Analysis — backend-defect-follower-feed-noauth-500

## Deploy posture
- **This carve: DEPLOY-INERT.** Adds only this
  `features/backend-defect-*/` finding; the catching test is
  left RED unchanged; **no** backend/test/runtime edit. No
  Render/Vercel deploy.
- **The future fix: PRODUCTION-IMPACTING.** It edits backend
  runtime (`follower.routes.js` / `follower.controller.js`) →
  Render auto-deploys on release → explicit Step-14 gate
  required (never silent). Tracked, not done here.

## Affected (future fix, not this carve)
- `backend/src/routes/follower.routes.js:27` (the `/feed` route
  middleware) and/or
- `backend/src/controllers/follower.controller.js:299-303`
  (`getFeed` no-follower guard).
- Catching test: `tests/follower-feed.test.js:182` (RED now;
  GREEN only via the backend fix).

## Regression surface (future fix)
- Authenticated follower-feed reads must stay identical (only
  the no-auth path changes 500→401). Other follower endpoints
  using `authenticateOptional` (e.g. `/home-feed`,
  `/store/:handle`) are out of scope unless the same audit shows
  the same defect — would be their own carves.

## Risk notes
- Low-risk, well-scoped fix (auth guard). Main risk is scope
  creep — keep it to the no-auth 401 behaviour; do not refactor
  `authenticateOptional` globally.
- Source: Phase-4 triage (`features/backend-test-debt-phase4`),
  fresh `qa:db` 2026-05-18. Reproduced on the real 53-migration
  Postgres.
