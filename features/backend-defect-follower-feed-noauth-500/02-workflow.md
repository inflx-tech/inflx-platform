# Workflow Definition — backend-defect-follower-feed-noauth-500

> Step 2. Carved finding. Verifier for the FUTURE fix:
> `pnpm qa:db` (the RED test must go GREEN by a backend fix,
> never by editing the test).

## Actor
An unauthenticated client calling the legacy follower feed.

## Preconditions
qa:db substrate (53 migrations). Test
`tests/follower-feed.test.js:182` currently RED:
`GET /v1/follower/feed` (no auth) → 500.

## Observed (defect) behaviour
1. `GET /v1/follower/feed` with no Authorization header
   → **HTTP 500** (server throws; `follower` undefined in
   `getFeed`). Expected: **401 UNAUTHORIZED**, standard error
   envelope.

## Correct behaviour (target of the future fix contract)
1. `GET /v1/follower/feed` with no auth → **401**,
   `{ success:false, error:{ code:'UNAUTHORIZED' } }`.
2. Authenticated follower → unchanged (feed returned as today).

## Success definition (for the future fix, not this carve)
The catching test passes **because the backend now returns 401**
(authenticate guard or explicit 401 in getFeed), authenticated
behaviour identical, `pnpm qa:db` shows this test RED→GREEN with
no net-new failures, main `pnpm qa` 66 GREEN unaffected.

## This carve's "success"
The defect is documented with real code evidence, the test is
left RED (not masked), and Phase 4 does not patch backend or
test. Nothing here changes runtime behaviour.
