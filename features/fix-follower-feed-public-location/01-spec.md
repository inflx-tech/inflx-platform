# Feature Spec — follower feed: public + location-based (Q1)

> Step 1. GATED on `lock.json.approved = true`. PRODUCTION-
> IMPACTING (backend runtime → Render). Resolves carve
> `features/backend-defect-follower-feed-noauth-500`. Founder
> product decision 2026-05-19: "follower no need authentication
> for entering and browsing ... if takes any action like
> purchase then system ask for signin ... if follower is signup
> then give personalised, not signup location based feed".

## Problem / intent
`GET /v1/follower/feed` 500s when unauthenticated (`getFeed`
deref'd `req.user.sub` with no token). The carved test asserted
401 — but the **product intent** is that browsing is PUBLIC
(no sign-in to browse; sign-in only to complete a purchase).
So neither 500 nor 401 is correct: anonymous must get a
**location-based** feed (client supplies `?city`); signed-in
gets the **personalised** feed (their follows + their city).

## Fix (mirror the proven public sibling)
`follower.controller.js getFeed` (lines 299-305) → mirror the
established `getHomeFeed` anonymous pattern:
`const follower = req.user?.sub ? await getFollowerByUserId(...)
.catch(()=>null) : null; const city = follower?.user_city ||
req.query.city || null; followerService.getFeed(follower?.id ||
null, city)`. `followerService.getFeed` is null-safe for a null
followerId (followed query `WHERE follower_id=$1` → no rows;
nearby query is city-scoped) — verified P12. No service change
needed.

## Test (realign to the product contract)
The carved `'returns 401 without auth'` test asserted the wrong
contract. Rewritten: anonymous `GET /feed?city=Vijayawada` →
**200** + a location-based feed (the Vijayawada offer surfaces).
This is the product-confirmed behaviour, passing via the
BACKEND fix (not a fake-green weakening — the rule itself is the
founder's decision; the test now encodes the correct rule).

## Success
`pnpm qa:db`: the realigned follower-feed test GREEN by the
backend fix; the 3 other follower-feed tests (followed/nearby/
required-fields, fixed in P12) stay GREEN. Main `pnpm qa`
66/C1/gate-0 unchanged. No new 500s.

## Surfaces / deploy
- `backend/src/controllers/follower.controller.js` (GOVERNED).
  **PRODUCTION-IMPACTING** (Render backend). Surfaced; founder
  GO on record. Forward-only; rollback = revert the ~6-line
  controller change. Mirrors an already-deployed sibling
  pattern (low risk).
