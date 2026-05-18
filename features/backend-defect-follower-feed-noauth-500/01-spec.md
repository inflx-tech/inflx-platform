# Backend Defect — `GET /v1/follower/feed` returns 500 (not 401) when unauthenticated

> Status: **CARVED FINDING** (Phase 4, 2026-05-18). GENUINE
> BACKEND DEFECT. Catching test LEFT RED. Backend NOT patched
> here — a dedicated fix is its own future contract
> (production-impacting, gated).

## Symptom
`GET /v1/follower/feed` with **no Authorization header** responds
**HTTP 500** instead of **401 UNAUTHORIZED**.
Catching test: `tests/follower-feed.test.js:182-185`
(`'returns 401 without auth'` → `Expected: 401, Received: 500`).

## Why it is a genuine backend defect (verify-twice, real code)
- Route: `backend/src/routes/follower.routes.js:27`
  `router.get('/feed', authenticateOptional, ctrl.getFeed)` —
  uses **`authenticateOptional`**, so a request with no token is
  NOT rejected at the middleware; it falls through to the
  handler with no authenticated user.
- Handler: `backend/src/controllers/follower.controller.js:299-303`
  `getFeed` resolves a `follower` for the (absent) user and then
  calls `followerService.getFeed(follower.id, follower.user_city)`.
  With no auth, `follower` is undefined → `follower.id` throws →
  `asyncHandler` surfaces it as **500**.
- The test is **correct**: an unauthenticated request to a
  user-scoped feed must return 401, never 500. The contract
  (standard error envelope, `UNAUTHORIZED`) is well-defined.
- Therefore the 500 is a real product bug: either `/feed` must
  use `authenticate` (hard 401) like other user-scoped reads, or
  `getFeed` must explicitly 401 when there is no resolved
  follower. Not a test/fixture problem.

## Disposition (Phase 4 = triage + carve, NOT backend-fix)
- The catching test stays **RED**. It correctly reports a real
  product bug (the live endpoint 500s on an unauthenticated
  request — a wrong, information-poor failure mode in prod).
- Phase 4 does **not** edit the test to pass and does **not**
  patch the backend (out of scope — that is a runtime change →
  production-impacting → its own locked, gated contract).

## Scope of the future fix contract (not done here)
Minimal: make `/v1/follower/feed` return a clean **401** when
unauthenticated — either swap `authenticateOptional` →
`authenticate` on the legacy `/feed` route, or guard `getFeed`
to throw `AppError('UNAUTHORIZED', 401)` when no follower
resolves. Behaviour-preserving for authenticated callers. Verify
via `pnpm qa:db` (this RED test → GREEN by the backend fix, not
a test edit) + main `pnpm qa` regression.

## Surfaces
- Defect lives in backend runtime (`follower.routes.js` /
  `follower.controller.js`). The future fix is
  **production-impacting** (Render). This carve itself is
  **deploy-inert** (a tracked finding + RED test only).
