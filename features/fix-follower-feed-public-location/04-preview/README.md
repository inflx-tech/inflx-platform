# Preview (Step 4) — follower feed public + location-based

No UI here. Backend ~6-line controller change + test realign.

## Reviewer note (Step-5 lock)
- **PRODUCTION-IMPACTING** (backend runtime → Render). Founder
  product decision 2026-05-19: browse is public (no sign-in);
  sign-in only at purchase; signed-in → personalised, anon →
  location-based.
- Mirrors the already-deployed `getHomeFeed` anonymous pattern
  (consistency, low risk). `followerService.getFeed` null-safe
  for null followerId (verified P12) — no service change.
- Resolves carve `backend-defect-follower-feed-noauth-500`
  (was 500 on no-auth; the asserted 401 was the wrong contract
  per product intent).

## Step 7 — RESULT — GREEN 2026-05-19 (RELEASED)
```
fix        : follower.controller.js getFeed → anon-safe
             (req.user?.sub ? ... : null), city =
             follower?.user_city || req.query.city || null,
             followerService.getFeed(follower?.id||null, city);
             carved test realigned (anon ?city → 200 + feed) +
             renamed
qa:db      : GREEN — _fix6_remeasure_qadb.log 17:20:36Z:
             382/382, 54/54 migrations 0-error; follower-feed
             '√ is publicly accessible without auth and returns
             a location-based feed' + 3 siblings GREEN; zero
             Received:500
main pnpm qa: GREEN — 66 passed, C1 STATE=GREEN, gate 0
deploy     : PRODUCTION-IMPACTING (Render) — surfaced; founder GO
carve      : backend-defect-follower-feed-noauth-500 → resolved
             (public + location) on green
```
