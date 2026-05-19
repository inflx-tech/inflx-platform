# Impact Analysis — follower feed public + location-based

## Deploy posture — PRODUCTION-IMPACTING
- Changes `backend/src/controllers/follower.controller.js`
  (GOVERNED). `git push origin main` → Render backend
  auto-deploy. Surfaced explicitly; founder GO on record. NOT
  silent. Forward-only; rollback = revert the ~6-line change.

## Affected
- `follower.controller.js getFeed` (lines 299-305) — anonymous-
  safe; city from follower OR `req.query.city`; followerId
  nullable.
- Catching test realigned: `tests/follower-feed.test.js` (the
  ex-`'returns 401 without auth'`).
- Resolves `features/backend-defect-follower-feed-noauth-500`.

## Regression surface
- Behavioural change: `/v1/follower/feed` no longer 500s/401s
  unauthenticated — it returns a public location-based feed.
  This is the intended product behaviour (route was already
  `authenticateOptional`). Signed-in behaviour UNCHANGED
  (still personalised: their follows + their city).
- `followerService.getFeed(null, city)`: followed query
  `WHERE follower_id=$1` (null → 0 rows, safe); nearby query
  city-scoped (safe) — verified P12. No service change.
- Mirrors the live `getHomeFeed` anon pattern → behavioural
  consistency across the public browse endpoints; no new
  pattern introduced.
- Main `pnpm qa` (web/L1-L2 + C1): the brand/admin web specs do
  not exercise the follower feed; re-run to confirm 66 GREEN.
  (Mobile follower app consumes this — out of the web QA gate;
  the change only ADDS anonymous access, doesn't alter
  signed-in responses.)

## Risk notes
- Low risk: pattern-mirror of a deployed sibling; signed-in
  path semantically unchanged; only the previously-crashing
  anonymous path becomes a working public feed. Main risk =
  an unauthenticated caller now getting data — intended &
  founder-authorized (public browse). The deterministic qa:db
  (all 382) + main pnpm qa are the pre-push safety net.
